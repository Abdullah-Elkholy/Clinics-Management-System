using ClinicsManagementService.Models;
using ClinicsManagementService.Services.Interfaces;
using Microsoft.Playwright;
using System.Net.Http;
namespace ClinicsManagementService.Services
{
    public class WhatsAppService : IWhatsAppService
    {
        private readonly INotifier _notifier;
        public WhatsAppService(INotifier notifier)
        {
            _notifier = notifier;
        }

        // Helper to get iconType from SendMessageAsync
        public async Task<(bool Sent, string? IconType, string? Error)> SendMessageWithIconTypeAsync(string phoneNumber, string message, IBrowserSession browserSession)
        {
            _notifier.Notify($"Starting SendMessageWithIconTypeAsync for {phoneNumber}");
            if (!await CheckInternetConnectivityAsync())
            {
                _notifier.Notify("No internet connectivity detected.");
                return (false, null, "Pending: Internet connection unavailable.");
            }
            try
            {
                var navResult = await NavigateAndCheckRecipientAsync(browserSession, phoneNumber);
                _notifier.Notify($"Navigation result: Success={navResult.Success}, Error={navResult.Error}");
                if (!navResult.Success)
                    return (false, null, navResult.Error);
                var result = await DeliverMessageAsync(browserSession, message, phoneNumber);
                _notifier.Notify($"DeliverMessageAsync result: Sent={result.Sent}, IconType={result.IconType}, Error={result.Error}");
                return result;
            }
            catch (Exception ex)
            {
                _notifier.Notify($"Exception in SendMessageWithIconTypeAsync: {ex.Message}");
                return (false, null, $"Error: {ex.Message}");
            }
        }

        // Check internet connectivity by sending a request to a reliable endpoint
        public async Task<bool> CheckInternetConnectivityAsync()
        {
            try
            {
                using var client = new HttpClient();
                var response = await client.GetAsync("https://web.whatsapp.com/");
                return response.IsSuccessStatusCode;
            }
            catch (Exception ex)
            {
                _notifier.Notify($"Internet connectivity check failed: {ex.Message}");
                return false;
            }
        }

        // Increase default timeouts for navigation and selector waits
        private const int SelectorTimeoutMs = 20000;   // 20 seconds

        // Prepares the browser session and ensures WhatsApp is ready
        public async Task<IBrowserSession> PrepareSessionAsync(string sessionDir, IBrowserSession browserSession)
        {
            _notifier.Notify("Initializing browser session...");
            await browserSession.InitializeAsync(sessionDir);
            _notifier.Notify("Navigating to WhatsApp Web...");
            await browserSession.NavigateToAsync("https://web.whatsapp.com/");
            // Track WhatsApp loading screens before waiting for WhatsApp to be ready
            await TrackWhatsAppLoadingScreensAsync(browserSession);
            _notifier.Notify("Waiting for WhatsApp to be ready...");
            await WaitForWhatsAppReadyAsync(browserSession);
            _notifier.Notify("WhatsApp session is ready.");
            return browserSession;
        }

        // Navigates to the recipient and checks for errors
        public async Task<(bool Success, string? Error)> NavigateAndCheckRecipientAsync(IBrowserSession browserSession, string phoneNumber)
        {
            _notifier.Notify($"Navigating to recipient: {phoneNumber}");
            await browserSession.NavigateToAsync($"https://web.whatsapp.com/send?phone={phoneNumber}");
            var errorDialog = await browserSession.QuerySelectorAsync("div[data-animate-modal-popup='true']");
            if (errorDialog != null)
            {
                var ariaLabel = await errorDialog.GetAttributeAsync("aria-label");
                var dialogText = await errorDialog.InnerTextAsync();
                _notifier.Notify($"Error dialog detected: ariaLabel={ariaLabel}, dialogText={dialogText}");
                if (ariaLabel != null && ariaLabel.Contains("invalid"))
                    return (false, "Invalid phone number format detected.");
                else if (dialogText.Contains("Couldn't find this user") || dialogText.Contains("not on WhatsApp"))
                    return (false, "Number is not registered on WhatsApp.");
                else
                    return (false, $"Unknown error dialog detected: {dialogText}");
            }
            _notifier.Notify("Recipient navigation successful.");
            return (true, null);
        }

