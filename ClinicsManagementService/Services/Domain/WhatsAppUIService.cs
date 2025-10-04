using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.Models;
using ClinicsManagementService.Configuration;
using Microsoft.Playwright;
using System;
using System.Linq;
using System.Threading.Tasks;

namespace ClinicsManagementService.Services.Domain
{
    /// <summary>
    /// Handles WhatsApp UI interactions and element detection
    /// </summary>
    public class WhatsAppUIService : IWhatsAppUIService
    {
        private readonly INotifier _notifier;
        private readonly IScreenshotService _screenshotService;

        public WhatsAppUIService(INotifier notifier, IScreenshotService screenshotService)
        {
            _notifier = notifier;
            _screenshotService = screenshotService;
        }

        /*
        Use this when:
            You need a more general-purpose error handler
            The operation can safely return a default value on failure
            You want simpler error handling without cancellation
            The operation is non-critical or can be retried safely 
        */          
        public async Task<T> TryExecuteAsync<T>(Func<Task<T>> operation, T defaultValue, string operationName)
        {
            try
            {
                return await operation();
            }
            catch (Exception ex) when (IsBrowserClosedException(ex))
            {
                _notifier.Notify($"⚠️ Error in {operationName}: Browser was closed");
                return defaultValue;
            }
            catch (Exception ex)
            {
                _notifier.Notify($"⚠️ Error in {operationName}: {ex.Message}");
                return defaultValue;
            }
        }

        public bool IsBrowserClosedException(Exception ex)
        {
            return ex is PlaywrightException pex &&
                   (pex.Message.Contains("Target page, context or browser has been closed") ||
                    pex.Message.Contains("Browser has been disconnected"));
        }

        public async Task WaitForUIReadyAsync(IBrowserSession browserSession)
        {
            await WaitForProgressBarsToDisappearAsync(browserSession);
            await WaitForUIElementsAsync(browserSession);
        }

        /// <summary>
        /// Continuous monitoring for progress bars and authentication issues
        /// This method runs as a side job to interrupt waiting operations
        /// </summary>
        private async Task<MessageDeliveryResult?> ContinuousMonitoringAsync(IBrowserSession browserSession, int timeoutMs = 5000)
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

                            // Wait for progress bar to disappear with shorter timeout
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

                // Check for authentication issues
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

        /// <summary>
        /// Enhanced waiting with continuous monitoring for progress bars and authentication
        /// </summary>
        private async Task<MessageDeliveryResult?> WaitWithMonitoringAsync(IBrowserSession browserSession, Func<Task<bool>> waitCondition, int timeoutMs = 15000, int checkIntervalMs = 2000)
        {
            return await TryExecuteAsync(async () =>
            {
                var startTime = DateTime.UtcNow;
                var timeout = TimeSpan.FromMilliseconds(timeoutMs);

                while (DateTime.UtcNow - startTime < timeout)
                {
                    // Check the main wait condition
                    try
                    {
                        if (await waitCondition())
                        {
                            return null; // Success
                        }
                    }
                    catch (Exception ex)
                    {
                        _notifier.Notify($"⚠️ Wait condition error: {ex.Message}");
                    }

                    var monitoringResult = await ContinuousMonitoringAsync(browserSession, checkIntervalMs);
                    if (monitoringResult != null)
                        return monitoringResult;

                    // Wait before next check
                    await Task.Delay(checkIntervalMs);
                }

                _notifier.Notify($"⏰ Wait timeout after {timeoutMs}ms");
                return null; // Timeout
            }, null, "WaitWithMonitoringAsync");
        }

        public async Task<NavigationResult> NavigateToRecipientAsync(IBrowserSession browserSession, string phoneNumber)
        {
            _notifier.Notify($"🌐 Starting navigation to recipient: {phoneNumber}");

            try
            {
                // Step 1: Construct URL
                var url = $"{WhatsAppConfiguration.WhatsAppSendUrl + phoneNumber}";
                _notifier.Notify($"🔗 Navigation URL: {url}");

                // Step 2: Navigate to URL
                _notifier.Notify("🚀 Initiating navigation...");
                await browserSession.NavigateToAsync(url);
                _notifier.Notify("✅ Navigation request sent");

                // Step 3: Wait for page to load with continuous monitoring
                _notifier.Notify("⏳ Waiting for page to load...");
                MessageDeliveryResult? waitResult = await WaitWithMonitoringAsync(browserSession, async () =>
                {
                    // Check for any UI-ready selectors or input fields
                    foreach (var selector in WhatsAppConfiguration.ChatUIReadySelectors.Concat(WhatsAppConfiguration.ChatUIReadySelectors))
                    {
                        var elem = await browserSession.QuerySelectorAsync(selector);
                        if (elem != null)
                            return true;
                    }
                    return false;
                }, 5000, 500);

                if (waitResult != null)
                    return NavigationResult.CreateFailure(waitResult.Error ?? "Navigation interrupted by authentication or progress bar");

                // Step 4: Check for error dialogs with continuous monitoring
                _notifier.Notify("🔍 Checking for error dialogs...");
                var errorWaitResult = await WaitWithMonitoringAsync(browserSession, async () =>
                {
                    foreach (var selector in WhatsAppConfiguration.ErrorDialogSelectors)
                    {
                        var errorDialog = await browserSession.QuerySelectorAsync(selector);
                        if (errorDialog != null)
                            return true;
                    }
                    return false;
                }, 3000, 500);

                if (errorWaitResult != null)
                    return NavigationResult.CreateFailure(errorWaitResult.Error ?? "Error dialog check interrupted by authentication or progress bar");

                foreach (var selector in WhatsAppConfiguration.ErrorDialogSelectors)
                {
                    var errorDialog = await browserSession.QuerySelectorAsync(selector);
                    if (errorDialog != null)
                    {
                        _notifier.Notify("❌ Error dialog detected");
                        var result = await HandleErrorDialogAsync(errorDialog);
                        _notifier.Notify($"📋 Error dialog result: {result.Success} - {result.Error}");
                        return result;
                    }
                }

                // Step 5: Verify navigation success
                _notifier.Notify("✅ Checking navigation success...");
                var currentUrl = await browserSession.GetUrlAsync();
                _notifier.Notify($"📍 Current URL: {currentUrl}");

                // Check for logout indicators in URL
                if (currentUrl.Contains("post_logout") || currentUrl.Contains("logout_reason"))
                {
                    _notifier.Notify("🚪 WhatsApp session expired (logout detected in URL).");
                    return NavigationResult.CreateFailure("Session expired: WhatsApp logged out. Please restart the service.");
                }

                if (currentUrl.Contains(phoneNumber))
                {
                    _notifier.Notify("✅ Navigation successful - phone number found in URL");
                    return NavigationResult.CreateSuccess();
                }
                else
                {
                    _notifier.Notify("⚠️ Navigation may not have completed properly");
                    return NavigationResult.CreateSuccess(); // Still proceed, might be a timing issue
                }
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Navigation failed with exception: {ex.Message}");
                return NavigationResult.CreateFailure($"Navigation failed: {ex.Message}");
            }
        }

