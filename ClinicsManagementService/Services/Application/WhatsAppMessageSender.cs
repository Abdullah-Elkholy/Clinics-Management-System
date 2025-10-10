using ClinicsManagementService.Configuration;
using ClinicsManagementService.Models;
using ClinicsManagementService.Services.Interfaces;
using Microsoft.Playwright;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace ClinicsManagementService.Services.Application
{
    // Helper for robust async execution
    public static class AsyncExecutionHelper
    {
        public static async Task<T> TryExecuteAsync<T>(Func<Task<T>> operation, T defaultValue, string operationName, INotifier notifier)
        {
            try
            {
                return await operation();
            }
            catch (Exception ex)
            {
                notifier.Notify($"⚠️ Error in {operationName}: {ex.Message}");
                return defaultValue;
            }
        }
    }

    public class WhatsAppMessageSender : IMessageSender
    {
        private readonly IWhatsAppService _whatsappService;
        private readonly Func<IBrowserSession> _browserSessionFactory;
        private readonly INotifier _notifier;
        public WhatsAppMessageSender(IWhatsAppService whatsappService, Func<IBrowserSession> browserSessionFactory, INotifier notifier)
        {
            _whatsappService = whatsappService;
            _browserSessionFactory = browserSessionFactory;
            _notifier = notifier;
        }

        // Send multiple phone/message pairs with random throttling between each send, returning MessageSendResult for each.
        public async Task<List<MessageSendResult>> SendBulkWithThrottlingAsync(IEnumerable<(string Phone, string Message)> items, int minDelayMs, int maxDelayMs)
        {
            _notifier.Notify("Starting bulk send process...");
            var results = new List<MessageSendResult>();
            bool networkErrorOccurred = false;
            string? networkErrorMessage = null;
            int total = items.Count();
            int counter = 1;

            var browserSession = _browserSessionFactory();
            await _whatsappService.PrepareSessionAsync(browserSession);

            foreach (var item in items)
            {
                _notifier.Notify($"[PROGRESS] [{counter}/{total}] Phone: {item.Phone}, Message: {item.Message}");
                _notifier.Notify($"[{counter}/{total}] Preparing to send to {item.Phone}: {item.Message}");
                if (networkErrorOccurred)
                {
                    _notifier.Notify($"[{counter}/{total}] Skipping {item.Phone} due to previous network error: {networkErrorMessage}");
                    results.Add(new MessageSendResult
                    {
                        Phone = item.Phone,
                        Message = item.Message,
                        Sent = false,
                        Error = networkErrorMessage ?? "PendingNET: Internet connection unavailable",
                        IconType = null,
                        Status = MessageOperationStatus.PendingNET
                    });
                    counter++;
                    continue;
                }
                _notifier.Notify($"[{counter}/{total}] Sending message to {item.Phone}...");
                var result = await AsyncExecutionHelper.TryExecuteAsync<MessageSendResult>(
                    async () => {
                        var deliveryResult = await _whatsappService.ExecuteWithRetryAsync(
                            () => _whatsappService.SendMessageWithIconTypeAsync(item.Phone, item.Message, browserSession),
                            maxAttempts: 3,
                            shouldRetryResult: r => r?.IsWaiting() == true || r?.IsPendingNet() == true,
                            isRetryable: ex => ex.Message.Contains("net::ERR_NAME_NOT_RESOLVED") || ex.Message.Contains("net::ERR_INTERNET_DISCONNECTED") || ex.Message.Contains("Navigation failed"));
                            return new MessageSendResult {
                                Phone = item.Phone,
                                Message = item.Message,
                                Sent = deliveryResult.IsSuccess == true,
                                Error = deliveryResult.ResultMessage,
                                IconType = deliveryResult.Data,
                                Status = DetermineStatus(deliveryResult.IsSuccess == true, deliveryResult.ResultMessage)
                            };
                    },
                    new MessageSendResult { Phone = item.Phone, Message = item.Message, Sent = false, Error = "Unknown error", IconType = null, Status = MessageOperationStatus.Failed },
                    $"SendMessageWithIconTypeAsync for {item.Phone}", _notifier);
                _notifier.Notify($"[{counter}/{total}] Result for {item.Phone}: Sent={result.Sent}, Error={result.Error}, IconType={result.IconType}");
                results.Add(new MessageSendResult
                {
                    Phone = item.Phone,
                    Message = item.Message,
                    Sent = result.Sent,
                    Error = result.Error,
                    IconType = result.IconType,
                    Status = DetermineStatus(result.Sent, result.Error)
                });
                if (!result.Sent && result.Error != null &&
                    (result.Error.Contains("net::ERR_NAME_NOT_RESOLVED") || result.Error.Contains("net::ERR_INTERNET_DISCONNECTED") || result.Error.Contains("Navigation failed")))
                {
                    networkErrorOccurred = true;
                    networkErrorMessage = "PendingNET: Internet connection unavailable. " + result.Error;
                    _notifier.Notify($"[{counter + 1}/{total}] Network error detected: {networkErrorMessage}");
                }
                if (counter < total)
                {
                    int delay = Random.Shared.Next(minDelayMs, maxDelayMs + 1);
                    _notifier.Notify($"[{counter + 1}/{total}] Throttling for {delay}ms before next send...");
                    var monitoringResult = await AsyncExecutionHelper.TryExecuteAsync(
                        async () => await ContinuousMonitoringAsync(browserSession, delay),
                        null,
                        $"ContinuousMonitoringAsync for {item.Phone}", _notifier);
                    if (monitoringResult != null)
                    {
                        _notifier.Notify($"[{counter + 1}/{total}] Throttling interrupted: {monitoringResult.ResultMessage}");
                        for (int i = counter; i < total; i++)
                        {
                            var remainingItem = items.Skip(i).First();
                            results.Add(new MessageSendResult
                            {
                                Phone = remainingItem.Phone,
                                Message = remainingItem.Message,
                                Sent = false,
                                Error = monitoringResult.ResultMessage,
                                IconType = null,
                                Status = MessageOperationStatus.PendingQR
                            });
                        }
                        break;
                    }
                }
                counter++;
            }
            await _whatsappService.DisposeBrowserSessionAsync(browserSession);
            _notifier.Notify("Bulk send process completed.");
            return results;
        }

    /// <summary>
    /// Adapter to domain ContinuousMonitoringAsync so application layer can call it with same semantics.
    /// Returns OperationResult<string?> with ResultMessage populated from underlying bool result states.
    /// </summary>
    private async Task<OperationResult<string?>?> ContinuousMonitoringAsync(IBrowserSession browserSession, int timeoutMs = 5000)
    {
        try
        {
            // Check for progress bars
            foreach (var progressSelector in WhatsAppConfiguration.ProgressBarSelectors)
            {
                try
                {
                    var progress = await browserSession.QuerySelectorAsync(progressSelector);
                    if (progress != null)
                    {
                        _notifier.Notify($"⏳ Progress bar detected during monitoring ({progressSelector}) - waiting for completion");
                        try
                        {
                            await browserSession.WaitForSelectorAsync(progressSelector, timeoutMs, WaitForSelectorState.Detached);
                            _notifier.Notify($"✅ Progress bar disappeared ({progressSelector})");
                        }
                        catch (Exception progressEx)
                        {
                            _notifier.Notify($"⚠️ Progress bar wait timeout: {progressEx.Message}");
                        }
                        break;
                    }
                }
                catch (Exception ex)
                {
                    _notifier.Notify($"⚠️ Error checking progress selector {progressSelector}: {ex.Message}");
                }
            }

            // Check for auth
            foreach (var selector in WhatsAppConfiguration.QrCodeSelectors)
            {
                try
                {
                    var authElement = await browserSession.QuerySelectorAsync(selector);
                    if (authElement != null)
                    {
                        _notifier.Notify($"🔐 Authentication issue detected during monitoring ({selector})");
                        return OperationResult<string?>.PendingQR("WhatsApp authentication required. Please scan QR code.");
                    }
                }
                catch (Exception ex)
                {
                    _notifier.Notify($"⚠️ Error checking auth selector {selector}: {ex.Message}");
                }
            }

            // Check for logout indicators
            try
            {
                var currentUrl = await browserSession.GetUrlAsync();
                if (currentUrl.Contains("post_logout") || currentUrl.Contains("logout_reason"))
                {
                    _notifier.Notify("🔐 Logout detected during monitoring - session needs authentication");
                    return OperationResult<string?>.PendingQR("WhatsApp session expired. Please scan QR code.");
                }
            }
            catch (Exception ex)
            {
                _notifier.Notify($"⚠️ Error checking URL during monitoring: {ex.Message}");
            }

            return null;
        }
        catch (Exception ex)
        {
            _notifier.Notify($"⚠️ Error in continuous monitoring: {ex.Message}");
            return null;
        }
    }

        public async Task<bool> SendMessageAsync(string phoneNumber, string message)
        {
            var browserSession = _browserSessionFactory();
            await _whatsappService.PrepareSessionAsync(browserSession);
            var result = await AsyncExecutionHelper.TryExecuteAsync<MessageSendResult>(
                async () => {
                    var deliveryResult = await _whatsappService.ExecuteWithRetryAsync(
                        () => _whatsappService.SendMessageWithIconTypeAsync(phoneNumber, message, browserSession),
                        maxAttempts: 3,
                        shouldRetryResult: r => r?.IsWaiting() == true || r?.IsPendingNet() == true,
                        isRetryable: ex => ex.Message.Contains("net::ERR_NAME_NOT_RESOLVED") || ex.Message.Contains("net::ERR_INTERNET_DISCONNECTED") || ex.Message.Contains("Navigation failed"));
                        return new MessageSendResult {
                            Phone = phoneNumber,
                            Message = message,
                            Sent = deliveryResult.IsSuccess == true,
                            Error = deliveryResult.ResultMessage,
                            IconType = deliveryResult.Data,
                            Status = DetermineStatus(deliveryResult.IsSuccess == true, deliveryResult.ResultMessage)
                        };
                },
                new MessageSendResult { Phone = phoneNumber, Message = message, Sent = false, Error = "Unknown error", IconType = null, Status = MessageOperationStatus.Failed },
                $"SendMessageWithIconTypeAsync for {phoneNumber}", _notifier);
            if (!result.Sent && !string.IsNullOrEmpty(result.Error))
            {
                _notifier.Notify(result.Error);
            }
            await _whatsappService.DisposeBrowserSessionAsync(browserSession);
            return result.Sent;
        }

        public async Task<List<MessageSendResult>> SendMessagesAsync(string phoneNumber, IEnumerable<string> messages)
        {
            var browserSession = _browserSessionFactory();
            await _whatsappService.PrepareSessionAsync(browserSession);
            var results = new List<MessageSendResult>();
            foreach (var message in messages)
            {
                var result = await AsyncExecutionHelper.TryExecuteAsync<MessageSendResult>(
                    async () => {
                        var deliveryResult = await _whatsappService.ExecuteWithRetryAsync(
                            () => _whatsappService.SendMessageWithIconTypeAsync(phoneNumber, message, browserSession),
                            maxAttempts: 3,
                            shouldRetryResult: r => r?.IsWaiting() == true || r?.IsPendingNet() == true,
                            isRetryable: ex => ex.Message.Contains("net::ERR_NAME_NOT_RESOLVED") || ex.Message.Contains("net::ERR_INTERNET_DISCONNECTED") || ex.Message.Contains("Navigation failed"));
                        return new MessageSendResult {
                            Phone = phoneNumber,
                            Message = message,
                            Sent = deliveryResult.IsSuccess == true,
                            Error = deliveryResult.ResultMessage,
                            IconType = deliveryResult.Data,
                            Status = DetermineStatus(deliveryResult.IsSuccess == true, deliveryResult.ResultMessage)
                        };
                    },
                    new MessageSendResult { Phone = phoneNumber, Message = message, Sent = false, Error = "Unknown error", IconType = null, Status = MessageOperationStatus.Failed },
                    $"SendMessageWithIconTypeAsync for {phoneNumber}", _notifier);
                if (!result.Sent && !string.IsNullOrEmpty(result.Error))
                {
                    _notifier.Notify(result.Error);
                }
                else
                {
                    _notifier.Notify($"Message sent to {phoneNumber}: {message}");
                }
                results.Add(new MessageSendResult
                {
                    Phone = phoneNumber,
                    Message = message,
                    Sent = result.Sent,
                    Error = result.Error,
                    IconType = result.IconType
                });
            }
            await _whatsappService.DisposeBrowserSessionAsync(browserSession);
            return results;
        }

        private MessageOperationStatus DetermineStatus(bool sent, string? error)
        {
            if (sent)
            {
                return MessageOperationStatus.Succeeded;
            }

            if (error?.Contains("PendingQR:") == true || error?.Contains("WhatsApp authentication required") == true)
            {
                return MessageOperationStatus.PendingQR;
            }

            if (error?.Contains("PendingNET:") == true || error?.Contains("Internet connection unavailable") == true)
            {
                return MessageOperationStatus.PendingNET;
            }

            if (error?.Contains("Waiting:") == true)
            {
                return MessageOperationStatus.Waiting;
            }

            return MessageOperationStatus.Failed;
        }
    }
}