using ClinicsManagementService.Configuration;
using ClinicsManagementService.Models;
using ClinicsManagementService.Services.Domain;
using ClinicsManagementService.Services.Interfaces;
using Microsoft.Playwright;
using System;
using System.Linq;
using System.Threading.Tasks;
using System.Threading;

namespace ClinicsManagementService.Services.Application
{
    // Note: removed AsyncExecutionHelper; call sites use explicit try/catch now.

    public class WhatsAppMessageSender : IMessageSender
    {
        private readonly IWhatsAppService _whatsappService;
        private readonly Func<int, IBrowserSession> _browserSessionFactory;
        private readonly INotifier _notifier;
        private readonly IRetryService _retryService;
        private readonly IWhatsAppSessionManager _sessionManager;
        private readonly IWhatsAppUIService _whatsappUIService;
        public WhatsAppMessageSender(IWhatsAppService whatsappService, Func<int, IBrowserSession> browserSessionFactory, INotifier notifier, IRetryService retryService, IWhatsAppSessionManager sessionManager, IWhatsAppUIService whatsappUIService)
        {
            _whatsappService = whatsappService;
            _browserSessionFactory = browserSessionFactory;
            _notifier = notifier;
            _retryService = retryService;
            _sessionManager = sessionManager;
            _whatsappUIService = whatsappUIService;
        }