        public async Task<MessageDeliveryResult> DeliverMessageAsync(IBrowserSession browserSession, string message, string? phoneNumber = null)
        {
            _notifier.Notify($"🚀 Starting message delivery task for phone: {phoneNumber ?? "N/A"}");
            _notifier.Notify($"📝 Message content: {message}");

            int msgTimeRetries = 0;
            int msgTimeoutRetries = 0;
            const int msgTimeRetryCount = 3;
            const int maxMsgTimeoutRetryCount = 3;

        timeoutRetry:
            try
            {
                _notifier.Notify("Delivering message...");

                // Wait for UI elements to be ready with continuous monitoring
                var uiWaitResult = await WaitWithMonitoringAsync(browserSession, async () =>
                {
                    foreach (var selector in WhatsAppConfiguration.ChatUIReadySelectors)
                    {
                        var header = await browserSession.QuerySelectorAsync(selector);
                        if (header != null)
                        {
                            foreach (var inputSelector in WhatsAppConfiguration.InputFieldSelectors)
                            {
                                var input = await browserSession.QuerySelectorAsync(inputSelector);
                                if (input != null)
                                    return true;
                            }
                        }
                    }
                    return false;
                }, 20000, 1000);

                if (uiWaitResult != null)
                    return uiWaitResult;

                IElementHandle? input = null;
                foreach (var inputSelector in WhatsAppConfiguration.InputFieldSelectors)
                {
                    input = await browserSession.QuerySelectorAsync(inputSelector);
                    if (input != null)
                        break;
                }

                if (input is null)
                {
                    _notifier.Notify("Message input box not found.");
                    return MessageDeliveryResult.Failure("Message input box not found.");
                }

                await input.FocusAsync();
                await input.FillAsync(message);

                // Send button selector from configuration
                IElementHandle? sendButton = null;
                foreach (var sendSelector in WhatsAppConfiguration.SendButtonSelectors)
                {
                    sendButton = await browserSession.QuerySelectorAsync(sendSelector);
                    if (sendButton != null)
                        break;
                }

                if (sendButton != null)
                {
                    _notifier.Notify("Clicking send button...");
                    await sendButton.ClickAsync();
                }
                else
                {
                    _notifier.Notify("Send button not found, pressing Enter...");
                    await input.PressAsync("Enter");
                }

                var maxWaitMs = 15000; // 15 seconds
                var pollIntervalMs = 1000; // 1 second

                while (true)
                {
                    int elapsed = 0;
                    bool sent = false;
                    string? iconType = null;

                    while (elapsed < maxWaitMs)
                    {
                        // Run continuous monitoring during status polling
                        var monitoringResult = await ContinuousMonitoringAsync(browserSession, pollIntervalMs);
                        if (monitoringResult != null)
                        {
                            return monitoringResult; // Authentication or progress bar issue detected
                        }

                        var statusResult = await GetLastOutgoingMessageStatusAsync(browserSession, message);
                        iconType = statusResult.IconType;
                        _notifier.Notify($"Polling message status: iconType={iconType}, elapsed={elapsed}ms");

                        if (iconType != null)
                        {
                            if (iconType == "msg-check" || iconType == "msg-dblcheck")
                            {
                                sent = true;
                                _notifier.Notify($"Message sent successfully: iconType={iconType}");
                                break;
                            }
                            else if (iconType == "msg-time")
                            {
                                _notifier.Notify($"Message still pending (msg-time), waiting...");
                            }
                            else
                            {
                                _notifier.Notify($"Unexpected iconType: {iconType}");
                                string screenshotPath = $"Screenshots/unexpected_icon_{iconType}_{DateTime.Now:yyyyMMdd_HHmmss}.png";
                                await _screenshotService.TakeScreenshotAsync(browserSession, screenshotPath);
                                _notifier.Notify($"Screenshot taken for unexpected icon: {screenshotPath}");
                                await Task.Delay(pollIntervalMs);
                                continue;
                            }
                        }
                        else
                        {
                            _notifier.Notify("Status icon for sent message not found, polling again...");
                        }

                        await Task.Delay(pollIntervalMs);
                        elapsed += pollIntervalMs;
                    }

                    // If no status icon found after polling, use existing retry logic
                    if (iconType == null || iconType == "")
                    {
                        _notifier.Notify("No status icon found after polling - using existing retry logic");
                        msgTimeoutRetries++;
                        if (msgTimeoutRetries >= maxMsgTimeoutRetryCount)
                        {
                            _notifier.Notify($"❌ Max retries reached ({maxMsgTimeoutRetryCount}). Aborting.");
                            return MessageDeliveryResult.Failure($"Failed: No status icon found after {maxMsgTimeoutRetryCount} retries");
                        }

                        _notifier.Notify($"🔄 Retrying full task (attempt {msgTimeoutRetries}/{maxMsgTimeoutRetryCount})...");
                        msgTimeRetries = msgTimeoutRetries; // sync retry counters
                        goto timeoutRetry;
                    }

                    // Final extra wait if still pending with continuous monitoring
                    if (!sent && iconType == "msg-time")
                    {
                        _notifier.Notify("Final extra wait for msg-time status...");
                        var extraWaitResult = await WaitWithMonitoringAsync(browserSession, async () =>
                        {
                            var statusResult = await GetLastOutgoingMessageStatusAsync(browserSession, message);
                            return statusResult.IconType == "msg-check" || statusResult.IconType == "msg-dblcheck";
                        }, 15000, 1000);

                        if (extraWaitResult != null)
                        {
                            return extraWaitResult; // Authentication or progress bar issue detected
                        }

                        var statusResult = await GetLastOutgoingMessageStatusAsync(browserSession, message);
                        iconType = statusResult.IconType;
                        if (iconType == "msg-check" || iconType == "msg-dblcheck")
                        {
                            sent = true;
                            _notifier.Notify($"Message sent after extra wait: iconType={iconType}");
                        }
                    }

                    // Only mark as sent if iconType is msg-check or msg-dblcheck
                    if (sent && (iconType == "msg-check" || iconType == "msg-dblcheck"))
                    {
                        _notifier.Notify("DeliverMessageAsync completed: message sent.");
                        return MessageDeliveryResult.Success(iconType);
                    }

                    // If not sent and iconType is msg-time, try retry logic
                    if (!sent && iconType == "msg-time" && msgTimeRetries < msgTimeRetryCount)
                    {
                        msgTimeRetries++;
                        msgTimeoutRetries = msgTimeRetries; // sync msgTimeoutRetries to msgTimeRetries to avoid infinite retries
                        _notifier.Notify($"msg-time retry #{msgTimeRetries} of {msgTimeRetryCount}...");

                        // Re-navigate to chat if phoneNumber is provided with continuous monitoring
                        if (!string.IsNullOrEmpty(phoneNumber))
                        {
                            _notifier.Notify($"🔄 Re-navigating to chat for full retry: {phoneNumber}");
                            await browserSession.NavigateToAsync($"{WhatsAppConfiguration.WhatsAppSendUrl + phoneNumber}");

                            var reNavWaitResult = await WaitWithMonitoringAsync(browserSession, async () =>
                            {
                                foreach (var selector in WhatsAppConfiguration.ChatUIReadySelectors)
                                {
                                    var header = await browserSession.QuerySelectorAsync(selector);
                                    if (header != null)
                                    {
                                        foreach (var inputSelector in WhatsAppConfiguration.InputFieldSelectors)
                                        {
                                            var input = await browserSession.QuerySelectorAsync(inputSelector);
                                            if (input != null)
                                                return true;
                                        }
                                    }
                                }
                                return false;
                            }, 20000, 1000);

                            if (reNavWaitResult != null)
                            {
                                return reNavWaitResult; // Authentication or progress bar issue detected
                            }

                            _notifier.Notify("✅ Re-navigated to chat for full retry.");
                        }

                        // Retry the full message delivery task instead of trying to click retry buttons
                        _notifier.Notify("🔄 Retrying full message delivery task...");
                        continue;
                    }

                    // Otherwise, not sent
                    if (msgTimeRetries == msgTimeRetryCount)
                    {
                        _notifier.Notify($"Message failed after {msgTimeRetries} msg-time retries.");
                        break;
                    }

                    _notifier.Notify("Message not sent yet, re-checking...");
                }
            }
            catch (TimeoutException ex)
            {
                _notifier.Notify($"⏰ TimeoutException in DeliverMessageAsync: {ex.Message}");

                // Check internet connectivity after timeout
                var networkService = new NetworkService(_notifier);
                if (!await networkService.CheckInternetConnectivityAsync())
                {
                    _notifier.Notify("❌ Internet connectivity lost during timeout.");
                    return MessageDeliveryResult.PendingNET("Internet connection unavailable");
                }

                // Check current URL for logout indicators
                try
                {
                    var currentUrl = await browserSession.GetUrlAsync();
                    _notifier.Notify($"🔍 Current URL after timeout: {currentUrl}");

                    if (currentUrl.Contains("post_logout") || currentUrl.Contains("logout_reason"))
                    {
                        _notifier.Notify("🚪 WhatsApp session expired (logout detected). Need to restart authentication.");
                        return MessageDeliveryResult.Failure("Session expired: WhatsApp logged out. Please restart the service.");
                    }
                }
                catch (Exception urlEx)
                {
                    _notifier.Notify($"⚠️ Could not get current URL: {urlEx.Message}");
                }

                // Enhanced progress bar handling (from BeforeSOLID project)
                await HandleProgressBarsAsync(browserSession);

                // Check for QR code login page after progress bar
                bool qrCodeDetected = false;
                foreach (var selector in WhatsAppConfiguration.QrCodeSelectors)
                {
                    try
                    {
                        var qrElement = await browserSession.QuerySelectorAsync(selector);
                        if (qrElement != null)
                        {
                            _notifier.Notify($"🔐 QR code login page detected ({selector}). Session expired.");
                            qrCodeDetected = true;
                            break;
                        }
                    }
                    catch { /* ignore errors */ }
                }

                if (qrCodeDetected)
                {
                    _notifier.Notify("🚪 WhatsApp session expired (QR code detected). Authentication required.");
                    return MessageDeliveryResult.PendingQR("WhatsApp authentication required. Please scan QR code.");
                }

                // Check for chat list UI to ensure we're in the right state
                bool chatListFound = false;
                foreach (var selector in WhatsAppConfiguration.ChatUIReadySelectors)
                {
                    try
                    {
                        var chatElement = await browserSession.QuerySelectorAsync(selector);
                        if (chatElement != null)
                        {
                            _notifier.Notify($"💬 Chat list UI found ({selector}). Proceeding with retry.");
                            chatListFound = true;
                            break;
                        }
                    }
                    catch { /* ignore errors */ }
                }

                if (!chatListFound)
                {
                    _notifier.Notify("⚠️ Chat list UI not found. May need authentication restart.");
                }

                msgTimeoutRetries++;
                if (msgTimeoutRetries == maxMsgTimeoutRetryCount)
                {
                    _notifier.Notify($"❌ Max navigation retries reached ({maxMsgTimeoutRetryCount}). Aborting.");
                    return MessageDeliveryResult.Failure($"Failed: Timeout waiting for WhatsApp UI after {maxMsgTimeoutRetryCount} retries");
                }

                _notifier.Notify($"🔄 Retrying message delivery (attempt {msgTimeoutRetries}/{maxMsgTimeoutRetryCount})...");
                msgTimeRetries = msgTimeoutRetries; // sync msgTimeRetries to msgTimeoutRetries to avoid infinite retries
                goto timeoutRetry;
            }
            catch (Exception ex)
            {
                _notifier.Notify($"Exception in DeliverMessageAsync: {ex.Message}");

                // Check if it's a fatal exception that should crash the system
                if (IsFatalException(ex))
                {
                    _notifier.Notify($"🚨 FATAL EXCEPTION DETECTED: {ex.Message}");
                    _notifier.Notify("🛡️ Attempting graceful recovery to prevent system crash...");

                    try
                    {
                        // Attempt graceful recovery
                        var recoveryResult = await AttemptGracefulRecovery(browserSession, ex, phoneNumber);
                        if (recoveryResult != null)
                        {
                            return recoveryResult;
                        }
                    }
                    catch (Exception recoveryEx)
                    {
                        _notifier.Notify($"⚠️ Graceful recovery failed: {recoveryEx.Message}");
                    }

                    // If recovery fails, return a safe failure instead of crashing
                    return MessageDeliveryResult.Failure($"Failed: Fatal exception handled gracefully - {ex.GetType().Name}");
                }

                // Treat non-fatal exceptions as timeouts with full timeout handling
                _notifier.Notify($"🔄 Treating non-fatal exception as timeout: {ex.GetType().Name}");

                // Check internet connectivity for unhandled exceptions
                var networkService = new NetworkService(_notifier);
                if (!await networkService.CheckInternetConnectivityAsync())
                {
                    _notifier.Notify("❌ Internet connectivity lost during exception.");
                    return MessageDeliveryResult.PendingNET("Internet connection unavailable");
                }

                // Check current URL for logout indicators
                try
                {
                    var currentUrl = await browserSession.GetUrlAsync();
                    _notifier.Notify($"🔍 Current URL after exception: {currentUrl}");

                    if (currentUrl.Contains("post_logout") || currentUrl.Contains("logout_reason"))
                    {
                        _notifier.Notify("🚪 WhatsApp session expired (logout detected). Need to restart authentication.");
                        return MessageDeliveryResult.PendingQR("WhatsApp authentication required. Please scan QR code.");
                    }
                }
                catch (Exception urlEx)
                {
                    _notifier.Notify($"⚠️ Could not get current URL: {urlEx.Message}");
                }

                // Enhanced progress bar handling (from BeforeSOLID project)
                await HandleProgressBarsAsync(browserSession);

                // Check for QR code login page after progress bar
                bool qrCodeDetected = false;
                foreach (var selector in WhatsAppConfiguration.QrCodeSelectors)
                {
                    try
                    {
                        var qrElement = await browserSession.QuerySelectorAsync(selector);
                        if (qrElement != null)
                        {
                            _notifier.Notify($"🔐 QR code login page detected ({selector}). Session expired.");
                            qrCodeDetected = true;
                            break;
                        }
                    }
                    catch { /* ignore errors */ }
                }

                if (qrCodeDetected)
                {
                    _notifier.Notify("🚪 WhatsApp session expired (QR code detected). Authentication required.");
                    return MessageDeliveryResult.PendingQR("WhatsApp authentication required. Please scan QR code.");
                }

                // Check for chat list UI to ensure we're in the right state
                bool chatListFound = false;
                foreach (var selector in WhatsAppConfiguration.ChatUIReadySelectors)
                {
                    try
                    {
                        var chatElement = await browserSession.QuerySelectorAsync(selector);
                        if (chatElement != null)
                        {
                            _notifier.Notify($"💬 Chat list UI found ({selector}). Proceeding with retry.");
                            chatListFound = true;
                            break;
                        }
                    }
                    catch { /* ignore errors */ }
                }

                if (!chatListFound)
                {
                    _notifier.Notify("⚠️ Chat list UI not found. May need authentication restart.");
                }

                // For any non-fatal exception, restart the entire task from timeoutRetry
                _notifier.Notify($"🔄 Non-fatal exception detected: {ex.GetType().Name} - restarting entire task");

                msgTimeoutRetries++;
                if (msgTimeoutRetries >= maxMsgTimeoutRetryCount)
                {
                    _notifier.Notify($"❌ Max exception retries reached ({maxMsgTimeoutRetryCount}). Aborting.");
                    return MessageDeliveryResult.Failure($"Failed: Exception handling after {maxMsgTimeoutRetryCount} retries");
                }

                _notifier.Notify($"🔄 Restarting entire task after exception (attempt {msgTimeoutRetries}/{maxMsgTimeoutRetryCount})...");
                msgTimeRetries = msgTimeoutRetries; // sync msgTimeRetries to msgTimeoutRetries to avoid infinite retries
                goto timeoutRetry;
            }

            return MessageDeliveryResult.Failure("Failed to send message for unknown reasons.");
        }

