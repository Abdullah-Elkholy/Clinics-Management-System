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

            // Check for global pause - WhatsAppSession.IsPaused
            var whatsAppSession = await _db.WhatsAppSessions
                .Where(ws => ws.ModeratorUserId == moderatorId && !ws.IsDeleted)
                .FirstOrDefaultAsync(cancellationToken);
            
            if (whatsAppSession?.IsPaused == true)
            {
                _logger.LogDebug("Global pause active for moderator {ModeratorId}, skipping message {MessageId}", 
                    moderatorId, message.Id);
                return WhatsAppSendResult.FailedResult("تم إيقاف الإرسال مؤقتاً. جلسة الواتساب متوقفة.");
            }

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

            // CRITICAL: Check if message is already sent (prevents duplicate sends after successful extension delivery)
            // This can happen when:
            // 1. Extension sends message successfully
            // 2. Backend command times out before receiving completion
            // 3. MessageProcessor re-queues the message (status still "queued" due to race condition)
            // 4. New command created → duplicate message sent
            var freshMessage = await _db.Messages.AsNoTracking().FirstOrDefaultAsync(m => m.Id == message.Id, cancellationToken);
            if (freshMessage?.Status == "sent")
            {
                _logger.LogWarning("Message {MessageId} already has status 'sent' - skipping duplicate send", message.Id);
                return WhatsAppSendResult.SuccessResult("AlreadySent", "Message already sent successfully");
            }

            // Check if there's already a pending/in-progress command for this message (prevent duplicates)
            var existingCommand = await _db.ExtensionCommands
                .Where(c => c.MessageId == message.Id 
                    && (c.Status == ExtensionCommandStatuses.Pending || c.Status == ExtensionCommandStatuses.Sent || c.Status == ExtensionCommandStatuses.Acked)
                    && c.CreatedAtUtc > DateTime.UtcNow.AddMinutes(-5)) // Only consider recent commands
                .FirstOrDefaultAsync(cancellationToken);
            
            if (existingCommand != null)
            {
                _logger.LogWarning("Duplicate command detected for message {MessageId}, existing command {CommandId} status {Status}. Waiting for existing command.", 
                    message.Id, existingCommand.Id, existingCommand.Status);
                
                // Wait for the existing command to complete instead of creating a new one
                return await WaitForCommandResult(existingCommand.Id, cancellationToken);
            }

            // Also check for recently COMPLETED commands to prevent rapid re-sends after timeout
            // If a command completed successfully in the last 30 seconds, don't create another
            var recentCompletedCommand = await _db.ExtensionCommands
                .Where(c => c.MessageId == message.Id 
                    && c.Status == ExtensionCommandStatuses.Completed
                    && c.ResultStatus == ExtensionResultStatuses.Success
                    && c.CompletedAtUtc > DateTime.UtcNow.AddSeconds(-30))
                .FirstOrDefaultAsync(cancellationToken);
            
            if (recentCompletedCommand != null)
            {
                _logger.LogWarning("Message {MessageId} has a recently completed successful command {CommandId}. Skipping duplicate send.", 
                    message.Id, recentCompletedCommand.Id);
                return WhatsAppSendResult.SuccessResult("RecentlyCompleted", "Message was recently sent successfully");
            }

            // Create command payload
            // Build full phone number with country code (removing leading 0 from local number)
            var fullPhoneNumber = $"{message.CountryCode?.TrimStart('+')}{message.PatientPhone?.TrimStart('0')}";
            
            var payload = new SendMessageCommandPayload
            {
                MessageId = message.Id,
                PhoneNumber = fullPhoneNumber,
                CountryCode = message.CountryCode,
                MessageText = message.Content,
                SessionId = message.SessionId,
                PatientName = message.FullName
            };

            // Debug logging for newlines in message content
            var hasNewlines = message.Content?.Contains('\n') ?? false;
            var newlineCount = message.Content?.Count(c => c == '\n') ?? 0;
            _logger.LogDebug("Message {MessageId} content: HasNewlines={HasNewlines}, NewlineCount={NewlineCount}, ContentLength={ContentLength}", 
                message.Id, hasNewlines, newlineCount, message.Content?.Length ?? 0);

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
                    .SendAsync("ExecuteCommand", new
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

        /// <summary>
        /// Wait for an existing command to complete and return its result.
        /// Used when a duplicate command is detected for the same message.
        /// </summary>
        private async Task<WhatsAppSendResult> WaitForCommandResult(Guid commandId, CancellationToken cancellationToken)
        {
            var startTime = DateTime.UtcNow;
            while (DateTime.UtcNow - startTime < _commandTimeout)
            {
                cancellationToken.ThrowIfCancellationRequested();

                var command = await _commandService.GetCommandAsync(commandId);
                if (command == null)
                {
                    return WhatsAppSendResult.FailedResult("الأمر غير موجود");
                }

                switch (command.Status)
                {
                    case ExtensionCommandStatuses.Completed:
                        return MapCommandResultToSendResult(command);
                    
                    case ExtensionCommandStatuses.Failed:
                    case ExtensionCommandStatuses.Expired:
                        var errorMsg = ExtractErrorMessage(command.ResultJson);
                        return WhatsAppSendResult.FailedResult(errorMsg ?? "فشل في إرسال الرسالة");
                }

                await Task.Delay(_pollInterval, cancellationToken);
            }

            // Command timed out
            return WhatsAppSendResult.Waiting("انتهت مهلة انتظار استجابة الأمر الموجود");
        }

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
