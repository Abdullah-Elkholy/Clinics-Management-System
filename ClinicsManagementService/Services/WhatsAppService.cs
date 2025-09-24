using ClinicsManagementService.Models;
using Microsoft.Playwright;
using System.Net.Http;

public class WhatsAppService : IMessageSender
{
    private readonly Func<IBrowserSession> _browserSessionFactory;
    private readonly INotifier _notifier;

    public WhatsAppService(Func<IBrowserSession> browserSessionFactory, INotifier notifier)
    {
        _browserSessionFactory = browserSessionFactory;
        _notifier = notifier;
    }

    /// <summary>
    /// Send multiple phone/message pairs with random throttling between each send, returning MessageSendResult for each.
    /// </summary>
    /// <param name="items">List of phone/message pairs</param>
    /// <param name="minDelayMs">Minimum delay in ms between sends</param>
    /// <param name="maxDelayMs">Maximum delay in ms between sends</param>
    /// <returns>List of MessageSendResult for each send</returns>
    public async Task<List<MessageSendResult>> SendBulkWithThrottlingAsync(IEnumerable<(string Phone, string Message)> items, int minDelayMs, int maxDelayMs)
    {
        _notifier.Notify("Starting bulk send process...");
        var results = new List<MessageSendResult>();
        var rand = new Random();
        bool networkErrorOccurred = false;
        string? networkErrorMessage = null;
        int total = items.Count(); // only for logging using notify
        int counter = 1; // only for logging using notify
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
            var result = await ExecuteWithRetryAsync(() => SendMessageWithIconTypeAsync(item.Phone, item.Message),
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
                int delay = rand.Next(minDelayMs, maxDelayMs + 1);
                _notifier.Notify($"[{counter + 1}/{total}] Throttling for {delay}ms before next send..."); // only for logging using notify
                await Task.Delay(delay);
            }
            counter++; // only for logging using notify
        }
        _notifier.Notify("Bulk send process completed."); // only for logging using notify
        return results;
    }

    // Helper to get iconType from SendMessageAsync
    private async Task<(bool Sent, string? IconType, string? Error)> SendMessageWithIconTypeAsync(string phoneNumber, string message)
    {
        _notifier.Notify($"Starting SendMessageWithIconTypeAsync for {phoneNumber}");
        var browserSession = _browserSessionFactory();
        try
        {
            await PrepareSessionAsync(browserSession);
            _notifier.Notify("Session prepared.");
            var navResult = await NavigateAndCheckRecipientAsync(browserSession, phoneNumber);
            _notifier.Notify($"Navigation result: Success={navResult.Success}, Error={navResult.Error}");
            if (!navResult.Success)
                return (false, null, navResult.Error);
            var result = await DeliverMessageAsync(browserSession, message, phoneNumber);
            _notifier.Notify($"DeliverMessageAsync result: Sent={result.Sent}, IconType={result.IconType}, Error={result.Error}");
            return result;
        }
        finally
        {
            _notifier.Notify("Disposing browser session.");
            if (browserSession is IAsyncDisposable asyncDisposable)
                await asyncDisposable.DisposeAsync();
            else if (browserSession is IDisposable disposable)
                disposable.Dispose();
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
    private const int NavigationTimeoutMs = 60000; // 60 seconds
    private const int SelectorTimeoutMs = 20000;   // 20 seconds

    // Prepares the browser session and ensures WhatsApp is ready
    private async Task PrepareSessionAsync(IBrowserSession browserSession)
    {
        _notifier.Notify("Initializing browser session...");
        await browserSession.InitializeAsync();
        _notifier.Notify("Navigating to WhatsApp Web...");
        await browserSession.NavigateToAsync("https://web.whatsapp.com/");
        // Track WhatsApp loading screens before waiting for WhatsApp to be ready
        await TrackWhatsAppLoadingScreensAsync(browserSession);
        _notifier.Notify("Waiting for WhatsApp to be ready...");
        await WaitForWhatsAppReadyAsync(browserSession);
        _notifier.Notify("WhatsApp session is ready.");
    }

    // Navigates to the recipient and checks for errors
    private async Task<(bool Success, string? Error)> NavigateAndCheckRecipientAsync(IBrowserSession browserSession, string phoneNumber)
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
    private async Task<(bool Sent, string? IconType, string? Error)> DeliverMessageAsync(
        IBrowserSession browserSession, string message, string? phoneNumber = null, int msgTimeRetryCount = 3)
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
        int msgTimeRetries = 0;

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
                        break;
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
            _notifier.Notify($"Message failed after {msgTimeRetries} msg-time retries.");
            break;
        }
        // Guarantee: Only sent=true if iconType is msg-check or msg-dblcheck
        return (false, null, "Message failed to send (pending/clock icon or timeout).");
    }

    // Helper: Get status icon for the last outgoing message matching the sent text
    private async Task<(string? IconType, IElementHandle? StatusIcon)> GetLastOutgoingMessageStatusAsync(IBrowserSession browserSession, string messageText)
    {
        _notifier.Notify("Checking last outgoing message status...");
        // WhatsApp outgoing messages usually have a class like 'message-out'
        var outgoingMessages = await browserSession.QuerySelectorAllAsync("div.message-out");
        if (outgoingMessages != null && outgoingMessages.Count > 0)
        {
            // Search from last to first for a message whose text matches
            for (int i = outgoingMessages.Count - 1; i >= 0; i--)
            {
                var msgElem = outgoingMessages[i];
                var msgTextElem = await msgElem.QuerySelectorAsync("span.selectable-text");
                var msgText = msgTextElem != null ? await msgTextElem.InnerTextAsync() : null;
                if (msgText != null && msgText.Trim() == messageText.Trim())
                {
                    var statusIcon = await msgElem.QuerySelectorAsync("span[data-icon]");
                    var iconType = statusIcon != null ? await statusIcon.GetAttributeAsync("data-icon") : null;
                    _notifier.Notify($"Found status icon: {iconType}");
                    return (iconType, statusIcon);
                }
            }
        }
        // Fallback: use previous logic if no outgoing message matches
        _notifier.Notify("No outgoing message matched, using fallback.");
        var statusIconFallback = await browserSession.QuerySelectorAsync("(//span[@data-icon='msg-check' or @data-icon='msg-dblcheck' or @data-icon='msg-time'])[last()]");
        var iconTypeFallback = statusIconFallback != null ? await statusIconFallback.GetAttributeAsync("data-icon") : null;
        return (iconTypeFallback, statusIconFallback);
    }

    // Helper: Find the retry button for the last msg-time message (flexible selector)
    private async Task<IElementHandle?> FindRetryButtonForLastMsgTimeAsync(IBrowserSession browserSession)
    {
        _notifier.Notify("Searching for retry button for last msg-time message...");
        // Look for a div with role="button" and aria-label containing "Something went wrong"
        var retryButton = await browserSession.QuerySelectorAsync("div[role='button'][aria-label*='Something went wrong']");
        if (retryButton != null)
        {
            _notifier.Notify("Found retry button using aria-label='Something went wrong'.");
            return retryButton;
        }

        // Fallback: look for span with data-icon="error" and get its closest parent with role="button"
        var errorIcon = await browserSession.QuerySelectorAsync("span[data-icon='error']");
        if (errorIcon != null)
        {
            _notifier.Notify("Found error icon, searching for parent retry button...");
            var parentButton = await errorIcon.EvaluateHandleAsync("el => el.closest('div[role=\"button\"]')");
            if (parentButton != null)
            {
                _notifier.Notify("Found retry button as parent of error icon.");
                return parentButton as IElementHandle;
            }
        }

        // Fallback: look for any div[role='button'] with aria-label containing "error" or "wrong"
        var fallback = await browserSession.QuerySelectorAsync("div[role='button'][aria-label*='error'], div[role='button'][aria-label*='wrong']");
        if (fallback != null)
        {
            _notifier.Notify("Found retry button using aria-label containing 'error' or 'wrong'.");
            return fallback;
        }
        _notifier.Notify("Retry button not found.");
        return null;
    }

    // Helper: Find the "Try again" button in the modal (flexible selector)
    private async Task<IElementHandle?> FindTryAgainButtonAsync(IBrowserSession browserSession)
    {
        _notifier.Notify("Searching for 'Try again' button in modal...");
        // Look for a button inside a dialog with text "Try again"
        var tryAgainButton = await browserSession.QuerySelectorAsync("div[role='dialog'] button:has-text('Try again')");
        if (tryAgainButton != null)
        {
            _notifier.Notify("Found 'Try again' button inside dialog.");
            return tryAgainButton;
        }

        // Fallback: look for button with aria-label or text containing "Try again"
        var fallback = await browserSession.QuerySelectorAsync("button[aria-label*='Try again' i], button:has-text('Try again')");
        if (fallback != null)
        {
            _notifier.Notify("Found 'Try again' button using aria-label or text.");
            return fallback;
        }
        _notifier.Notify("'Try again' button not found.");
        return null;
    }
    // ...existing code...

    public async Task<bool> SendMessageAsync(string phoneNumber, string message)
    {
        var result = await ExecuteWithRetryAsync(() => SendMessageWithIconTypeAsync(phoneNumber, message));
        if (!result.Sent && !string.IsNullOrEmpty(result.Error))
        {
            _notifier.Notify(result.Error);
        }
        return result.Sent;
    }
    // Core retry logic for WhatsApp tasks (e.g., sending a message)
    private async Task<(bool Sent, string? IconType, string? Error)> ExecuteWithRetryAsync(
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

    public async Task<bool> SendMessagesAsync(string phoneNumber, IEnumerable<string> messages)
    {
        bool allSent = true;
        foreach (var message in messages)
        {
            var sent = await SendMessageAsync(phoneNumber, message);
            if (!sent)
            {
                allSent = false;
            }
        }
        return allSent;
    }
    // Robust WhatsApp loading/waiting logic with screenshots and progress-aware retry
    private async Task WaitForWhatsAppReadyAsync(IBrowserSession browserSession)
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
        await TrackWhatsAppLoadingScreensAsync(browserSession); // wiring applied here

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
                    string screenshotPath = $"Screenshots/selector_timeout_{SanitizeSelector(selector)}_{DateTime.Now:yyyyMMdd_HHmmss}.png";
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
    private async Task EnsureAuthenticatedAsync(IBrowserSession browserSession, int pollIntervalMs = 2000, int maxWaitMs = 300000)
    {
        // Wait for authentication: poll for QR code or login prompt, and wait until authenticated or timeout
        var qrSelectors = new[] {
            "div[data-ref]",
            "canvas[aria-label*='scan me' i]",
            "div[role='button'] canvas",
            "div[aria-label*='scan me' i]",
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
        bool screenshotTaken = false; // only take one screenshot per session expiry
        int elapsed = 0;
        while (elapsed < maxWaitMs)
        {
            bool needsAuth = false;
            foreach (var qrSelector in qrSelectors)
            {
                var qrElem = await browserSession.QuerySelectorAsync(qrSelector);
                if (qrElem != null)
                {
                    needsAuth = true;
                    if (!screenshotTaken)
                    {
                        string screenshotPath = $"Screenshots/qr_login_{DateTime.Now:yyyyMMdd_HHmmss}.png";
                        await TakeScreenshotAsync(browserSession, screenshotPath);
                        screenshotTaken = true;
                        _notifier.Notify($"WhatsApp session is expired or unavailable. QR code/login page detected (selector: {qrSelector}). Please scan the QR code to log in. Screenshot: {screenshotPath}");
                    }
                    break;
                }
            }
            if (!needsAuth)
            {
                foreach (var prompt in loginPromptTexts)
                {
                    var elem = await browserSession.QuerySelectorAsync($"text={prompt}");
                    if (elem != null)
                    {
                        needsAuth = true;
                        if (!screenshotTaken)
                        {
                            string screenshotPath = $"Screenshots/qr_login_text_{DateTime.Now:yyyyMMdd_HHmmss}.png";
                            await TakeScreenshotAsync(browserSession, screenshotPath);
                            screenshotTaken = true;
                            _notifier.Notify($"WhatsApp session is expired or unavailable. Login prompt detected (text: '{prompt}'). Please scan the QR code to log in. Screenshot: {screenshotPath}");
                        }
                        break;
                    }
                }
            }
            // If not needsAuth, check for WhatsApp header (authenticated)
            if (!needsAuth)
            {
                var header = await browserSession.QuerySelectorAsync("header");
                if (header != null)
                {
                    // Authenticated
                    _notifier.Notify("WhatsApp session is authenticated.");
                    // Track WhatsApp loading screens after authentication
                    await TrackWhatsAppLoadingScreensAsync(browserSession);
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
    private string SanitizeSelector(string selector)
    {
        foreach (var c in System.IO.Path.GetInvalidFileNameChars())
            selector = selector.Replace(c, '_');
        return selector.Replace(" ", "_").Replace("[", "_").Replace("]", "_").Replace("'", "").Replace("\"", "");
    }

    // Helper to take a screenshot using Playwright's page
    private async Task TakeScreenshotAsync(IBrowserSession browserSession, string path)
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

    // Add this helper method to your WhatsAppService class:
    private async Task TrackWhatsAppLoadingScreensAsync(IBrowserSession browserSession)
    {
        // 1. Progress bar (generic, reliable)
        var progressBar = await browserSession.QuerySelectorAsync("progress");
        if (progressBar != null)
        {
            string? lastValue = null;
            for (int i = 0; i < 10; i++) // Poll up to 10 times, adjust as needed
            {
                var value = await progressBar.GetAttributeAsync("value");
                var max = await progressBar.GetAttributeAsync("max");
                if (value != lastValue)
                {
                    _notifier.Notify($"WhatsApp loading progress updated: {value ?? "?"}/{max ?? "?"}. Please be patient...");
                    lastValue = value;
                }
                if (value == max)
                {
                    _notifier.Notify("WhatsApp loading completed.");
                    break;
                }
                await Task.Delay(500);
            }
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
        }

        // 5. Role-based progress bar (reliable)
        var roleProgressBar = await browserSession.QuerySelectorAsync("div[role='progressbar']");
        if (roleProgressBar != null)
        {
            _notifier.Notify("WhatsApp is loading (role=progressbar). Please be patient...");
        }
    }
}