        // Removed retry button helper methods - now using full task retry instead

        /// <summary>
        /// Enhanced progress bar handling based on BeforeSOLID project logic
        /// </summary>
        private async Task HandleProgressBarsAsync(IBrowserSession browserSession)
        {
            _notifier.Notify("🔍 Checking for progress bars and loading indicators...");

            // Multiple progress bar selectors (from BeforeSOLID project)
            foreach (var progressSelector in WhatsAppConfiguration.ProgressBarSelectors)
            {
                try
                {
                    var progress = await browserSession.QuerySelectorAsync(progressSelector);
                    if (progress != null)
                    {
                        _notifier.Notify($"⏳ Progress/loading bar detected ({progressSelector}), waiting for it to disappear...");

                        try
                        {
                            await browserSession.WaitForSelectorAsync(progressSelector, 60000, WaitForSelectorState.Detached);
                            _notifier.Notify($"✅ Progress/loading bar disappeared ({progressSelector})");
                        }
                        catch (Exception progressEx)
                        {
                            _notifier.Notify($"⚠️ Progress bar wait failed for {progressSelector}: {progressEx.Message}");
                        }

                        // After one progress bar disappears, check for others
                        break;
                    }
                }
                catch (Exception ex)
                {
                    _notifier.Notify($"⚠️ Error checking progress selector {progressSelector}: {ex.Message}");
                }
            }

            // Check for loading text indicators
            foreach (var textSelector in WhatsAppConfiguration.ProgressBarSelectors)
            {
                try
                {
                    var loadingElement = await browserSession.QuerySelectorAsync(textSelector);
                    if (loadingElement != null)
                    {
                        var loadingText = await loadingElement.InnerTextAsync();
                        _notifier.Notify($"⏳ Loading text detected: {loadingText}. Please be patient...");

                        // Wait a bit for loading to complete
                        await Task.Delay(2000);
                        break;
                    }
                }
                catch (Exception ex)
                {
                    _notifier.Notify($"⚠️ Error checking loading text {textSelector}: {ex.Message}");
                }
            }

            _notifier.Notify("✅ Progress bar handling completed");
        }

