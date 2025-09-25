using ClinicsManagementService.Models;
using ClinicsManagementService.Services.Interfaces;
namespace ClinicsManagementService.Services.Application
{

    public class WhatsAppMessageSender : IMessageSender
    {
        private readonly IWhatsAppService _whatsappService;
        private readonly Func<IBrowserSession> _browserSessionFactory;
        private readonly INotifier _notifier;
        const string sessionDir = "whatsapp-session";

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
            await _whatsappService.PrepareSessionAsync(sessionDir, browserSession);

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
                        Error = networkErrorMessage ?? "Pending: Internet connection unavailable.",
                        IconType = null
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
                    IconType = result.IconType
                });
                if (!result.Sent && result.Error != null &&
                    (result.Error.Contains("net::ERR_NAME_NOT_RESOLVED") || result.Error.Contains("net::ERR_INTERNET_DISCONNECTED") || result.Error.Contains("Navigation failed")))
                {
                    networkErrorOccurred = true;
                    networkErrorMessage = "Pending: Internet connection unavailable. " + result.Error;
                    _notifier.Notify($"[{counter + 1}/{total}] Network error detected: {networkErrorMessage}"); // only for logging using notify
                }
                // Only throttle if not the last message
                if (counter < total)
                {
                    int delay = Random.Shared.Next(minDelayMs, maxDelayMs + 1);
                    _notifier.Notify($"[{counter + 1}/{total}] Throttling for {delay}ms before next send..."); // only for logging using notify
                    await Task.Delay(delay);
                }
                counter++; // only for logging using notify
            }
            // Dispose browser session after bulk sending
            await _whatsappService.DisposeBrowserSessionAsync(browserSession);
            _notifier.Notify("Bulk send process completed."); // only for logging using notify
            return results;
        }

        public async Task<bool> SendMessageAsync(string phoneNumber, string message)
        {
            // initialize session for each SendMessageAsync call
            var browserSession = _browserSessionFactory();
            await _whatsappService.PrepareSessionAsync(sessionDir, browserSession);
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
            await _whatsappService.PrepareSessionAsync(sessionDir, browserSession);
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
    }
}