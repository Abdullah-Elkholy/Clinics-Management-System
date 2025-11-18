using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.Models;
using ClinicsManagementService.Configuration;
using Microsoft.Playwright;
using System;
using System.Linq;
using System.Threading.Tasks;
using System.Threading;

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

        // Note: removed generic TryExecuteAsync helper to keep error handling explicit at call sites.

        public bool IsBrowserClosedException(Exception ex)
        {
            return ex is PlaywrightException pex &&
                   (pex.Message.Contains("Target page, context or browser has been closed") ||
                    pex.Message.Contains("Browser has been disconnected"));
        }

        // Continuous monitoring for progress bars and authentication issues
        // This method runs as a side job to interrupt waiting operations
        public async Task<OperationResult<bool>?> ContinuousMonitoringAsync(IBrowserSession browserSession, int delayMs = WhatsAppConfiguration.defaultChecksFrequencyDelayMs, int maxWaitMs = WhatsAppConfiguration.DefaultMaxMonitoringWaitMs)
        {
            try
            {
                // Check internet connectivity first (before checking progress bars)
                // This ensures network issues are detected even if there's no progress bar
                try
                {
                    if (!await _networkService.CheckInternetConnectivityAsync())
                    {
                        _notifier.Notify("🔌 Internet connection unavailable during monitoring");
                        return OperationResult<bool>.PendingNET("Internet connection unavailable");
                    }
                }
                catch (Exception netEx)
                {
                    _notifier.Notify($"⚠️ Error checking internet connectivity: {netEx.Message}");
                    // Continue with other checks even if network check fails
                }

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
                            var maxWait = TimeSpan.FromMilliseconds(maxWaitMs);
                            var progressDisappeared = false;
                            while (DateTime.UtcNow - start < maxWait)
                            {
                                try
                                {
                                    var still = await browserSession.QuerySelectorAsync(progressSelector);
                                    if (still == null)
                                    {
                                        _notifier.Notify($"✅ Progress bar disappeared ({progressSelector})");
                                        progressDisappeared = true;
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

                            // If we exited the polling loop due to timeout (i.e. progress did NOT disappear), report Waiting
                            if (!progressDisappeared)
                            {
                                return OperationResult<bool>.Waiting($"Progress bar did not disappear in time ({maxWait}).");
                            }
                            // otherwise the progress disappeared and we continue monitoring other selectors
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
                // await Task.Delay(delayMs);

                // Check for authentication issues
                foreach (var selector in WhatsAppConfiguration.LoginPromptTexts)
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

                // Check for authentication issues - wait for QR code to be fully rendered
                // WhatsApp Web shows "Steps to log in" page with loading state before QR code appears
                // We need to wait for the QR code canvas to be visible, not just present in DOM
                bool qrCodeFound = false;
                foreach (var selector in WhatsAppConfiguration.QrCodeSelectors)
                {
                    try
                    {
                        // For canvas elements (QR code), wait for it to be visible and rendered
                        // Canvas may exist in DOM but QR code image may not be rendered yet
                        if (selector == "canvas" || selector.Contains("canvas"))
                        {
                            try
                            {
                                // Wait for canvas to be visible (with timeout)
                                // This ensures QR code is actually rendered, not just DOM element exists
                                await browserSession.WaitForSelectorAsync(selector, 5000, WaitForSelectorState.Visible);
                                _notifier.Notify($"🔐 QR code canvas detected and visible ({selector})");
                                qrCodeFound = true;
                                break;
                            }
                            catch (TimeoutException)
                            {
                                // Canvas not visible yet, continue checking other selectors
                                _notifier.Notify($"⏳ QR code canvas not yet visible ({selector}), checking other indicators...");
                            }
                            catch (Exception ex)
                            {
                                _notifier.Notify($"⚠️ Error waiting for QR canvas {selector}: {ex.Message}");
                            }
                        }
                        else
                        {
                            // For other selectors (text, containers), check if they exist and are visible
                            try
                            {
                                await browserSession.WaitForSelectorAsync(selector, 2000, WaitForSelectorState.Visible);
                                _notifier.Notify($"🔐 Authentication element detected ({selector})");
                                qrCodeFound = true;
                                break;
                            }
                            catch (TimeoutException)
                            {
                                // Element not visible, continue checking
                            }
                            catch (Exception ex)
                            {
                                _notifier.Notify($"⚠️ Error waiting for auth selector {selector}: {ex.Message}");
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _notifier.Notify($"⚠️ Error checking auth selector {selector}: {ex.Message}");
                    }
                }
                
                if (qrCodeFound)
                {
                    return OperationResult<bool>.PendingQR("WhatsApp authentication required. Please scan QR code.");
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
        public async Task<OperationResult<bool>> WaitWithMonitoringAsync(IBrowserSession browserSession, Func<Task<bool>> waitCondition, int timeoutMs = WhatsAppConfiguration.DefaultMaxMonitoringWaitMs, int delayMs = WhatsAppConfiguration.defaultChecksFrequencyDelayMs)
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
                        // If the browser/page was closed, surface a failure so the caller can recreate the session.
                        if (IsBrowserClosedException(ex))
                        {
                            _notifier.Notify("❌ Browser/session closed during wait");
                            return OperationResult<bool>.Failure("Failed: Browser session terminated during wait");
                        }
                        // Check if browser was manually closed (InvalidOperationException with specific message)
                        if (ex is InvalidOperationException && ex.Message.Contains("manually closed"))
                        {
                            _notifier.Notify("❌ Browser was manually closed - stopping wait operation");
                            return OperationResult<bool>.Failure("Failed: Browser session was manually closed. Please restart the service.");
                        }
                        _notifier.Notify($"⚠️ Wait condition error: {ex.Message}");
                        // Continue waiting despite other non-fatal errors
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

        public async Task<OperationResult<bool>> WaitForPageLoadAsync(IBrowserSession browserSession, string[]? selectors, int timeoutMs = WhatsAppConfiguration.DefaultMaxMonitoringWaitMs, int delayMs = WhatsAppConfiguration.defaultChecksFrequencyDelayMs)
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


        public async Task<OperationResult<bool>> NavigateToRecipientAsync(IBrowserSession browserSession, string phoneNumber)
        {
            _notifier.Notify($"🌐 Starting navigation to recipient: {phoneNumber}");

            try
            {
                // Step 1: Normalize phone number and construct URL
                // Handles both formats: phone number only or phone number with country code
                var normalizedPhone = PhoneNumberNormalizer.NormalizeDigitsOnly(phoneNumber);
                var url = $"{WhatsAppConfiguration.WhatsAppSendUrl + normalizedPhone}";
                _notifier.Notify($"🔗 Navigation URL: {url}");

                // Step 2: Navigate to URL
                _notifier.Notify("🚀 Initiating navigation...");
                await browserSession.NavigateToAsync(url);
                _notifier.Notify("✅ Navigation request sent");

                // Step 3: Wait for page to load with continuous monitoring
                _notifier.Notify("⏳ Waiting for page to load...");
                var navRes = await WaitForPageLoadAsync(browserSession, WhatsAppConfiguration.ChatUIReadySelectors);
                // Centralize mapping of navRes states via extension helpers
                if (navRes.IsWaiting())
                    return OperationResult<bool>.Waiting(navRes.ResultMessage ?? "Waiting for page load");
                if (navRes.IsPendingQr())
                    return OperationResult<bool>.PendingQR(navRes.ResultMessage ?? "Authentication required");
                if (navRes.IsPendingNet())
                    return OperationResult<bool>.PendingNET(navRes.ResultMessage ?? "Internet issue");
                if (navRes.IsSuccess == false)
                    return OperationResult<bool>.Failure(navRes.ResultMessage ?? "Navigation interrupted");

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
                }, 10000, 500);

                if (errorWaitResult.IsSuccess == false)
                {
                    if (errorWaitResult.State == OperationState.Waiting)
                        return OperationResult<bool>.Waiting(errorWaitResult.ResultMessage ?? "Waiting: Error dialog check timed out");
                    if (errorWaitResult.State == OperationState.PendingQR)
                        return OperationResult<bool>.PendingQR(errorWaitResult.ResultMessage ?? "Authentication required");
                    if (errorWaitResult.State == OperationState.PendingNET)
                        return OperationResult<bool>.PendingNET(errorWaitResult.ResultMessage ?? "Internet issue");
                    return OperationResult<bool>.Failure(errorWaitResult.ResultMessage ?? "Error dialog check interrupted by authentication or progress bar");
                }

                foreach (var selector in WhatsAppConfiguration.ErrorDialogSelectors)
                {
                    var errorDialog = await browserSession.QuerySelectorAsync(selector);
                    if (errorDialog != null)
                    {
                        _notifier.Notify("❌ Error dialog detected");
                        var result = await HandleErrorDialogAsync(errorDialog);
                        _notifier.Notify($"📋 Error dialog result: {result.IsSuccess} - {result.ResultMessage}");
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
                    return OperationResult<bool>.Failure("Session expired: WhatsApp logged out. Please restart the service.");
                }

                // Check if normalized phone number is in URL
                if (currentUrl.Contains(normalizedPhone))
                {
                    _notifier.Notify("✅ Navigation successful - phone number found in URL");
                    return OperationResult<bool>.Success(true);
                }
                else
                {
                    _notifier.Notify("⚠️ Navigation may not have completed properly");
                    return OperationResult<bool>.Success(true); // Still proceed, might be a timing issue
                }
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Navigation failed with exception: {ex.Message}");
                return OperationResult<bool>.Failure($"Navigation failed: {ex.Message}");
            }
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
                OperationResult<string?>? result = null;
                try
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
                    {
                        result = OperationResult<string?>.Failure(uiWaitResult?.ResultMessage ?? "Navigation interrupted by authentication or progress bar");
                    }
                    else
                    {
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
                            result = OperationResult<string?>.Failure("Message input box not found.");
                        }
                        else
                        {
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
                                {
                                    result = OperationResult<string?>.Failure(monitoringResult.ResultMessage ?? "Navigation interrupted by authentication or progress bar");
                                    break;
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
                                        string screenshotPath = $"Screenshots/unexpected_icon_{iconType}_{DateTime.UtcNow:yyyyMMdd_HHmmss}.png";
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

                            // If result is already set (failure during monitoring), return it
                            if (result != null)
                            {
                                // nothing to do, result already populated
                            }
                            else if (iconType == null || iconType == "")
                            {
                                _notifier.Notify("No status icon found after polling - using existing retry logic");
                                result = OperationResult<string?>.Waiting($"No status icon found after polling");
                            }
                            else
                            {
                                // Final extra wait if still pending with continuous monitoring
                                if (!sent && iconType == "msg-time")
                                {
                                    _notifier.Notify("Final extra wait for msg-time status...");
                                    var extraWaitResult = await WaitWithMonitoringAsync(browserSession, async () =>
                                    {
                                        var statusResult = await GetLastOutgoingMessageStatusAsync(browserSession, message);
                                        return statusResult.IconType == "msg-check" || statusResult.IconType == "msg-dblcheck";
                                    }, 15000, 1000);

                                    if (extraWaitResult.IsSuccess == false)
                                    {
                                        if (extraWaitResult.IsWaiting())
                                            result = OperationResult<string?>.Waiting($"Waiting: {extraWaitResult.ResultMessage ?? "Final wait..."}");
                                        else if (extraWaitResult.IsPendingQr())
                                            result = OperationResult<string?>.PendingQR(extraWaitResult.ResultMessage ?? "Authentication required");
                                        else if (extraWaitResult.IsPendingNet())
                                            result = OperationResult<string?>.PendingNET(extraWaitResult.ResultMessage ?? "Internet issue");
                                        else
                                            result = OperationResult<string?>.Failure(extraWaitResult.ResultMessage ?? "Navigation interrupted by authentication or progress bar");
                                    }
                                    else
                                    {
                                        var statusResult = await GetLastOutgoingMessageStatusAsync(browserSession, message);
                                        iconType = statusResult.IconType;
                                        if (iconType == "msg-check" || iconType == "msg-dblcheck")
                                        {
                                            sent = true;
                                            _notifier.Notify($"Message sent after extra wait: iconType={iconType}");
                                            result = OperationResult<string?>.Success(iconType);
                                        }
                                    }
                                }

                                if (result == null)
                                {
                                    if (sent && (iconType == "msg-check" || iconType == "msg-dblcheck"))
                                    {
                                        _notifier.Notify("DeliverMessageAsync completed: message sent.");
                                        result = OperationResult<string?>.Success(iconType);
                                    }
                                    else if (!sent && iconType == "msg-time" && msgTimeRetries < msgTimeRetryCount)
                                    {
                                        msgTimeRetries++;
                                        _notifier.Notify($"msg-time retry #{msgTimeRetries} of {msgTimeRetryCount}...");
                                        result = OperationResult<string?>.Waiting($"msg-time retry #{msgTimeRetries} of {msgTimeRetryCount}...");
                                    }
                                    else if (msgTimeRetries == msgTimeRetryCount)
                                    {
                                        _notifier.Notify($"Message failed after {msgTimeRetries} msg-time retries.");
                                        result = OperationResult<string?>.Failure($"Failed: msg-time after {msgTimeRetryCount} retries");
                                    }
                                    else
                                    {
                                        _notifier.Notify("Message not sent yet, re-checking...");
                                        result = OperationResult<string?>.Waiting($"Message not sent yet, re-checking...");
                                    }
                                }
                            }
                        }
                    }
                }
                catch (Exception ex) when (IsBrowserClosedException(ex))
                {
                    _notifier.Notify($"⚠️ Error in DeliverMessageAsync: Browser was closed: {ex.Message}");
                    result = OperationResult<string?>.Failure("DeliverMessageAsync failed: Browser closed");
                }
                catch (Exception ex)
                {
                    _notifier.Notify($"⚠️ Error in DeliverMessageAsync: {ex.Message}");
                    result = OperationResult<string?>.Failure("DeliverMessageAsync failed");
                }

                // Ensure result is not null before checking states
                if (result == null)
                {
                    result = OperationResult<string?>.Failure("DeliverMessageAsync failed");
                }
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

            string fallbackScreenshotPath = $"Screenshots/status_fallback_{DateTime.UtcNow:yyyyMMdd_HHmmss}.png";
            await _screenshotService.TakeScreenshotAsync(browserSession, fallbackScreenshotPath);
            _notifier.Notify($"Screenshot taken for fallback status: {fallbackScreenshotPath}");

            return MessageStatus.WithIcon(iconTypeFallback ?? string.Empty, statusIconFallback);
        }

        private async Task<OperationResult<bool>> HandleErrorDialogAsync(IElementHandle errorDialog)
        {
            var ariaLabel = await errorDialog.GetAttributeAsync(WhatsAppConfiguration.AriaLabelAttribute);
            var dialogText = await errorDialog.InnerTextAsync();
            _notifier.Notify($"Error dialog detected: ariaLabel={ariaLabel}, dialogText={dialogText}");

            if (ariaLabel != null && ariaLabel.Contains("invalid"))
                return OperationResult<bool>.Failure("Invalid phone number format detected.");

            if (dialogText.Contains("Couldn't find this user") || dialogText.Contains("not on WhatsApp"))
                return OperationResult<bool>.Failure("Number is not registered on WhatsApp.");

            return OperationResult<bool>.Failure($"Unknown error dialog detected: {dialogText}");
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