        /// <summary>
        /// Determines if an exception is fatal and should trigger crash prevention
        /// </summary>
        private bool IsFatalException(Exception ex)
        {
            // Fatal exceptions that could crash the system
            var fatalExceptionTypes = new[]
            {
                typeof(OutOfMemoryException),
                typeof(StackOverflowException),
                typeof(AccessViolationException),
                typeof(InvalidProgramException),
                typeof(BadImageFormatException),
                typeof(System.Runtime.InteropServices.SEHException)
            };

            // Check exception type
            if (fatalExceptionTypes.Contains(ex.GetType()))
            {
                return true;
            }

            // Check for fatal error messages
            var fatalMessages = new[]
            {
                "Access violation",
                "Stack overflow",
                "Out of memory",
                "Invalid program",
                "Bad image format",
                "System.Runtime.InteropServices.SEHException",
                "TargetInvocationException",
                "TypeLoadException",
                "MissingMethodException"
            };

            return fatalMessages.Any(msg => ex.Message.Contains(msg, StringComparison.OrdinalIgnoreCase));
        }

        /// <summary>
        /// Attempts graceful recovery from fatal exceptions
        /// </summary>
        private async Task<MessageDeliveryResult?> AttemptGracefulRecovery(IBrowserSession browserSession, Exception ex, string? phoneNumber)
        {
            try
            {
                _notifier.Notify("🔄 Attempting graceful recovery from fatal exception...");

                // Step 1: Check if browser session is still alive
                try
                {
                    var currentUrl = await browserSession.GetUrlAsync();
                    _notifier.Notify($"✅ Browser session alive, current URL: {currentUrl}");
                }
                catch
                {
                    _notifier.Notify("❌ Browser session appears to be dead, cannot recover");
                    return MessageDeliveryResult.Failure("Failed: Browser session terminated due to fatal exception");
                }

                // Step 2: Check internet connectivity
                var networkService = new NetworkService(_notifier);
                if (!await networkService.CheckInternetConnectivityAsync())
                {
                    _notifier.Notify("❌ Internet connectivity lost during fatal exception recovery");
                    return MessageDeliveryResult.PendingNET("Internet connection unavailable");
                }

                // Step 3: Try to navigate to a safe page
                try
                {
                    _notifier.Notify("🔄 Navigating to WhatsApp main page for recovery...");
                    await browserSession.NavigateToAsync(WhatsAppConfiguration.WhatsAppBaseUrl);
                    await Task.Delay(3000); // Give time for page to load
                    _notifier.Notify("✅ Successfully navigated to WhatsApp main page");
                }
                catch (Exception navEx)
                {
                    _notifier.Notify($"⚠️ Navigation recovery failed: {navEx.Message}");
                    return MessageDeliveryResult.Failure("Failed: Navigation recovery failed after fatal exception");
                }

                // Step 4: Check for QR code or authentication issues
                foreach (var selector in WhatsAppConfiguration.QrCodeSelectors)
                {
                    try
                    {
                        var qrElement = await browserSession.QuerySelectorAsync(selector);
                        if (qrElement != null)
                        {
                            _notifier.Notify("🔐 QR code detected during recovery - authentication required");
                            return MessageDeliveryResult.PendingQR("WhatsApp authentication required. Please scan QR code.");
                        }
                    }
                    catch { /* ignore errors */ }
                }

                // Step 5: If we have a phone number, try to navigate to it
                if (!string.IsNullOrEmpty(phoneNumber))
                {
                    try
                    {
                        _notifier.Notify($"🔄 Attempting to navigate to chat for recovery: {phoneNumber}");
                        await browserSession.NavigateToAsync($"{WhatsAppConfiguration.WhatsAppSendUrl + phoneNumber}");
                        await Task.Delay(2000); // Give time for navigation
                        _notifier.Notify("✅ Successfully navigated to chat for recovery");

                        // Return null to continue with normal retry logic
                        return null;
                    }
                    catch (Exception chatNavEx)
                    {
                        _notifier.Notify($"⚠️ Chat navigation recovery failed: {chatNavEx.Message}");
                        return MessageDeliveryResult.Failure("Failed: Chat navigation recovery failed after fatal exception");
                    }
                }

                _notifier.Notify("✅ Graceful recovery completed successfully");
                return null; // Continue with normal retry logic
            }
            catch (Exception recoveryEx)
            {
                _notifier.Notify($"❌ Graceful recovery failed: {recoveryEx.Message}");
                return MessageDeliveryResult.Failure($"Failed: Graceful recovery failed - {recoveryEx.Message}");
            }
        }

