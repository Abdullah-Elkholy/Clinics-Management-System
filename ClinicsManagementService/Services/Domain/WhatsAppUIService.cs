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
        private readonly INetworkService _networkService;

        public WhatsAppUIService(INotifier notifier, IScreenshotService screenshotService, INetworkService networkService)
        {
            _notifier = notifier;
            _screenshotService = screenshotService;
            _networkService = networkService;
        }
        
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

        // Continuous monitoring for progress bars and authentication issues
        // This method runs as a side job to interrupt waiting operations
        public async Task<OperationResult<bool>?> ContinuousMonitoringAsync(IBrowserSession browserSession, int delayMs = 500, int? maxWaitMs = null)
        {
            try
            {
                // Check for progress bars and wait for them to disappear.
                // Instead of using repeated short WaitForSelector timeouts, poll the selector until it no longer exists.
                // If internet connectivity is lost during the wait, return a PendingNET so upstream can handle it.
                foreach (var progressSelector in WhatsAppConfiguration.ProgressBarSelectors)
                {
                    try
                    {
                        var progress = await browserSession.QuerySelectorAsync(progressSelector);
                        if (progress != null)
                        {
                            _notifier.Notify($"⏳ Progress bar detected during monitoring ({progressSelector}) - waiting for completion");

                            // Poll until the selector is no longer present, or until internet is down, or browser is closed.
                            var pollIntervalMs = Math.Max(250, delayMs);
                            var start = DateTime.UtcNow;
                            var maxWait = maxWaitMs.HasValue ? TimeSpan.FromMilliseconds(maxWaitMs.Value) : TimeSpan.FromMinutes(15); // default 15 minutes (very long)
                            while (DateTime.UtcNow - start < maxWait)
                            {
                                try
                                {
                                    var still = await browserSession.QuerySelectorAsync(progressSelector);
                                    if (still == null)
                                    {
                                        _notifier.Notify($"✅ Progress bar disappeared ({progressSelector})");
                                        break;
                                    }
                                }
                                catch (Exception ex)
                                {
                                    // If browser/page was closed, surface a failure so the caller can recreate the session.
                                    if (IsBrowserClosedException(ex))
                                    {
                                        _notifier.Notify($"❌ Browser/session closed while waiting for progress selector {progressSelector}: {ex.Message}");
                                        return OperationResult<bool>.Failure("Failed: Browser session terminated while waiting for progress bar");
                                    }
                                    // Otherwise log and continue polling
                                    _notifier.Notify($"⚠️ Error while checking progress selector {progressSelector}: {ex.Message}");
                                }

                                // Check internet connectivity; if lost, return PendingNET so upstream can handle retry/recovery.
                                try
                                {
                                    if (!await _networkService.CheckInternetConnectivityAsync())
                                    {
                                        _notifier.Notify("🔌 Internet connection lost while waiting for progress bar to disappear");
                                        return OperationResult<bool>.PendingNET("Internet connection unavailable");
                                    }
                                }
                                catch (Exception netEx)
                                {
                                    _notifier.Notify($"⚠️ Error checking internet connectivity during progress wait: {netEx.Message}");
                                }

                                await Task.Delay(pollIntervalMs);
                            }

                            // If we exited the polling loop due to timeout, report Waiting so callers can decide
                            _notifier.Notify($"⚠️ Progress wait exceeded maxWait ({maxWait}). Returning Waiting state.");
                            return OperationResult<bool>.Waiting();
                        }
                    }
                    catch (Exception ex)
                    {
                        if (IsBrowserClosedException(ex))
                        {
                            _notifier.Notify($"❌ Browser/session closed while querying progress selector {progressSelector}: {ex.Message}");
                            return OperationResult<bool>.Failure("Failed: Browser session terminated while checking progress bar");
                        }
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
                            return OperationResult<bool>.PendingQR("WhatsApp authentication required. Please scan QR code.");
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
                        return OperationResult<bool>.PendingQR("WhatsApp session expired. Please scan QR code.");
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

        // Enhanced waiting with continuous monitoring for progress bars and authentication
        public async Task<OperationResult<bool>> WaitWithMonitoringAsync(IBrowserSession browserSession, Func<Task<bool>> waitCondition, int timeoutMs = 120000, int delayMs = 500)
        {
            var startTime = DateTime.UtcNow;
            var timeout = TimeSpan.FromMilliseconds(timeoutMs);
            var checkInterval = TimeSpan.FromMilliseconds(delayMs);
            var lastProgressCheck = DateTime.UtcNow;
            try
            {
                while (DateTime.UtcNow - startTime < timeout)
                {
                    // Check the main wait condition
                    try
                    {
                        if (await waitCondition())
                        {
                            return OperationResult<bool>.Success(true); // Success
                        }
                        if (!await _networkService.CheckInternetConnectivityAsync())
                        {
                            return OperationResult<bool>.PendingNET("Internet connection lost during operation");
                        }
                        // Only check progress bars periodically to avoid spam
                        if (DateTime.UtcNow - lastProgressCheck > checkInterval)
                        {
                            var monitoringResult = await ContinuousMonitoringAsync(browserSession, delayMs);
                            if (monitoringResult != null)
                            {
                                return monitoringResult;
                            }
                            lastProgressCheck = DateTime.UtcNow;
                        }
                        // Calculate remaining time
                        var elapsed = DateTime.UtcNow - startTime;
                        var remaining = timeout - elapsed;

                        // Adjust wait interval based on remaining time
                        var waitInterval = Math.Min(delayMs, (int)remaining.TotalMilliseconds);
                        if (waitInterval > 0)
                        {
                            // Wait before re-evaluating
                            await Task.Delay(waitInterval);
                        }
                    }
                    catch (Exception ex)
                    {
                        _notifier.Notify($"⚠️ Wait condition error: {ex.Message}");
                        // Continue waiting despite errors
                    }
                }
            }
            catch (TimeoutException)
            {
                _notifier.Notify($"⏰ Operation timed out after {timeoutMs}ms");
                return OperationResult<bool>.Failure($"Operation timed out after {timeoutMs}ms");
            }
            catch (Exception ex) when (IsBrowserClosedException(ex))
            {
                _notifier.Notify("❌ Browser/session closed during wait");
                return OperationResult<bool>.Failure("Failed: Browser session terminated during wait");
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Exception during wait: {ex.Message}");
                return OperationResult<bool>.Failure($"Failed: Exception during wait - {ex.Message}");
            }
            return OperationResult<bool>.Failure("Operation timed out without meeting condition");
        }

        public async Task<OperationResult<bool>> WaitForPageLoadAsync(IBrowserSession browserSession, string[]? selectors, int timeoutMs = 120000, int delayMs = 500)
        {
            // Increase the progress bar wait timeout to 5000ms (or configurable)
            OperationResult<bool>? selectorTimeoutResult = null;
            try
            {
                var waitResult = await WaitWithMonitoringAsync(browserSession, async () =>
                {
                    if (selectors == null || selectors.Length == 0)
                        return true;
                    foreach (var selector in selectors)
                    {
                        var elem = await browserSession.QuerySelectorAsync(selector);
                        if (elem != null)
                            return true;
                    }
                    return false;
                }, timeoutMs, delayMs);
                if (waitResult.IsSuccess == false)
                {
                    // Return the raw waitResult so the caller can decide how to handle Waiting/Pending states
                    return waitResult;
                }
                return OperationResult<bool>.Success(true);
            }
            catch (TimeoutException ex)
            {
                // Optionally, you can return a special result or continue as Success
                _notifier.Notify($"⚠️ Progress bar wait timeout: {ex.Message}. Proceeding with caution.");
                selectorTimeoutResult = OperationResult<bool>.Failure($"Progress bar did not disappear in time: {ex.Message}");
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Exception in WaitForPageLoadAsync: {ex.Message}");
                return OperationResult<bool>.Failure($"Exception in WaitForPageLoadAsync: {ex.Message}");
            }
            // If we caught a timeout, decide whether to proceed or fail
            return selectorTimeoutResult ?? OperationResult<bool>.Success(true);
        }

        public async Task<OperationResult<string?>> DeliverMessageAsync(IBrowserSession browserSession, string message, string? phoneNumber = null)
        {
            // Modularized and robust async execution with retries and error handling
            _notifier.Notify($"🚀 Starting message delivery task for phone: {phoneNumber ?? "N/A"}");
            _notifier.Notify($"📝 Message content: {message}");

            int msgTimeRetries = 0;
            int msgTimeoutRetries = 0;
            const int msgTimeRetryCount = 3;
            const int maxMsgTimeoutRetryCount = 3;

            while (msgTimeoutRetries < maxMsgTimeoutRetryCount)
            {
                var result = await TryExecuteAsync<OperationResult<string?>>(async () =>
                {
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

                    if (uiWaitResult.IsSuccess == false)
                        return OperationResult<string?>.Failure(uiWaitResult?.ResultMessage ?? "Navigation interrupted by authentication or progress bar");

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
                        return OperationResult<string?>.Failure("Message input box not found.");
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
                        await input.PressAsync(WhatsAppConfiguration.SendEnterKey);
                    }

                    var maxWaitMs = 15000; // 15 seconds
                    var pollIntervalMs = 1000; // 1 second
                    int elapsed = 0;
                    bool sent = false;
                    string? iconType = null;

                    while (elapsed < maxWaitMs)
                    {
                        // Run continuous monitoring during status polling
                        var monitoringResult = await ContinuousMonitoringAsync(browserSession, pollIntervalMs);
                        if (monitoringResult?.State == OperationState.Waiting)
                            return OperationResult<string?>.Failure(monitoringResult.ResultMessage ?? "Navigation interrupted by authentication or progress bar");

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
                        return OperationResult<string?>.Waiting(); // Will trigger retry below (treated as waiting)
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

                        // Handle all possible result states
                        if (extraWaitResult.IsSuccess == false)
                        {
                            // Map monitoring result (OperationResult<bool>) to OperationResult<string?> so caller can handle Waiting/Pending states
                            if (extraWaitResult.IsWaiting())
                                return OperationResult<string?>.Waiting();
                            if (extraWaitResult.IsPendingQr())
                                return OperationResult<string?>.PendingQR(extraWaitResult.ResultMessage ?? "Authentication required");
                            if (extraWaitResult.IsPendingNet())
                                return OperationResult<string?>.PendingNET(extraWaitResult.ResultMessage ?? "Internet issue");
                            return OperationResult<string?>.Failure(extraWaitResult.ResultMessage ?? "Navigation interrupted by authentication or progress bar");
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
                        return OperationResult<string?>.Success(iconType);
                    }

                    // If not sent and iconType is msg-time, try retry logic
                    if (!sent && iconType == "msg-time" && msgTimeRetries < msgTimeRetryCount)
                    {
                        msgTimeRetries++;
                        _notifier.Notify($"msg-time retry #{msgTimeRetries} of {msgTimeRetryCount}...");
                        return OperationResult<string?>.Waiting(); // Will trigger retry below
                    }

                    // Otherwise, not sent
                    if (msgTimeRetries == msgTimeRetryCount)
                    {
                        _notifier.Notify($"Message failed after {msgTimeRetries} msg-time retries.");
                        return OperationResult<string?>.Failure($"Failed: msg-time after {msgTimeRetryCount} retries");
                    }

                    _notifier.Notify("Message not sent yet, re-checking...");
                    return OperationResult<string?>.Waiting(); // Will trigger retry below
                }, OperationResult<string?>.Failure("DeliverMessageAsync failed"), "DeliverMessageAsync");

                if (result.IsWaiting())
                {
                    msgTimeoutRetries++;
                    _notifier.Notify($"🔄 Retrying full task (attempt {msgTimeoutRetries}/{maxMsgTimeoutRetryCount})...");
                    continue;
                }
                return result;
            }
            return OperationResult<string?>.Failure($"Failed: No status icon found after {maxMsgTimeoutRetryCount} retries");
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
    }
}
