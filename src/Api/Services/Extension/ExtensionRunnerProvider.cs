using System.Text.Json;
using Clinics.Domain;
using Clinics.Infrastructure;
using Clinics.Infrastructure.Services;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Clinics.Api.Services.Extension
{
    /// <summary>
    /// WhatsApp provider that sends messages through browser extension.
    /// This provider creates commands for the extension to execute.
    /// </summary>
    public class ExtensionRunnerProvider : IWhatsAppProvider
    {
        private readonly ApplicationDbContext _db;
        private readonly IExtensionLeaseService _leaseService;
        private readonly IExtensionCommandService _commandService;
        private readonly IHubContext<Hubs.ExtensionHub> _extensionHub;
        private readonly IArabicErrorMessageService _errorMessageService;
        private readonly ILogger<ExtensionRunnerProvider> _logger;
        private readonly TimeSpan _commandTimeout = TimeSpan.FromMinutes(2);
        private readonly TimeSpan _pollInterval = TimeSpan.FromMilliseconds(500);

        public string ProviderName => "ExtensionRunner";

        public ExtensionRunnerProvider(
            ApplicationDbContext db,
            IExtensionLeaseService leaseService,
            IExtensionCommandService commandService,
            IHubContext<Hubs.ExtensionHub> extensionHub,
            IArabicErrorMessageService errorMessageService,
            ILogger<ExtensionRunnerProvider> logger)
        {
            _db = db;
            _leaseService = leaseService;
            _commandService = commandService;
            _extensionHub = extensionHub;
            _errorMessageService = errorMessageService;
            _logger = logger;
        }

        public async Task<bool> IsAvailableAsync(int moderatorUserId)
        {
            var lease = await _leaseService.GetActiveLeaseAsync(moderatorUserId);
            return lease != null && lease.IsActive;
        }

        public async Task<WhatsAppSendResult> SendMessageAsync(Message message, CancellationToken cancellationToken = default)
        {
            if (!message.ModeratorId.HasValue)
            {
                return WhatsAppSendResult.FailedResult("معرف المشرف غير صالح");
            }

            var moderatorId = message.ModeratorId.Value;

            // Check if extension has active lease
            var lease = await _leaseService.GetActiveLeaseAsync(moderatorId);
            if (lease == null)
            {
                _logger.LogWarning("No active extension lease for moderator {ModeratorId}", moderatorId);
                return WhatsAppSendResult.FailedResult("لا يوجد امتداد نشط متصل. يرجى تشغيل امتداد المتصفح.");
            }

            // Check WhatsApp status from lease
            if (lease.WhatsAppStatus == "pending_qr")
            {
                return WhatsAppSendResult.PendingQR("جلسة الواتساب تحتاج إلى المصادقة. يرجى مسح رمز QR.");
            }

            if (lease.WhatsAppStatus == "pending_net")
            {
                return WhatsAppSendResult.PendingNET("فشل الاتصال بالإنترنت.");
            }

            // Create command payload
            var payload = new SendMessageCommandPayload
            {
                MessageId = message.Id,
                PhoneNumber = message.PatientPhone ?? "",
                CountryCode = message.CountryCode,
                MessageText = message.Content,
                SessionId = message.SessionId,
                PatientName = message.FullName
            };

            // Create command
            var command = await _commandService.CreateCommandAsync(
                moderatorId,
                ExtensionCommandTypes.SendMessage,
                payload,
                messageId: message.Id,
                timeout: _commandTimeout);

            _logger.LogInformation("Created SendMessage command {CommandId} for message {MessageId}", 
                command.Id, message.Id);

            // Notify extension via SignalR
            try
            {
                await _extensionHub.Clients
                    .Group($"extension-{moderatorId}")
                    .SendAsync("CommandReceived", new
                    {
                        commandId = command.Id,
                        commandType = command.CommandType,
                        payload = payload
                    }, cancellationToken);

                await _commandService.MarkSentAsync(command.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send command {CommandId} via SignalR", command.Id);
                // Command will be picked up by extension via polling fallback
            }

            // Wait for command completion (with polling)
            var startTime = DateTime.UtcNow;
            while (DateTime.UtcNow - startTime < _commandTimeout)
            {
                cancellationToken.ThrowIfCancellationRequested();

                var updatedCommand = await _commandService.GetCommandAsync(command.Id);
                if (updatedCommand == null)
                {
                    return WhatsAppSendResult.FailedResult("الأمر غير موجود");
                }

                switch (updatedCommand.Status)
                {
                    case ExtensionCommandStatuses.Completed:
                        return MapCommandResultToSendResult(updatedCommand);
                    
                    case ExtensionCommandStatuses.Failed:
                    case ExtensionCommandStatuses.Expired:
                        var errorMsg = ExtractErrorMessage(updatedCommand.ResultJson);
                        return WhatsAppSendResult.FailedResult(errorMsg ?? "فشل في إرسال الرسالة");
                }

                await Task.Delay(_pollInterval, cancellationToken);
            }

            // Command timed out
            await _commandService.FailAsync(command.Id, "Command timed out waiting for extension response");
            return WhatsAppSendResult.Waiting("انتهت مهلة انتظار استجابة الامتداد");
        }

        public async Task<string> GetSessionStatusAsync(int moderatorUserId)
        {
            var lease = await _leaseService.GetActiveLeaseAsync(moderatorUserId);
            if (lease == null)
            {
                return "disconnected";
            }

            return lease.WhatsAppStatus ?? "unknown";
        }

        #region Helper Methods

        private WhatsAppSendResult MapCommandResultToSendResult(ExtensionCommand command)
        {
            if (string.IsNullOrEmpty(command.ResultStatus))
            {
                return WhatsAppSendResult.FailedResult("لم يتم استلام نتيجة من الامتداد");
            }

            return command.ResultStatus switch
            {
                ExtensionResultStatuses.Success => WhatsAppSendResult.SuccessResult(
                    providerId: "Extension",
                    providerResponse: command.ResultJson),
                
                ExtensionResultStatuses.PendingQR => WhatsAppSendResult.PendingQR(
                    ExtractErrorMessage(command.ResultJson) ?? "جلسة الواتساب تحتاج إلى المصادقة"),
                
                ExtensionResultStatuses.PendingNET => WhatsAppSendResult.PendingNET(
                    ExtractErrorMessage(command.ResultJson) ?? "فشل الاتصال بالإنترنت"),
                
                ExtensionResultStatuses.Waiting => WhatsAppSendResult.Waiting(
                    ExtractErrorMessage(command.ResultJson) ?? "في انتظار جاهزية واجهة الواتساب"),
                
                _ => WhatsAppSendResult.FailedResult(
                    ExtractErrorMessage(command.ResultJson) ?? "فشل في إرسال الرسالة")
            };
        }

        private static string? ExtractErrorMessage(string? resultJson)
        {
            if (string.IsNullOrEmpty(resultJson))
                return null;

            try
            {
                var doc = JsonDocument.Parse(resultJson);
                if (doc.RootElement.TryGetProperty("error", out var errorElement))
                {
                    return errorElement.GetString();
                }
                if (doc.RootElement.TryGetProperty("message", out var messageElement))
                {
                    return messageElement.GetString();
                }
            }
            catch
            {
                // Ignore JSON parse errors
            }

            return null;
        }

        #endregion
    }

    /// <summary>
    /// Payload for SendMessage command.
    /// </summary>
    public class SendMessageCommandPayload
    {
        public Guid MessageId { get; set; }
        public string PhoneNumber { get; set; } = "";
        public string CountryCode { get; set; } = "+20";
        public string MessageText { get; set; } = "";
        public string? SessionId { get; set; }
        public string? PatientName { get; set; }
    }
}