        public async Task<MessageStatus> GetLastOutgoingMessageStatusAsync(IBrowserSession browserSession, string messageText)
        {
            _notifier.Notify("🔍 Checking last outgoing message status...");

            try
            {
                // 1. Get all outgoing message elements (iterate all selectors)
                List<IElementHandle> outgoingMessages = new();
                foreach (var outgoingSelector in WhatsAppConfiguration.OutgoingMessageSelectors)
                {
                    var found = await browserSession.QuerySelectorAllAsync(outgoingSelector);
                    if (found != null && found.Count > 0)
                        outgoingMessages.AddRange(found);
                }
                if (outgoingMessages.Count == 0)
                {
                    _notifier.Notify("No outgoing messages found. Using fallback status.");
                    return await GetFallbackStatusAsync(browserSession);
                }

                // 2. Search from latest to oldest for a matching message
                for (int i = outgoingMessages.Count - 1; i >= 0; i--)
                {
                    var msgElem = outgoingMessages[i];

                    // Skip system or non-user messages (by class, iterate all expressions/classes)
                    foreach (var parentClassExpr in WhatsAppConfiguration.ParentClassJsExpressions)
                    {
                        var parentClass = await msgElem.EvaluateAsync<string>(parentClassExpr);
                        foreach (var sysClass in WhatsAppConfiguration.SystemMessageParentClasses)
                        {
                            if (!string.IsNullOrEmpty(parentClass) && parentClass.Contains(sysClass))
                                goto NextMessage;
                        }
                    }
                NextMessage:;

                    // Get the message text (iterate all selectors)
                    string? msgText = null;
                    foreach (var msgTextSelector in WhatsAppConfiguration.OutgoingMessageTextSelectors)
                    {
                        var msgTextElem = await msgElem.QuerySelectorAsync(msgTextSelector);
                        if (msgTextElem != null)
                        {
                            msgText = await msgTextElem.InnerTextAsync();
                            if (!string.IsNullOrWhiteSpace(msgText))
                                break;
                        }
                    }

                    if (!string.IsNullOrWhiteSpace(msgText) && msgText.Trim() == messageText.Trim())
                    {
                        // 3. Find and return the status icon for this message
                        return await FindStatusIconInMessageAsync(msgElem, msgText);
                    }
                }

                // 4. If no match, use fallback
                _notifier.Notify("No matching outgoing message found. Using fallback status.");
                return await GetFallbackStatusAsync(browserSession);
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Exception in GetLastOutgoingMessageStatusAsync: {ex.Message}");
                return MessageStatus.Empty();
            }
        }

