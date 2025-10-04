using ClinicsManagementService.Configuration;
using ClinicsManagementService.Models;
using ClinicsManagementService.Services.Interfaces;
using Microsoft.Playwright;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace ClinicsManagementService.Services.Application
{

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
            // Orchestrate bulk sending using browser session and notifier
            _notifier.Notify("Starting bulk send process...");
            var results = new List<MessageSendResult>();
            bool networkErrorOccurred = false;
            string? networkErrorMessage = null;
            int total = items.Count(); // only for logging using notify
            int counter = 1; // only for logging using notify

            // initialize session once for bulk sending
            var browserSession = _browserSessionFactory();
            await _whatsappService.PrepareSessionAsync(browserSession);

            foreach (var item in items)
            {
                _notifier.Notify($"[PROGRESS] [{counter}/{total}] Phone: {item.Phone}, Message: {item.Message}"); // only for logging using notify

                _notifier.Notify($"[{counter}/{total}] Preparing to send to {item.Phone}: {item.Message}"); // only for logging using notify
                if (networkErrorOccurred)
                {
                    _notifier.Notify($"[{counter}/{total}] Skipping {item.Phone} due to previous network error: {networkErrorMessage}"); // only for logging using notify
                    results.Add(new MessageSendResult
                    {
                        Phone = item.Phone,
                        Message = item.Message,
                        Sent = false,
                        Error = networkErrorMessage ?? "PendingNET: Internet connection unavailable",
                        IconType = null,
                        Status = MessageOperationStatus.PendingNET
                    });
                    counter++; // only for logging using notify
                    continue;
                }
                _notifier.Notify($"[{counter}/{total}] Sending message to {item.Phone}..."); // only for logging using notify
                var result = await _whatsappService.ExecuteWithRetryAsync(() => _whatsappService.SendMessageWithIconTypeAsync(item.Phone, item.Message, browserSession),
                    maxAttempts: 3,
                    treatAsRetryable: ex => ex.Message.Contains("net::ERR_NAME_NOT_RESOLVED") || ex.Message.Contains("net::ERR_INTERNET_DISCONNECTED") || ex.Message.Contains("Navigation failed"));
                _notifier.Notify($"[{counter}/{total}] Result for {item.Phone}: Sent={result.Sent}, Error={result.Error}, IconType={result.IconType}"); // only for logging using notify
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
                    _notifier.Notify($"[{counter + 1}/{total}] Network error detected: {networkErrorMessage}"); // only for logging using notify
                }
                // Only throttle if not the last message with continuous monitoring
                if (counter < total)
                {
                    int delay = Random.Shared.Next(minDelayMs, maxDelayMs + 1);
                    _notifier.Notify($"[{counter + 1}/{total}] Throttling for {delay}ms before next send..."); // only for logging using notify

                    // Run continuous monitoring during throttling delay
                    var monitoringResult = await ContinuousMonitoringAsync(browserSession, delay);
                    if (monitoringResult != null)
                    {
                        _notifier.Notify($"[{counter + 1}/{total}] Throttling interrupted: {monitoringResult.Error}");
                        // Mark remaining messages as pending due to authentication issue
                        for (int i = counter; i < total; i++)
                        {
                            var remainingItem = items.Skip(i).First();
                            results.Add(new MessageSendResult
                            {
                                Phone = remainingItem.Phone,
                                Message = remainingItem.Message,
                                Sent = false,
                                Error = monitoringResult.Error,
                                IconType = null,
                                Status = MessageOperationStatus.PendingQR
                            });
                        }
                        break; // Exit the loop
                    }
                }
                counter++; // only for logging using notify
            }
            // Dispose browser session after bulk sending
            await _whatsappService.DisposeBrowserSessionAsync(browserSession);
            _notifier.Notify("Bulk send process completed."); // only for logging using notify
            return results;
        }

        /// <summary>
        /// Continuous monitoring for progress bars and authentication issues
        /// This method runs as a side job to interrupt waiting operations
        /// </summary>
        private async Task<MessageDeliveryResult?> ContinuousMonitoringAsync(IBrowserSession browserSession, int timeoutMs = 5000)
        {
            try
            {
                // Check for progress bars using configuration
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

                // Check for authentication issues using configuration
                foreach (var selector in WhatsAppConfiguration.QrCodeSelectors)
                {
                    try
                    {
                        var authElement = await browserSession.QuerySelectorAsync(selector);
                        if (authElement != null)
                        {
                            _notifier.Notify($"🔐 Authentication issue detected during monitoring ({selector})");
                            return MessageDeliveryResult.PendingQR("WhatsApp authentication required. Please scan QR code.");
                        }
                    }
                    catch (Exception ex)
                    {
                        _notifier.Notify($"⚠️ Error checking auth selector {selector}: {ex.Message}");
                    }
                }

                // Check for logout indicators in URL
                try
                {
                    var currentUrl = await browserSession.GetUrlAsync();
                    if (currentUrl.Contains("post_logout") || currentUrl.Contains("logout_reason"))
                    {
                        _notifier.Notify("🔐 Logout detected during monitoring - session needs authentication");
                        return MessageDeliveryResult.PendingQR("WhatsApp session expired. Please scan QR code.");
                    }
                }
                catch (Exception ex)
                {
                    _notifier.Notify($"⚠️ Error checking URL during monitoring: {ex.Message}");
                }

                return null; // No issues detected
            }
            catch (Exception ex)
            {
                _notifier.Notify($"⚠️ Error in continuous monitoring: {ex.Message}");
                return null;
            }
        }

        public async Task<bool> SendMessageAsync(string phoneNumber, string message)
        {
            // initialize session for each SendMessageAsync call
            var browserSession = _browserSessionFactory();
            await _whatsappService.PrepareSessionAsync(browserSession);
            var result = await _whatsappService.ExecuteWithRetryAsync(() => _whatsappService.SendMessageWithIconTypeAsync(phoneNumber, message, browserSession),
                maxAttempts: 3,
                treatAsRetryable: ex => ex.Message.Contains("net::ERR_NAME_NOT_RESOLVED") || ex.Message.Contains("net::ERR_INTERNET_DISCONNECTED") || ex.Message.Contains("Navigation failed"));
            if (!result.Sent && !string.IsNullOrEmpty(result.Error))
            {
                _notifier.Notify(result.Error);
            }
            await _whatsappService.DisposeBrowserSessionAsync(browserSession);
            return result.Sent;
        }

        public async Task<List<MessageSendResult>> SendMessagesAsync(string phoneNumber, IEnumerable<string> messages)
        {
            // initialize session for each SendMessageAsync call
            var browserSession = _browserSessionFactory();
            await _whatsappService.PrepareSessionAsync(browserSession);
            bool allSent = true;
            var results = new List<MessageSendResult>();
            foreach (var message in messages)
            {
                var result = await _whatsappService.ExecuteWithRetryAsync(() => _whatsappService.SendMessageWithIconTypeAsync(phoneNumber, message, browserSession),
        maxAttempts: 3,
        treatAsRetryable: ex => ex.Message.Contains("net::ERR_NAME_NOT_RESOLVED") || ex.Message.Contains("net::ERR_INTERNET_DISCONNECTED") || ex.Message.Contains("Navigation failed"));
                if (!result.Sent && !string.IsNullOrEmpty(result.Error))
                {
                    _notifier.Notify(result.Error);
                }
                else
                {
                    _notifier.Notify($"Message sent to {phoneNumber}: {message}");
                    results.Add(new MessageSendResult
                    {
                        Phone = phoneNumber,
                        Message = message,
                        Sent = result.Sent,
                        Error = result.Error,
                        IconType = result.IconType
                    });
                }
                allSent = allSent && result.Sent;
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