        // Send multiple phone/message pairs with random throttling between each send, returning MessageSendResult for each.
        public async Task<List<MessageSendResult>> SendBulkWithThrottlingAsync(int moderatorUserId, IEnumerable<(string Phone, string Message)> items, int minDelayMs, int maxDelayMs)
        {
            _notifier.Notify("Starting bulk send process...");
            var results = new List<MessageSendResult>();
            bool networkErrorOccurred = false;
            string? networkErrorMessage = null;
            int total = items.Count();
            int counter = 1;

            var browserSession = _browserSessionFactory(moderatorUserId);
            browserSession = await _sessionManager.GetOrCreateSessionAsync(moderatorUserId);

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
                MessageSendResult result;
                try
                {
                    var deliveryResult = await _retryService.ExecuteWithRetryAsync<string?>(
                        async () =>
                        {
                            var session = _browserSessionFactory(moderatorUserId);
                            session = await _sessionManager.GetOrCreateSessionAsync(moderatorUserId);
                            try
                            {
                                return await _whatsappService.SendMessageWithIconTypeAsync(item.Phone, item.Message, session);
                            }
                            finally
                            {
                                await _whatsappService.DisposeBrowserSessionAsync(session);
                            }
                        },
                        maxAttempts: 3,
                        shouldRetryResult: r => r?.IsWaiting() == true || r?.IsPendingNet() == true,
                        isRetryable: ex => ex.Message.Contains("net::ERR_NAME_NOT_RESOLVED") || ex.Message.Contains("net::ERR_INTERNET_DISCONNECTED") || ex.Message.Contains("Navigation failed"));

                    result = new MessageSendResult
                    {
                        Phone = item.Phone,
                        Message = item.Message,
                        Sent = deliveryResult.IsSuccess == true,
                        Error = deliveryResult.ResultMessage,
                        IconType = deliveryResult.Data,
                        Status = DetermineStatus(deliveryResult.IsSuccess == true, deliveryResult.ResultMessage)
                    };
                }
                catch (Exception ex)
                {
                    _notifier.Notify($"⚠️ Error in SendMessageWithIconTypeAsync for {item.Phone}: {ex.Message}");
                    result = new MessageSendResult { Phone = item.Phone, Message = item.Message, Sent = false, Error = "Unknown error", IconType = null, Status = MessageOperationStatus.Failure };
                }
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
                    OperationResult<bool>? monitoringResult = null;
                    try
                    {
                        monitoringResult = await _whatsappUIService.ContinuousMonitoringAsync(browserSession, delay);
                    }
                    catch (Exception ex)
                    {
                        _notifier.Notify($"⚠️ Error during ContinuousMonitoringAsync for {item.Phone}: {ex.Message}");
                        monitoringResult = null;
                    }
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

        public async Task<bool> SendMessageAsync(int moderatorUserId, string phoneNumber, string message, CancellationToken cancellationToken = default)
        {
            // Check cancellation before starting
            cancellationToken.ThrowIfCancellationRequested();

            var browserSession = _browserSessionFactory(moderatorUserId);
            OperationResult<string?> deliveryResult;
            
            try
            {
                // REMOVED RETRY LOGIC: Call SendMessageWithIconTypeAsync directly without retry wrapper
                // This allows immediate detection of PendingQR/PendingNET/BrowserClosure errors
                browserSession = await _sessionManager.GetOrCreateSessionAsync(moderatorUserId);
                try
                {
                    // Check cancellation before sending
                    cancellationToken.ThrowIfCancellationRequested();

                    deliveryResult = await _whatsappService.SendMessageWithIconTypeAsync(phoneNumber, message, browserSession, cancellationToken);
                }
                finally
                {
                    // Check cancellation before disposing
                    if (!cancellationToken.IsCancellationRequested)
                    {
                        await _whatsappService.DisposeBrowserSessionAsync(browserSession);
                    }
                }
            }
            catch (OperationCanceledException)
            {
                // Browser closed or operation cancelled - this is BrowserClosure
                _notifier.Notify($"⚠️ [SEND-SINGLE] Operation cancelled (BrowserClosure) for moderator {moderatorUserId}");
                
                // Get coordinator to pause global WhatsAppSession
                // Note: coordinator should be injected, but for now we'll throw a special exception
                // that will be caught in BulkMessagingController
                throw new OperationCanceledException("BrowserClosure: Browser closed or operation cancelled");
            }
            catch (Exception ex) when (IsBrowserClosedException(ex))
            {
                // Browser closed exception - this is BrowserClosure
                _notifier.Notify($"⚠️ [SEND-SINGLE] Browser closed (BrowserClosure) for moderator {moderatorUserId}: {ex.Message}");
                throw new InvalidOperationException("BrowserClosure: Browser session terminated", ex);
            }
            catch (Exception ex)
            {
                _notifier.Notify($"⚠️ [SEND-SINGLE] Unexpected error for moderator {moderatorUserId}: {ex.Message}");
                throw; // Re-throw to be handled by caller
            }

            // Check for PendingQR, PendingNET, or other errors immediately (no retry)
            if (deliveryResult.IsPendingQr())
            {
                _notifier.Notify($"❌ [SEND-SINGLE] PendingQR detected for moderator {moderatorUserId}: {deliveryResult.ResultMessage}");
                // Throw special exception that will be caught in BulkMessagingController
                throw new InvalidOperationException($"PendingQR: {deliveryResult.ResultMessage ?? "WhatsApp authentication required"}");
            }
            
            if (deliveryResult.IsPendingNet())
            {
                _notifier.Notify($"❌ [SEND-SINGLE] PendingNET detected for moderator {moderatorUserId}: {deliveryResult.ResultMessage}");
                // Throw special exception that will be caught in BulkMessagingController
                throw new InvalidOperationException($"PendingNET: {deliveryResult.ResultMessage ?? "Internet connection unavailable"}");
            }

            // Success case
            if (deliveryResult.IsSuccess == true)
            {
                _notifier.Notify($"✅ [SEND-SINGLE] Message sent successfully to {phoneNumber}");
                return true;
            }

            // Generic failure
            _notifier.Notify($"❌ [SEND-SINGLE] Message failed to send to {phoneNumber}: {deliveryResult.ResultMessage}");
            return false;
        }

        public async Task<List<MessageSendResult>> SendMessagesAsync(int moderatorUserId, string phoneNumber, IEnumerable<string> messages)
        {
            var browserSession = _browserSessionFactory(moderatorUserId);
            // browserSession = await _sessionManager.GetOrCreateSessionAsync();
            var results = new List<MessageSendResult>();
            foreach (var message in messages)
            {
                MessageSendResult result;
                try
                {
                    var deliveryResult = await _retryService.ExecuteWithRetryAsync(
                        async () =>
                        {
                            browserSession = await _sessionManager.GetOrCreateSessionAsync(moderatorUserId);
                            try
                            {
                                return await _whatsappService.SendMessageWithIconTypeAsync(phoneNumber, message, browserSession);
                            }
                            finally
                            {
                                await _whatsappService.DisposeBrowserSessionAsync(browserSession);
                            }
                        },
                        maxAttempts: WhatsAppConfiguration.DefaultMaxRetryAttempts,
                        shouldRetryResult: r => r?.IsWaiting() == true || r?.IsPendingNet() == true,
                        isRetryable: ex => ex.Message.Contains("net::ERR_NAME_NOT_RESOLVED") || ex.Message.Contains("net::ERR_INTERNET_DISCONNECTED") || ex.Message.Contains("Navigation failed"));

                    result = new MessageSendResult
                    {
                        Phone = phoneNumber,
                        Message = message,
                        Sent = deliveryResult.IsSuccess == true,
                        Error = deliveryResult.ResultMessage,
                        IconType = deliveryResult.Data,
                        Status = DetermineStatus(deliveryResult.IsSuccess == true, deliveryResult.ResultMessage)
                    };
                }
                catch (Exception ex)
                {
                    _notifier.Notify($"⚠️ Error in SendMessageWithIconTypeAsync for {phoneNumber}: {ex.Message}");
                    result = new MessageSendResult { Phone = phoneNumber, Message = message, Sent = false, Error = "Unknown error", IconType = null, Status = MessageOperationStatus.Failure };
                }
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
                return MessageOperationStatus.Success;
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

            return MessageOperationStatus.Failure;
        }

        /// <summary>
        /// Helper method to detect browser closed exceptions
        /// </summary>
        private bool IsBrowserClosedException(Exception ex)
        {
            if (ex == null) return false;
            
            var message = ex.Message?.ToLower() ?? "";
            var innerMessage = ex.InnerException?.Message?.ToLower() ?? "";
            
            return message.Contains("browser") && message.Contains("closed") ||
                   message.Contains("target closed") ||
                   message.Contains("session closed") ||
                   message.Contains("browserclosure") ||
                   innerMessage.Contains("browser") && innerMessage.Contains("closed") ||
                   innerMessage.Contains("target closed") ||
                   innerMessage.Contains("session closed") ||
                   innerMessage.Contains("browserclosure");
        }
    }
}