        private async Task<MessageStatus> FindStatusIconInMessageAsync(IElementHandle msgElem, string msgText)
        {
            foreach (var statusIconSelector in WhatsAppConfiguration.StatusIconSelectors)
            {
                var statusIcons = await msgElem.QuerySelectorAllAsync(statusIconSelector);
                foreach (var statusIcon in statusIcons)
                {
                    var iconType = await statusIcon.GetAttributeAsync(WhatsAppConfiguration.StatusIconAttribute);
                    if (WhatsAppConfiguration.SupportedStatusIconTypes.Contains(iconType))
                    {
                        _notifier.Notify($"Found status icon: {iconType} for message: '{msgText}'");
                        return MessageStatus.WithIcon(iconType ?? string.Empty, statusIcon);
                    }
                    else if (iconType == WhatsAppConfiguration.TailOutIconType)
                    {
                        // Tail-out icon found, continue searching for actual status icon
                        _notifier.Notify($"Found tail-out icon for message: '{msgText}', searching for actual status icon...");
                    }
                    else
                    {
                        // Unexpected icon type found
                        _notifier.Notify($"Found unexpected iconType: {iconType} for message: '{msgText}'");
                    }
                }
            }
            return MessageStatus.Empty();
        }

        private async Task<MessageStatus> GetFallbackStatusAsync(IBrowserSession browserSession)
        {
            _notifier.Notify("No outgoing message matched, using fallback.");
            IElementHandle? statusIconFallback = null;
            string? iconTypeFallback = null;
            foreach (var fallbackXPath in WhatsAppConfiguration.StatusIconFallbackXPaths)
            {
                statusIconFallback = await browserSession.QuerySelectorAsync(fallbackXPath);
                if (statusIconFallback != null)
                {
                    iconTypeFallback = await statusIconFallback.GetAttributeAsync(WhatsAppConfiguration.StatusIconAttribute);
                    break;
                }
            }

            string fallbackScreenshotPath = $"Screenshots/status_fallback_{DateTime.Now:yyyyMMdd_HHmmss}.png";
            await _screenshotService.TakeScreenshotAsync(browserSession, fallbackScreenshotPath);
            _notifier.Notify($"Screenshot taken for fallback status: {fallbackScreenshotPath}");

            return MessageStatus.WithIcon(iconTypeFallback ?? string.Empty, statusIconFallback);
        }