        // Delivers the message and checks for status
        public async Task<(bool Sent, string? IconType, string? Error)> DeliverMessageAsync(
            IBrowserSession browserSession, string message, string? phoneNumber = null, int msgTimeRetryCount = 3, int maxMsgTimeoutRetryCount = 3)
        {
            int msgTimeRetries = 0;
            int msgTimeoutRetries = 0;
        timeoutRetry:
            try
            {
                _notifier.Notify("Delivering message...");
                await browserSession.WaitForSelectorAsync("header", SelectorTimeoutMs, WaitForSelectorState.Visible);
                await browserSession.WaitForSelectorAsync("footer", SelectorTimeoutMs, WaitForSelectorState.Visible);
                await browserSession.WaitForSelectorAsync("footer div[contenteditable='true']", SelectorTimeoutMs, WaitForSelectorState.Visible);
                var input = await browserSession.QuerySelectorAsync("footer div[contenteditable='true']");
                if (input is null)
                {
                    _notifier.Notify("Message input box not found.");
                    return (false, null, "Message input box not found.");
                }
                await input.FocusAsync();
                await input.FillAsync(message);
                var sendButton = await browserSession.QuerySelectorAsync("button[aria-label='Send']");
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
                                await TakeScreenshotAsync(browserSession, screenshotPath);
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
                    // Final extra wait if still pending
                    if (!sent && iconType == "msg-time")
                    {
                        _notifier.Notify("Final extra wait for msg-time status...");
                        await Task.Delay(15000);
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
                        return (true, iconType, null);
                    }
                    // If not sent and iconType is msg-time, try retry logic
                    if (!sent && iconType == "msg-time" && msgTimeRetries < msgTimeRetryCount)
                    {
                        msgTimeRetries++;
                        msgTimeoutRetries = msgTimeRetries; // sync msgTimeoutRetries to msgTimeRetries to avoid infinite retries
                        _notifier.Notify($"msg-time retry #{msgTimeRetries} of {msgTimeRetryCount}...");
                        // Re-navigate to chat if phoneNumber is provided
                        if (!string.IsNullOrEmpty(phoneNumber))
                        {
                            await browserSession.NavigateToAsync($"https://web.whatsapp.com/send?phone={phoneNumber}");
                            await browserSession.WaitForSelectorAsync("footer div[contenteditable='true']", 10000, WaitForSelectorState.Visible);
                            _notifier.Notify("Re-navigated to chat for retry.");
                        }
                        // Find the last message with msg-time and its retry button
                        var retryButton = await FindRetryButtonForLastMsgTimeAsync(browserSession);
                        if (retryButton != null)
                        {
                            _notifier.Notify("Retry button found, clicking...");
                            await retryButton.ClickAsync();
                            // Wait for modal and click "Try again" (flexible selector)
                            var tryAgainButton = await FindTryAgainButtonAsync(browserSession);
                            if (tryAgainButton != null)
                            {
                                _notifier.Notify("Try again button found, clicking...");
                                await tryAgainButton.ClickAsync();
                                // After retry, continue loop to re-check status
                                continue;
                            }
                            else
                            {
                                _notifier.Notify("Try again button not found in modal.");
                            }
                        }
                        else
                        {
                            _notifier.Notify("Retry button not found, just re-navigating and re-checking.");
                        }
                        // If retry button/modal not found, just re-navigate and re-check
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
                // Check internet connectivity after timeout
                if (!await CheckInternetConnectivityAsync())
                {
                    _notifier.Notify("Internet connectivity lost during navigation.");
                    return (false, null, "Pending: Internet connection unavailable after navigation.");
                }

                // check for WhatsApp progress bar and wait for it to disappear before retrying
                var progressBar = await browserSession.QuerySelectorAsync("div[role='progressbar']");
                if (progressBar != null)
                {
                    _notifier.Notify("Progress bar detected after timeout, waiting for it to disappear before retrying...");
                    await browserSession.WaitForSelectorAsync("div[role='progressbar']", 60000, WaitForSelectorState.Detached);
                }

                msgTimeoutRetries++;
                if (msgTimeoutRetries == maxMsgTimeoutRetryCount)
                {
                    _notifier.Notify($"Max navigation retries reached ({maxMsgTimeoutRetryCount}). Aborting.");
                    return (false, null, $"Timeout waiting for WhatsApp UI after {maxMsgTimeoutRetryCount} retries: {ex.Message}");
                }
                msgTimeRetries = msgTimeoutRetries; // sync msgTimeRetries to msgTimeoutRetries to avoid infinite retries
                goto timeoutRetry;
            }
            catch (Exception ex)
            {
                _notifier.Notify($"Exception in DeliverMessageAsync: {ex.Message}");
                return (false, null, $"Error delivering message: {ex.Message}");
            }
            return (false, null, "Failed to send message for unknown reasons.");
        }

        // Helper: Get status icon for the last outgoing message matching the sent text
        public async Task<(string? IconType, IElementHandle? StatusIcon)> GetLastOutgoingMessageStatusAsync(IBrowserSession browserSession, string messageText)
        {
            _notifier.Notify("Checking last outgoing message status...");
            var outgoingMessages = await browserSession.QuerySelectorAllAsync("div.message-out");
            if (outgoingMessages != null && outgoingMessages.Count > 0)
            {
                for (int i = outgoingMessages.Count - 1; i >= 0; i--)
                {
                    var msgElem = outgoingMessages[i];

                    // Skip if parent or itself is a separator (e.g., "Today")
                    var parentClass = await msgElem.EvaluateAsync<string>("el => el.parentElement?.className");
                    if (parentClass != null && parentClass.Contains("x141l45o"))
                        continue;

                    // Get message text
                    var msgTextElem = await msgElem.QuerySelectorAsync("span.selectable-text");
                    var msgText = msgTextElem != null ? await msgTextElem.InnerTextAsync() : null;
                    if (msgText != null && msgText.Trim() == messageText.Trim())
                    {
                        // Find all status icons inside the message
                        var statusIcons = await msgElem.QuerySelectorAllAsync("span[data-icon]");
                        foreach (var statusIcon in statusIcons)
                        {
                            var iconType = await statusIcon.GetAttributeAsync("data-icon");
                            if (iconType == "msg-check" || iconType == "msg-dblcheck" || iconType == "msg-time")
                            {
                                _notifier.Notify($"Found status icon: {iconType} for message: '{msgText}'");
                                return (iconType, statusIcon);
                            }
                            else if (iconType == "tail-out")
                            {
                                _notifier.Notify($"Found tail-out icon for message: '{msgText}', searching for actual status icon...");
                                // Take screenshot for debugging
                                string screenshotPath = $"Screenshots/tail_out_{DateTime.Now:yyyyMMdd_HHmmss}.png";
                                await TakeScreenshotAsync(browserSession, screenshotPath);
                                _notifier.Notify($"Screenshot taken for tail-out icon: {screenshotPath}");
                                // Continue searching for other icons in this message
                            }
                            else
                            {
                                _notifier.Notify($"Found unexpected iconType: {iconType} for message: '{msgText}'");
                                string screenshotPath = $"Screenshots/unexpected_icon_{iconType}_{DateTime.Now:yyyyMMdd_HHmmss}.png";
                                await TakeScreenshotAsync(browserSession, screenshotPath);
                                _notifier.Notify($"Screenshot taken for unexpected icon: {screenshotPath}");
                            }
                        }
                    }
                }
            }

            // Fallback: use previous logic if no outgoing message matches
            _notifier.Notify("No outgoing message matched, using fallback.");
            var statusIconFallback = await browserSession.QuerySelectorAsync("(//span[@data-icon='msg-check' or @data-icon='msg-dblcheck' or @data-icon='msg-time'])[last()]");
            var iconTypeFallback = statusIconFallback != null ? await statusIconFallback.GetAttributeAsync("data-icon") : null;
            // Take screenshot for debugging
            string fallbackScreenshotPath = $"Screenshots/status_fallback_{DateTime.Now:yyyyMMdd_HHmmss}.png";
            await TakeScreenshotAsync(browserSession, fallbackScreenshotPath);
            _notifier.Notify($"Screenshot taken for fallback status: {fallbackScreenshotPath}");
            return (iconTypeFallback, statusIconFallback);
        }

        // Helper: Find the retry button for the last msg-time message (flexible selector)
        public async Task<IElementHandle?> FindRetryButtonForLastMsgTimeAsync(IBrowserSession browserSession)
        {
            // Look for a button with data-icon="error" near the last msg-time
            // Use XPath to find the last msg-time, then its sibling retry button
            // This is a flexible approach, but may need adjustment if WhatsApp changes DOM
            var retryButton = await browserSession.QuerySelectorAsync("span[data-icon='error']");
            if (retryButton != null)
            {
                // Get the parent button
                var parent = await retryButton.EvaluateHandleAsync("el => el.closest('button,[role=button]')");
                if (parent != null)
                    return parent as IElementHandle;
            }
            // Fallback: look for button with aria-label containing 'something went wrong' or similar
            var fallback = await browserSession.QuerySelectorAsync("[aria-label*='something went wrong' i]");
            if (fallback != null)
                return fallback;
            return null;
        }

        // Helper: Find the "Try again" button in the modal (flexible selector)
        public async Task<IElementHandle?> FindTryAgainButtonAsync(IBrowserSession browserSession)
        {
            // Look for a button with text containing 'try again' (case-insensitive)
            var tryAgainButton = await browserSession.QuerySelectorAsync("button:has-text('try again')");
            if (tryAgainButton != null)
                return tryAgainButton;
            // Fallback: look for button with aria-label or data attributes
            var fallback = await browserSession.QuerySelectorAsync("button[aria-label*='try again' i]");
            if (fallback != null)
                return fallback;
            return null;
        }
        // Core retry logic for WhatsApp tasks (e.g., sending a message)
        public async Task<(bool Sent, string? IconType, string? Error)> ExecuteWithRetryAsync(
            Func<Task<(bool Sent, string? IconType, string? Error)>> taskFunc,
            int maxAttempts = 3,
            Func<Exception, bool>? treatAsRetryable = null)
        {
            int attempt = 0;
            Exception? lastException = null;
            while (attempt < maxAttempts)
            {
                try
                {
                    return await taskFunc();
                }
                catch (TimeoutException ex)
                {
                    attempt++;
                    lastException = ex;
                    _notifier.Notify($"Timeout occurred (attempt {attempt} of {maxAttempts}). Retrying task...");
                    if (attempt >= maxAttempts)
                    {
                        _notifier.Notify($"All attempts failed due to timeout. Please check your internet connection or WhatsApp Web availability.");
                        return (false, null, $"Timeout after {maxAttempts} attempts: {ex.Message}");
                    }
                }
                catch (Exception ex)
                {
                    attempt++;
                    lastException = ex;
                    _notifier.Notify($"Error occurred (attempt {attempt} of {maxAttempts}): {ex.Message}");
                    if (attempt >= maxAttempts)
                    {
                        _notifier.Notify($"All attempts failed due to error. Please check your internet connection or WhatsApp Web availability.");
                        return (false, null, $"Error after {maxAttempts} attempts: {ex.Message}");
                    }
                }
            }
            return (false, null, $"Failed after {maxAttempts} attempts: {lastException?.Message}");
        }

        // Robust WhatsApp loading/waiting logic with screenshots and progress-aware retry
        public async Task WaitForWhatsAppReadyAsync(IBrowserSession browserSession)
        {
            // Track WhatsApp loading screens before waiting for loading/progress bar to disappear
            await TrackWhatsAppLoadingScreensAsync(browserSession);
            // 1. Wait for the loading/progress bar to disappear (if present)
            try
            {
                _notifier.Notify("Waiting for WhatsApp loading/progress bar to disappear...");
                await browserSession.WaitForSelectorAsync(
                    "div[role='progressbar'], div[class*='x1n2onr6'] progress, div[aria-label^='Loading your chats']",
                    60000, WaitForSelectorState.Detached);
                _notifier.Notify("WhatsApp loading bar disappeared, proceeding...");
            }
            catch (TimeoutException ex)
            {
                string screenshotPath = $"Screenshots/loadingbar_timeout_{DateTime.Now:yyyyMMdd_HHmmss}.png";
                await TakeScreenshotAsync(browserSession, screenshotPath);
                _notifier.Notify($"Loading bar did not disappear in time: {ex.Message}. Screenshot: {screenshotPath}. Proceeding anyway...");
            }

            // Track WhatsApp loading screens after waiting for loading/progress bar to disappear
            await TrackWhatsAppLoadingScreensAsync(browserSession);

            // 2. Ensure authentication (QR code login/session check)
            await EnsureAuthenticatedAsync(browserSession);

            // 3. Wait for the main UI to be ready (try multiple selectors, retry if progress/loading is present)
            string[] uiSelectors = new[] {
            "div[role='textbox']", // main message input
            "footer div[contenteditable='true']", // legacy input
            "div[aria-label='Type a message']", // aria label input
            "div[aria-label='Chat list']", // chat list
            "header", // header as last resort
        };
            int maxAttempts = 100; // Effectively infinite, but prevents infinite loop in case of logic bug
            int attempt = 0;
            while (attempt < maxAttempts)
            {
                foreach (var selector in uiSelectors)
                {
                    try
                    {
                        _notifier.Notify($"Waiting for WhatsApp UI selector: {selector}");
                        await browserSession.WaitForSelectorAsync(selector, 30000, WaitForSelectorState.Visible);
                        _notifier.Notify($"WhatsApp UI element visible: {selector}, UI is ready.");
                        return;
                    }
                    catch (TimeoutException ex)
                    {
                        string screenshotPath = $"Screenshots/ready_timeout_{SanitizeSelector(selector)}_{DateTime.Now:yyyyMMdd_HHmmss}.png";
                        await TakeScreenshotAsync(browserSession, screenshotPath);
                        _notifier.Notify($"Timeout waiting for selector: {selector} - {ex.Message}. Screenshot: {screenshotPath}");
                        // Check if a loading/progress bar is present, and if so, wait for it to disappear and retry
                        var progressSelectors = new[] {
                        "div[role='progressbar']",
                        "div[class*='x1n2onr6'] progress",
                        "div[aria-label^='Loading your chats']"
                    };
                        foreach (var progressSelector in progressSelectors)
                        {
                            try
                            {
                                var progress = await browserSession.QuerySelectorAsync(progressSelector);
                                if (progress != null)
                                {
                                    _notifier.Notify($"Progress/loading bar detected ({progressSelector}), waiting for it to disappear before retrying UI selector...");
                                    await browserSession.WaitForSelectorAsync(progressSelector, 60000, WaitForSelectorState.Detached);
                                    _notifier.Notify($"Progress/loading bar disappeared, retrying UI selector: {selector}");
                                    // After progress bar disappears, break to outer while loop to retry all selectors
                                    goto RetrySelectors;
                                }
                            }
                            catch { /* ignore errors in progress check */ }
                        }
                    }
                }
                // If we get here, none of the selectors matched and no progress bar was found
                break;
            RetrySelectors:
                attempt++;
            }
            _notifier.Notify("WhatsApp UI did not become ready after all fallbacks and progress retries.");
            throw new TimeoutException("WhatsApp UI did not become ready after all fallbacks and progress retries.");
        }

        // Dedicated method for QR code login/session authentication: checks and waits for authentication, and handles session expiry during tasks
        public async Task EnsureAuthenticatedAsync(IBrowserSession browserSession, int pollIntervalMs = 2000, int maxWaitMs = 300000)
        {
            // Wait for authentication: poll for QR code or login prompt, and wait until authenticated or timeout
            var qrSelectors = new[] {
            "canvas[aria-label*='scan me' i]",
            "div[aria-label*='scan me' i]",
            "div[data-ref]",
            "div[role='button'] canvas",
            "div[tabindex='-1'] canvas",
            "div[role='button'][data-testid='refresh-large']",
            "div[aria-label*='to use whatsapp on your computer' i]",
            "div[aria-label*='use whatsapp on your computer' i]",
            "div[aria-label*='scan qr code' i]",
            "div[aria-label*='link with qr code' i]",
            "div[aria-label*='log in' i]",
            "div[aria-label*='session expired' i]",
        };
            var loginPromptTexts = new[] {
            "log in",
            "scan qr code",
            "link with qr code",
            "session expired",
            "to use whatsapp on your computer",
            "use whatsapp on your computer",
        };
            bool screenshotTaken_UI = false; // only take one screenshot per session expiry for UI-based selectors
            bool screenshotTaken_text = false; // only take one screenshot per session expiry for text-based selectors
            int elapsed = 0;
            while (elapsed < maxWaitMs)
            {
                bool needsAuth = false;
                // for detecting login with qr code page
                foreach (var qrSelector in qrSelectors)
                {
                    var qrElem = await browserSession.QuerySelectorAsync(qrSelector);
                    // boundingBox.Width, boundingBox.Height, boundingBox.X, boundingBox.Y
                    if (qrElem != null)
                    {
                        var boundingBox = await qrElem.BoundingBoxAsync();
                        needsAuth = true;

                        _notifier.Notify("QR code captured. Please scan it using your WhatsApp mobile app.");

                        if (!screenshotTaken_UI)
                        {
                            string screenshotPath = $"Screenshots/qr_login_UI_{DateTime.Now:yyyyMMdd_HHmmss}.png";
                            await TakeScreenshotAsync(browserSession, screenshotPath);
                            screenshotTaken_UI = true;
                            _notifier.Notify($"WhatsApp session is expired or unavailable. QR code/login page detected (selector: {qrSelector}). Please scan the QR code to log in. Screenshot: {screenshotPath}");
                        }
                        break;
                    }
                }
                // for detecting QR Code square in login page
                if (!needsAuth)
                {
                    foreach (var prompt in loginPromptTexts)
                    {
                        var elem = await browserSession.QuerySelectorAsync($"text={prompt}");
                        if (elem != null)
                        {
                            needsAuth = true;
                            if (!screenshotTaken_text)
                            {
                                string screenshotPath = $"Screenshots/qr_login_text_{DateTime.Now:yyyyMMdd_HHmmss}.png";
                                await TakeScreenshotAsync(browserSession, screenshotPath);
                                screenshotTaken_text = true;
                                _notifier.Notify($"WhatsApp session is expired or unavailable. Login prompt detected (text: '{prompt}'). Please scan the QR code to log in. Screenshot: {screenshotPath}");
                            }
                            break;
                        }
                    }
                }
                // If not needsAuth, check for WhatsApp header (authenticated)
                if (!needsAuth)
                {
                    // Track WhatsApp loading screens before waiting for loading/progress bar to disappear
                    await TrackWhatsAppLoadingScreensAsync(browserSession);
                    _notifier.Notify("Based on your action, WhatsApp session is authenticating...");
                    // check for WhatsApp header (authenticated)
                    var header = await browserSession.QuerySelectorAsync("header");
                    if (header != null)
                    {
                        // Authenticated
                        _notifier.Notify("WhatsApp session is authenticated and ready.");
                        return;
                    }
                }
                // If needsAuth, wait and poll again
                await Task.Delay(pollIntervalMs);
                elapsed += pollIntervalMs;
            }
            throw new TimeoutException("Authentication (QR code scan) not completed in time. User did not scan QR code or session did not become ready.");
        }

        // Helper to sanitize selector for valid filename
        public string SanitizeSelector(string selector)
        {
            foreach (var c in System.IO.Path.GetInvalidFileNameChars())
                selector = selector.Replace(c, '_');
            return selector.Replace(" ", "_").Replace("[", "_").Replace("]", "_").Replace("'", "").Replace("\"", "");
        }

        // Helper to take a screenshot using Playwright's page
        public async Task TakeScreenshotAsync(IBrowserSession browserSession, string path)
        {
            try
            {
                // Try to cast to PlaywrightBrowserSession to access _page
                if (browserSession is ClinicsManagementService.Services.PlaywrightBrowserSession pbs)
                {
                    var pageField = typeof(ClinicsManagementService.Services.PlaywrightBrowserSession).GetField("_page", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
                    if (pageField != null)
                    {
                        var page = pageField.GetValue(pbs) as IPage;
                        if (page != null)
                        {
                            Directory.CreateDirectory(System.IO.Path.GetDirectoryName(path)!);
                            await page.ScreenshotAsync(new PageScreenshotOptions { Path = path });
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _notifier.Notify($"Failed to take screenshot: {ex.Message}");
            }
        }

        public async Task TrackWhatsAppLoadingScreensAsync(IBrowserSession browserSession)
        {
        returnAgain:
            // 1. Progress bar (generic, reliable)
            var progressBar = await browserSession.QuerySelectorAsync("progress");
            if (progressBar != null)
            {
                _notifier.Notify($"WhatsApp loading progress. Please be patient...");
                // int pollCount = 0;
                // while (pollCount < 500)
                // {
                //     var max = await progressBar.GetAttributeAsync("max");
                //     var value = await progressBar.GetAttributeAsync("value");
                //     _notifier.Notify($"WhatsApp loading progress: {value ?? "?"}/{max ?? "?"}. Please be patient...");
                //     if (max == "100")
                //     {
                //         value = max; // treat as complete
                //         _notifier.Notify($"WhatsApp loading completed {value ?? "?"}/{max ?? "?"}.");
                //         break;
                //     }
                // }
                // pollCount++;
                // await Task.Delay(100);
            }

            // 2. Loading text (reliable by text content)
            var loadingTextElem = await browserSession.QuerySelectorAsync("text=Loading your chats");
            if (loadingTextElem != null)
            {
                var loadingText = await loadingTextElem.InnerTextAsync();
                _notifier.Notify($"WhatsApp loading: {loadingText}. Please be patient...");
            }

            // 3. "Don't close this window" message (reliable by text content)
            var downloadingMsgElem = await browserSession.QuerySelectorAsync("text=Don't close this window");
            if (downloadingMsgElem != null)
            {
                var downloadingMsg = await downloadingMsgElem.InnerTextAsync();
                _notifier.Notify($"WhatsApp loading message: {downloadingMsg}. Please be patient...");
            }

            // 4. ARIA-label based loading (reliable)
            var ariaLoadingElem = await browserSession.QuerySelectorAsync("[aria-label^='Loading your chats']");
            if (ariaLoadingElem != null)
            {
                var ariaLabel = await ariaLoadingElem.GetAttributeAsync("aria-label");
                _notifier.Notify($"WhatsApp loading (ARIA): {ariaLabel}. Please be patient...");
                goto returnAgain;
            }

            // 5. Role-based progress bar (reliable)
            var roleProgressBar = await browserSession.QuerySelectorAsync("div[role='progressbar']");
            if (roleProgressBar != null)
            {
                _notifier.Notify($"WhatsApp is loading (role=progressbar): {roleProgressBar}. Please be patient...");
            }
        }
        // Dispose browser session after sending
        public async Task DisposeBrowserSessionAsync(IBrowserSession browserSession)
        {
            _notifier.Notify("Disposing browser session...");
            if (browserSession is IAsyncDisposable asyncDisposable)
                await asyncDisposable.DisposeAsync();
            else if (browserSession is IDisposable disposable)
                disposable.Dispose();
            _notifier.Notify("Disposed browser session.");
        }
    }
}