        private async Task<NavigationResult> HandleErrorDialogAsync(IElementHandle errorDialog)
        {
            var ariaLabel = await errorDialog.GetAttributeAsync(WhatsAppConfiguration.AriaLabelAttribute);
            var dialogText = await errorDialog.InnerTextAsync();
            _notifier.Notify($"Error dialog detected: ariaLabel={ariaLabel}, dialogText={dialogText}");

            if (ariaLabel != null && ariaLabel.Contains("invalid"))
                return NavigationResult.CreateFailure("Invalid phone number format detected.");

            if (dialogText.Contains("Couldn't find this user") || dialogText.Contains("not on WhatsApp"))
                return NavigationResult.CreateFailure("Number is not registered on WhatsApp.");

            return NavigationResult.CreateFailure($"Unknown error dialog detected: {dialogText}");
        }

        private async Task WaitForProgressBarsToDisappearAsync(IBrowserSession browserSession)
        {
            try
            {
                _notifier.Notify("Waiting for WhatsApp loading/progress bar to disappear...");
                await browserSession.WaitForSelectorAsync(
                    string.Join(", ", WhatsAppConfiguration.ProgressBarSelectors),
                    WhatsAppConfiguration.DefaultProgressBarWaitMs,
                    WaitForSelectorState.Detached);
                _notifier.Notify("WhatsApp loading bar disappeared, proceeding...");
            }
            catch (TimeoutException ex)
            {
                string screenshotPath = $"Screenshots/loadingbar_timeout_{DateTime.Now:yyyyMMdd_HHmmss}.png";
                await _screenshotService.TakeScreenshotAsync(browserSession, screenshotPath);
                _notifier.Notify($"Loading bar did not disappear in time: {ex.Message}. Screenshot: {screenshotPath}. Proceeding anyway...");
            }
        }

        private async Task WaitForUIElementsAsync(IBrowserSession browserSession)
        {
            int attempt = 0;
            while (attempt < WhatsAppConfiguration.DefaultMaxUIAttempts)
            {
                foreach (var selector in WhatsAppConfiguration.ChatUIReadySelectors)
                {
                    try
                    {
                        _notifier.Notify($"🔍 Waiting for WhatsApp UI selector: {selector}");
                        await browserSession.WaitForSelectorAsync(selector, WhatsAppConfiguration.DefaultUIWaitMs, WaitForSelectorState.Visible);
                        _notifier.Notify($"✅ WhatsApp UI element visible: {selector}, UI is ready.");
                        return;
                    }
                    catch (TimeoutException ex)
                    {
                        _notifier.Notify($"⏰ Timeout waiting for selector: {selector} - {ex.Message}");

                        // Take screenshot for debugging
                        string screenshotPath = $"Screenshots/ready_timeout_{_screenshotService.SanitizeSelector(selector)}_{DateTime.Now:yyyyMMdd_HHmmss}.png";
                        await _screenshotService.TakeScreenshotAsync(browserSession, screenshotPath);
                        _notifier.Notify($"📸 Screenshot taken: {screenshotPath}");

                        // Enhanced timeout handling with comprehensive analysis
                        _notifier.Notify("🔍 Performing comprehensive timeout analysis for UI elements...");

                        // Step 1: Check internet connectivity
                        _notifier.Notify("🌐 Checking internet connectivity...");
                        var networkService = new NetworkService(_notifier);
                        if (!await networkService.CheckInternetConnectivityAsync())
                        {
                            _notifier.Notify("❌ Internet connectivity lost. Cannot continue.");
                            throw new TimeoutException($"Internet connectivity lost: {ex.Message}", ex);
                        }
                        _notifier.Notify("✅ Internet connectivity confirmed.");

                        // Step 2: Check for progress bars and wait for them to disappear
                        await HandleProgressBarsAsync(browserSession);

                        attempt++;
                        if (attempt >= WhatsAppConfiguration.DefaultMaxUIAttempts)
                        {
                            _notifier.Notify("❌ Max UI attempts reached. Cannot continue.");
                            throw new TimeoutException($"WhatsApp UI did not become ready after {WhatsAppConfiguration.DefaultMaxUIAttempts} attempts: {ex.Message}", ex);
                        }

                        _notifier.Notify($"🔄 Retrying UI detection after comprehensive analysis (attempt {attempt + 1}/{WhatsAppConfiguration.DefaultMaxUIAttempts})...");

                        _notifier.Notify($"🔄 Retrying UI detection after timeout handling (attempt {attempt + 1}/{WhatsAppConfiguration.DefaultMaxUIAttempts})...");
                        goto RetrySelectors;
                    }
                }
                break;

            RetrySelectors:
                attempt++;
            }

            _notifier.Notify("❌ WhatsApp UI did not become ready after all fallbacks and progress retries.");
            throw new TimeoutException("WhatsApp UI did not become ready after all fallbacks and progress retries.");
        }

        public async Task<bool> CheckForProgressBarsAndWaitAsync(IBrowserSession browserSession)
        {
            foreach (var progressSelector in WhatsAppConfiguration.ProgressBarSelectors)
            {
                try
                {
                    var progress = await browserSession.QuerySelectorAsync(progressSelector);
                    if (progress != null)
                    {
                        _notifier.Notify($"Progress/loading bar detected ({progressSelector}), waiting for it to disappear before retrying UI selector...");
                        await browserSession.WaitForSelectorAsync(progressSelector, WhatsAppConfiguration.DefaultProgressBarWaitMs, WaitForSelectorState.Detached);
                        _notifier.Notify($"Progress/loading bar disappeared, retrying UI selector.");
                        return true;
                    }
                }
                catch { /* ignore errors in progress check */ }
            }
            return false;
        }

        public async Task WaitForMessageInputAsync(IBrowserSession browserSession)
        {
            foreach (var inputSelector in WhatsAppConfiguration.InputFieldSelectors)
            {
                try
                {
                    _notifier.Notify($"🔍 Waiting for message input selector: {inputSelector}");
                    await browserSession.WaitForSelectorAsync(inputSelector, WhatsAppConfiguration.DefaultSelectorTimeoutMs, WaitForSelectorState.Visible);
                    _notifier.Notify($"✅ Message input element visible: {inputSelector}");
                    return;
                }
                catch (TimeoutException ex)
                {
                    _notifier.Notify($"⏰ Timeout waiting for message input selector: {inputSelector} - {ex.Message}");

                    // Take screenshot for debugging
                    string screenshotPath = $"Screenshots/input_timeout_{_screenshotService.SanitizeSelector(inputSelector)}_{DateTime.Now:yyyyMMdd_HHmmss}.png";
                    await _screenshotService.TakeScreenshotAsync(browserSession, screenshotPath);
                    _notifier.Notify($"📸 Screenshot taken: {screenshotPath}");

                    // Check for progress bars and wait if found
                    bool progressHandled = await CheckForProgressBarsAndWaitAsync(browserSession);
                    if (progressHandled)
                    {
                        _notifier.Notify("🔄 Retrying message input detection after progress bar handling...");
                        continue; // Retry the same selector
                    }

                    // If no progress bars, continue to next selector
                }
            }
            _notifier.Notify("❌ Message input element not found after all selectors.");
            throw new TimeoutException("Message input element not found after all selectors.");
        }

        public async Task FillAndSendMessageAsync(IBrowserSession browserSession, string message)
        {
            _notifier.Notify($"📝 Starting message fill and send process");
            _notifier.Notify($"📄 Message to send: {message}");

            try
            {
                // Step 1: Find message input
                _notifier.Notify("🔍 Step 1: Finding message input box...");
                var input = (IElementHandle?)null;
                foreach (var selector in WhatsAppConfiguration.InputFieldSelectors)
                {
                    var inputIN = await browserSession.QuerySelectorAsync(selector);
                    if (inputIN != null)
                    {
                        input = inputIN;
                        _notifier.Notify($"✅ Message input box found using selector: {selector}");
                        break;
                    }
                }
                if (input == null)
                {
                    _notifier.Notify("❌ Message input box not found after trying all selectors.");
                    throw new Exception("Message input box not found.");
                }

                // Step 2: Focus input
                _notifier.Notify("🎯 Step 2: Focusing message input...");
                await input.FocusAsync();
                _notifier.Notify("✅ Message input focused");

                // Step 3: Clear any existing text
                _notifier.Notify("🧹 Step 3: Clearing existing text...");
                await input.EvaluateAsync("el => el.innerText = ''");
                _notifier.Notify("✅ Existing text cleared");

                // Step 4: Fill message
                _notifier.Notify("📝 Step 4: Filling message text...");
                await input.FillAsync(message);
                _notifier.Notify("✅ Message text filled");

                // Step 5: Find and click send button
                _notifier.Notify("🔍 Step 5: Looking for send button...");
                foreach (var sendSelector in WhatsAppConfiguration.SendButtonSelectors)
                {
                    var sendButton = await browserSession.QuerySelectorAsync(sendSelector);
                    if (sendButton != null)
                    {
                        _notifier.Notify("✅ Send button found, clicking...");
                        await sendButton.ClickAsync();
                        _notifier.Notify("✅ Send button clicked");
                    }
                    else
                    {
                        _notifier.Notify("⚠️ Send button not found, pressing Enter...");
                        await input.PressAsync(WhatsAppConfiguration.SendEnterKey);
                        _notifier.Notify("✅ Enter key pressed");
                    }
                }

                _notifier.Notify("✅ Message send process completed");
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Error in message fill and send: {ex.Message}");
                throw;
            }
        }
    }
}
