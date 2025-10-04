using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.Services.Domain;
using ClinicsManagementService.Models;
using ClinicsManagementService.Configuration;
using Microsoft.Playwright;
using System;
using System.Linq;
using System.Threading.Tasks;
using System.Threading;

namespace ClinicsManagementService.Services
{
    /// <summary>
    /// Main WhatsApp service that orchestrates domain services
    /// </summary>
    public class WhatsAppService : IWhatsAppService
    {
        private readonly INotifier _notifier;
        private readonly INetworkService _networkService;
        private readonly IWhatsAppAuthenticationService _authenticationService;
        private readonly IWhatsAppUIService _uiService;
        private readonly IRetryService _retryService;
        private readonly IScreenshotService _screenshotService;
        private readonly IWhatsAppSessionManager _sessionManager;

        private readonly CancellationTokenSource _cts = new();

        public WhatsAppService(
            INotifier notifier,
            INetworkService networkService,
            IWhatsAppAuthenticationService authenticationService,
            IWhatsAppUIService uiService,
            IRetryService retryService,
            IScreenshotService screenshotService,
            IWhatsAppSessionManager sessionManager)
        {
            _notifier = notifier;
            _networkService = networkService;
            _authenticationService = authenticationService;
            _uiService = uiService;
            _retryService = retryService;
            _screenshotService = screenshotService;
            _sessionManager = sessionManager;
        }
        /*
        Use this when:
            You need to handle browser session operations that might be long-running
            The operation requires cancellation support
            You want to track browser closure specifically
            The operation is critical and needs proper cleanup
        */ 
        private async Task<T> ExecuteWithCancellationAsync<T>(Func<IBrowserSession, CancellationToken, Task<T>> operation,
            IBrowserSession browserSession,
            string operationName)
        {
            try
            {
                return await operation(browserSession, _cts.Token);
            }
            catch (Exception ex) when (IsBrowserClosedException(ex))
            {
                _notifier.Notify($"❌ Browser was closed during {operationName}");
                throw new BrowserClosedException($"Browser closed while {operationName}", ex);
            }
        }

        private bool IsBrowserClosedException(Exception ex)
        {
            return ex is PlaywrightException pex &&
                   (pex.Message.Contains("Target page, context or browser has been closed") ||
                    pex.Message.Contains("Browser has been disconnected"));
        }

        public async Task<bool> CheckInternetConnectivityAsync()
        {
            return await _networkService.CheckInternetConnectivityAsync();
        }

        public async Task<IBrowserSession> PrepareSessionAsync(IBrowserSession browserSession)
        {
            // Use the singleton session manager instead of creating new sessions
            return await _sessionManager.GetOrCreateSessionAsync();
        }

        public async Task<(bool Success, string? Error)> NavigateAndCheckRecipientAsync(IBrowserSession browserSession, string phoneNumber)
        {
            var result = await _uiService.NavigateToRecipientAsync(browserSession, phoneNumber);
            return (result.Success, result.Error);
        }

        public async Task<(bool Sent, string? IconType, string? Error)> DeliverMessageAsync(
            IBrowserSession browserSession, string message, string? phoneNumber = null, int msgTimeRetryCount = WhatsAppConfiguration.DefaultMsgTimeRetryCount, int maxMsgTimeoutRetryCount = WhatsAppConfiguration.DefaultMaxMsgTimeoutRetryCount)
        {
            var result = await _uiService.DeliverMessageAsync(browserSession, message, phoneNumber);
            return (result.Sent, result.IconType, result.Error);
        }

        public async Task TrackWhatsAppLoadingScreensAsync(IBrowserSession browserSession)
        {
            await _authenticationService.TrackLoadingScreensAsync(browserSession);
        }

        public async Task WaitForWhatsAppReadyAsync(IBrowserSession browserSession)
        {
            // Track WhatsApp loading screens before waiting for loading/progress bar to disappear
            await _authenticationService.TrackLoadingScreensAsync(browserSession);

            // 1. Wait for the loading/progress bar to disappear (if present)
            try
            {
                _notifier.Notify("Waiting for WhatsApp loading/progress bar to disappear...");
                await browserSession.WaitForSelectorAsync(
                    // "div[role='progressbar'], div[class*='x1n2onr6'] progress, div[aria-label^='Loading your chats']",
                    string.Join(", ", WhatsAppConfiguration.ProgressBarSelectors),
                    60000, WaitForSelectorState.Detached);
                _notifier.Notify("WhatsApp loading bar disappeared, proceeding...");
            }
            catch (TimeoutException ex)
            {
                string screenshotPath = $"Screenshots/loadingbar_timeout_{DateTime.Now:yyyyMMdd_HHmmss}.png";
                await _screenshotService.TakeScreenshotAsync(browserSession, screenshotPath);
                _notifier.Notify($"Loading bar did not disappear in time: {ex.Message}. Screenshot: {screenshotPath}. Proceeding anyway...");
            }

            // Track WhatsApp loading screens after waiting for loading/progress bar to disappear
            await _authenticationService.TrackLoadingScreensAsync(browserSession);

            // 2. Ensure authentication (QR code login/session check)
            await _authenticationService.EnsureAuthenticatedAsync(browserSession);

            // 3. Wait for the main UI to be ready (try multiple selectors, retry if progress/loading is present)
            int maxAttempts = 100; // Effectively infinite, but prevents infinite loop in case of logic bug
            int attempt = 0;
            while (attempt < maxAttempts)
            {
                foreach (var selector in WhatsAppConfiguration.ChatUIReadySelectors)
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
                        string screenshotPath = $"Screenshots/ready_timeout_{_screenshotService.SanitizeSelector(selector)}_{DateTime.Now:yyyyMMdd_HHmmss}.png";
                        await _screenshotService.TakeScreenshotAsync(browserSession, screenshotPath);
                        _notifier.Notify($"Timeout waiting for selector: {selector} - {ex.Message}. Screenshot: {screenshotPath}");
                        // Check if a loading/progress bar is present, and if so, wait for it to disappear and retry
                        foreach (var progressSelector in WhatsAppConfiguration.ProgressBarSelectors)
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
                {
                    // Check if it's a session expiration error
                    if (navResult.Error?.Contains("Session expired") == true || navResult.Error?.Contains("logged out") == true)
                    {
                        _notifier.Notify("🚪 Session expired detected. Returning failure to restart service.");
                        return (false, null, navResult.Error);
                    }
                    return (false, null, navResult.Error);
                }

                var result = await DeliverMessageAsync(browserSession, message, phoneNumber);
                _notifier.Notify($"DeliverMessageAsync result: Sent={result.Sent}, IconType={result.IconType}, Error={result.Error}");

                // Check if the delivery result indicates session expiration
                if (!result.Sent && (result.Error?.Contains("Session expired") == true || result.Error?.Contains("QR code login required") == true))
                {
                    _notifier.Notify("🚪 Session expired detected in delivery. Returning failure to restart service.");
                    return (false, null, result.Error);
                }

                return result;
            }
            catch (Exception ex)
            {
                _notifier.Notify($"Exception in SendMessageWithIconTypeAsync: {ex.Message}");

                // Check if it's a fatal exception
                if (IsFatalException(ex))
                {
                    _notifier.Notify($"🚨 FATAL EXCEPTION in SendMessageWithIconTypeAsync: {ex.GetType().Name}");
                    _notifier.Notify("🛡️ Attempting graceful handling to prevent system crash...");

                    try
                    {
                        // Attempt graceful recovery
                        var recoveryResult = await AttemptGracefulRecovery(ex);
                        if (recoveryResult.HasValue)
                        {
                            return recoveryResult.Value;
                        }
                    }
                    catch (Exception recoveryEx)
                    {
                        _notifier.Notify($"⚠️ Graceful recovery failed: {recoveryEx.Message}");
                    }

                    // If recovery fails, return a safe failure instead of crashing
                    return (false, null, $"Failed: Fatal exception handled gracefully - {ex.GetType().Name}");
                }

                // Check for network errors
                if (ex.Message.Contains("ERR_NAME_NOT_RESOLVED") || ex.Message.Contains("net::"))
                {
                    _notifier.Notify("🌐 Network error detected during message sending.");
                    return (false, null, "PendingNET: Internet connection unavailable");
                }

                return (false, null, $"Failed: {ex.Message}");
            }
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
        public async Task<(bool Sent, string? IconType, string? Error)?> AttemptGracefulRecovery(Exception ex)
        {
            try
            {
                _notifier.Notify("🔄 Attempting graceful recovery from fatal exception in WhatsAppService...");

                // Step 1: Check internet connectivity
                if (!await CheckInternetConnectivityAsync())
                {
                    _notifier.Notify("❌ Internet connectivity lost during fatal exception recovery");
                    return (false, null, "PendingNET: Internet connection unavailable");
                }

                // Step 2: Try to get a fresh browser session
                try
                {
                    _notifier.Notify("🔄 Attempting to get fresh browser session for recovery...");
                    var browserSession = await _sessionManager.GetOrCreateSessionAsync();
                    _notifier.Notify("✅ Successfully obtained fresh browser session");

                    // Return null to continue with normal retry logic
                    return null;
                }
                catch (Exception sessionEx)
                {
                    _notifier.Notify($"⚠️ Browser session recovery failed: {sessionEx.Message}");
                    return (false, null, "Failed: Browser session recovery failed after fatal exception");
                }
            }
            catch (Exception recoveryEx)
            {
                _notifier.Notify($"❌ Graceful recovery failed: {recoveryEx.Message}");
                return (false, null, $"Failed: Graceful recovery failed - {recoveryEx.Message}");
            }
        }

        public async Task<(bool Sent, string? IconType, string? Error)> ExecuteWithRetryAsync(
            Func<Task<(bool Sent, string? IconType, string? Error)>> taskFunc,
            int maxAttempts = WhatsAppConfiguration.DefaultMaxRetryAttempts,
            Func<Exception, bool>? treatAsRetryable = null)
        {
            try
            {
                return await _retryService.ExecuteWithRetryAsync(taskFunc, maxAttempts, treatAsRetryable);
            }
            catch (Exception ex)
            {
                return (false, null, ex.Message);
            }
        }

        public async Task EnsureAuthenticatedAsync(IBrowserSession browserSession, int pollIntervalMs = WhatsAppConfiguration.DefaultAuthenticationPollIntervalMs, int maxWaitMs = WhatsAppConfiguration.DefaultAuthenticationMaxWaitMs)
        {
            await _authenticationService.EnsureAuthenticatedAsync(browserSession);
        }

        public string SanitizeSelector(string selector)
        {
            foreach (var c in System.IO.Path.GetInvalidFileNameChars())
                selector = selector.Replace(c, '_');
            return selector.Replace(" ", "_").Replace("[", "_").Replace("]", "_").Replace("'", "").Replace("\"", "");
        }

        public async Task TakeScreenshotAsync(IBrowserSession browserSession, string path)
        {
            try
            {
                if (browserSession is ClinicsManagementService.Services.PlaywrightBrowserSession pbs)
                {
                    var pageField = typeof(ClinicsManagementService.Services.PlaywrightBrowserSession)
                        .GetField("_page", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);

                    if (pageField?.GetValue(pbs) is Microsoft.Playwright.IPage page)
                    {
                        Directory.CreateDirectory(System.IO.Path.GetDirectoryName(path)!);
                        await page.ScreenshotAsync(new Microsoft.Playwright.PageScreenshotOptions { Path = path });
                    }
                }
            }
            catch (Exception ex)
            {
                _notifier.Notify($"Failed to take screenshot: {ex.Message}");
            }
        }

        public async Task DisposeBrowserSessionAsync(IBrowserSession browserSession)
        {
            _notifier.Notify("Disposing browser session...");
            if (browserSession is IAsyncDisposable asyncDisposable)
                await asyncDisposable.DisposeAsync();
            else if (browserSession is IDisposable disposable)
                disposable.Dispose();
            _notifier.Notify("Disposed browser session.");
        }

        /// <summary>
        /// Checks if a phone number has WhatsApp by attempting to navigate to their chat
        /// </summary>
        public async Task<WhatsAppNumberCheckResult> CheckWhatsAppNumberAsync(string phoneNumber, IBrowserSession browserSession)
        {
            try
            {
                return await ExecuteWithCancellationAsync(async (session, ct) =>
                {
                    _notifier.Notify($"🔍 Checking if {phoneNumber} has WhatsApp...");

                    // Check if session is still valid
                    if (ct.IsCancellationRequested)
                    {
                        return WhatsAppNumberCheckResult.Failure("Operation cancelled - browser was closed");
                    }

                    int maxRetries = 2; // Allow one retry
                    int currentAttempt = 0;

                    while (currentAttempt < maxRetries)
                    {
                        currentAttempt++;
                        _notifier.Notify($"🔄 Attempt {currentAttempt}/{maxRetries} for checking {phoneNumber}");

                        try
                        {
                            // Step 1: Navigate to WhatsApp session with phone number
                            _notifier.Notify($"🌐 Navigating to WhatsApp session with phone number: {phoneNumber}");
                            await browserSession.NavigateToAsync($"{WhatsAppConfiguration.WhatsAppSendUrl + phoneNumber}");

                            // // Step 2: Check for progress bars first
                            // _notifier.Notify("⏳ Step 1: Checking for progress bars...");
                            // await HandleProgressBarsForCheckAsync(browserSession);

                            // // Step 3: Check if there is any other progress bar
                            // _notifier.Notify("⏳ Step 2: Checking for additional progress bars...");
                            // await HandleProgressBarsForCheckAsync(browserSession);

                            // // Step 4: Check for authentication selectors (QR code, login prompts)
                            // _notifier.Notify("🔐 Step 3: Checking for authentication selectors...");
                            // var authResult = await CheckAuthenticationSelectorsAsync(browserSession);
                            // if (authResult != null)
                            // {
                            //     return authResult;
                            // }

                            // // Step 5: Check for WhatsApp UI elements and focus on input field
                            // _notifier.Notify("🔍 Step 4: Checking for WhatsApp UI elements...");

                            // // Check for authentication before proceeding with UI elements
                            // var authResult2 = await CheckAuthenticationSelectorsAsync(browserSession);
                            // if (authResult2 != null)
                            // {
                            //     return authResult2;
                            // }

                            // Check for basic UI elements directly (no waiting needed)
                            try
                            {
                                var waitUI = await WaitWithMonitoringAsync(browserSession, async () =>
                                    {
                                        foreach (var selector in WhatsAppConfiguration.ChatUIReadySelectors)
                                        {
                                            var header = await browserSession.QuerySelectorAsync(selector);
                                            if (header != null)
                                            {
                                                _notifier.Notify($"✅ Basic UI element found using selector: {selector}");
                                                return true;
                                            }
                                        }
                                        return false;
                                    }, 20000, 1000);

                            }
                            catch (Exception uiEx)
                            {
                                _notifier.Notify($"⚠️ Error checking basic UI elements: {uiEx.Message}");
                            }

                            // Focus on input field to ensure the number has WhatsApp
                            _notifier.Notify("🎯 Step 5: Focusing on input field...");

                            // // Check for authentication before focusing input
                            // var authResult3 = await CheckAuthenticationSelectorsAsync(browserSession);
                            // if (authResult3 != null)
                            // {
                            //     return authResult3;
                            // }

                            // MessageDeliveryResult? waitResult = await WaitWithMonitoringAsync(browserSession, async () =>
                            // {
                            //     // Check for any UI-ready selectors or input fields
                            //     foreach (var selector in WhatsAppConfiguration.ChatUIReadySelectors.Concat(WhatsAppConfiguration.ChatUIReadySelectors))
                            //     {
                            //         var elem = await browserSession.QuerySelectorAsync(selector);
                            //         if (elem != null)
                            //             return true;
                            //     }
                            //     return false;
                            // }, 5000, 500);

                            bool inputFound = false;
                            var uiWaitResult = await WaitWithMonitoringAsync(browserSession, async () =>
                            {
                                foreach (var selector in WhatsAppConfiguration.InputFieldSelectors)
                                {
                                    try
                                    {
                                        var input = await browserSession.QuerySelectorAsync(selector);
                                        if (input != null)
                                        {
                                            _notifier.Notify($"✅ Input field found using selector: {selector}");
                                            await input.FocusAsync();
                                            _notifier.Notify("✅ Input field focused successfully");
                                            inputFound = true;
                                            return true;
                                        }
                                    }
                                    catch (Exception inputEx)
                                    {
                                        _notifier.Notify($"⚠️ Error with input selector {selector}: {inputEx.Message}");
                                    }
                                }
                                return false;
                            }, 5000, 1000);

                            if (uiWaitResult != null)
                                return WhatsAppNumberCheckResult.Failure(uiWaitResult.Error ?? "Navigation interrupted by authentication or progress bar");

                            if (inputFound)
                            {
                                _notifier.Notify($"✅ Number {phoneNumber} has WhatsApp - input field found and focused");
                                return WhatsAppNumberCheckResult.Success();
                            }

                            // Step 6: Check for error dialog (no WhatsApp for this number)
                            _notifier.Notify("🚫 Step 6: Checking for error dialogs...");

                            // // Check for authentication before checking error dialogs
                            // var authResult4 = await CheckAuthenticationSelectorsAsync(browserSession);
                            // if (authResult4 != null)
                            // {
                            //     return authResult4;
                            // }

                            // Check for error dialog selectors
                            var uiWaitResult2 = await WaitWithMonitoringAsync(browserSession, async () =>
                            {
                                foreach (var selector in WhatsAppConfiguration.ErrorDialogSelectors)
                                {
                                    try
                                    {
                                        // Check for error dialog directly without waiting
                                        var errorDialog = await browserSession.QuerySelectorAsync(selector);
                                        if (errorDialog != null)
                                        {
                                            _notifier.Notify($"🚫 Error dialog detected using selector: {selector}");
                                            return true;
                                        }
                                    }
                                    catch (Exception ex)
                                    {
                                        _notifier.Notify($"⚠️ Error checking selector {selector}: {ex.Message}");
                                    }
                                }
                                return false;
                            }, timeoutMs: 5000);

                            if (uiWaitResult2 != null)
                                return WhatsAppNumberCheckResult.Failure(uiWaitResult2.Error ?? "Navigation interrupted by authentication or progress bar");

                            // Also check for the specific text content
                            try
                            {
                                // Check for error text directly without waiting
                                var errorText = await browserSession.QuerySelectorAsync("text='Phone number shared via url is invalid'");
                                if (errorText != null)
                                {
                                    _notifier.Notify("🚫 WhatsApp error dialog detected by text content");
                                    return WhatsAppNumberCheckResult.Failure($"Number {phoneNumber} does not have WhatsApp");
                                }
                            }
                            catch { /* ignore */ }

                            // If we get here, no clear indicators found
                            _notifier.Notify($"⚠️ Cannot determine WhatsApp status for {phoneNumber} - no clear indicators found");
                            return WhatsAppNumberCheckResult.Failure("Cannot determine WhatsApp status - no clear indicators found");
                        }
                        catch (Exception ex)
                        {
                            _notifier.Notify($"❌ Exception in attempt {currentAttempt} for {phoneNumber}: {ex.Message}");

                            // Check for internet connectivity first
                            if (ex.Message.Contains("ERR_NAME_NOT_RESOLVED") || ex.Message.Contains("net::"))
                            {
                                var hasInternet = await CheckInternetConnectivityAsync();
                                if (hasInternet)
                                {
                                    _notifier.Notify("✅ Internet connectivity restored");
                                    if (currentAttempt < maxRetries)
                                    {
                                        _notifier.Notify("🔄 Retrying due to internet connectivity issue...");
                                        continue;
                                    }
                                }
                                else if (!hasInternet)
                                {
                                    _notifier.Notify("🌐 Internet connectivity issue detected");
                                    return WhatsAppNumberCheckResult.PendingNET("Cannot check due to internet connectivity issues");
                                }
                            }

                            // Check for authentication issues
                            if (ex.Message.Contains("Target page, context or browser has been closed"))
                            {
                                _notifier.Notify("🔐 Authentication issue detected");
                                if (currentAttempt < maxRetries)
                                {
                                    _notifier.Notify("🔄 Retrying due to authentication issue...");
                                    continue;
                                }
                                return WhatsAppNumberCheckResult.PendingQR("Cannot check due to WhatsApp authentication issues");
                            }

                            // For other exceptions, retry once
                            if (currentAttempt < maxRetries)
                            {
                                _notifier.Notify($"🔄 Retrying entire task due to exception: {ex.GetType().Name}");
                                continue;
                            }

                            return WhatsAppNumberCheckResult.Failure($"Cannot check WhatsApp number after {maxRetries} attempts: {ex.Message}");
                        }
                    }

                    return WhatsAppNumberCheckResult.Failure($"Failed to check WhatsApp number after {maxRetries} attempts");
                }, browserSession, $"checking number {phoneNumber}");
            }
            catch (BrowserClosedException)
            {
                return WhatsAppNumberCheckResult.Failure("Operation cancelled - browser was closed");
            }
            catch (Exception ex)
            {
                return WhatsAppNumberCheckResult.Failure($"Unexpected error: {ex.Message}");
            }
        }

        /// <summary>
        /// Enhanced progress bar handling for check-whatsapp endpoint
        /// </summary>
        public async Task HandleProgressBarsForCheckAsync(IBrowserSession browserSession)
        {
            _notifier.Notify("🔍 Checking for progress bars and loading indicators...");

            // Multiple progress bar selectors (from BeforeSOLID project)
            var progressSelectors = WhatsAppConfiguration.ProgressBarSelectors;

            foreach (var progressSelector in progressSelectors)
            {
                try
                {
                    var progress = await browserSession.QuerySelectorAsync(progressSelector);
                    if (progress != null)
                    {
                        _notifier.Notify($"⏳ Progress/loading bar detected ({progressSelector}), waiting for it to disappear...");

                        try
                        {
                            await browserSession.WaitForSelectorAsync(progressSelector, 30000, WaitForSelectorState.Detached);
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
            foreach (var textSelector in WhatsAppConfiguration.LoadingTextSelectors)
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

        private async Task<WhatsAppNumberCheckResult?> CheckAuthenticationSelectorsAsync(IBrowserSession browserSession)
        {
            _notifier.Notify("🔐 Checking for authentication selectors...");

            // Check for progress bars first
            await HandleProgressBarsForCheckAsync(browserSession);

            // Check for QR code and authentication selectors
            var authSelectors = WhatsAppConfiguration.QrCodeSelectors;

            foreach (var selector in authSelectors)
            {
                try
                {
                    var authElement = await browserSession.QuerySelectorAsync(selector);
                    if (authElement != null)
                    {
                        _notifier.Notify($"🔐 Authentication selector detected ({selector}) - session needs authentication");
                        return WhatsAppNumberCheckResult.PendingQR("WhatsApp authentication required. Please scan QR code.");
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
                    _notifier.Notify("🔐 Logout detected in URL - session needs authentication");
                    return WhatsAppNumberCheckResult.PendingQR("WhatsApp session expired. Please scan QR code.");
                }
            }
            catch (Exception ex)
            {
                _notifier.Notify($"⚠️ Error checking URL: {ex.Message}");
            }

            _notifier.Notify("✅ No authentication selectors found - session appears authenticated");
            return null; // No authentication needed
        }

        /// <summary>
        /// Continuous monitoring for progress bars and authentication issues
        /// This method runs as a side job to interrupt waiting operations
        /// </summary>
        private async Task<WhatsAppNumberCheckResult?> ContinuousMonitoringAsync(IBrowserSession browserSession, int timeoutMs = 5000)
        {
            try
            {
                // Check for progress bars
                var progressSelectors = WhatsAppConfiguration.ProgressBarSelectors;

                foreach (var progressSelector in progressSelectors)
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
                            return WhatsAppNumberCheckResult.PendingQR("WhatsApp authentication required. Please scan QR code.");
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
                        return WhatsAppNumberCheckResult.PendingQR("WhatsApp session expired. Please scan QR code.");
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
        private async Task<WhatsAppNumberCheckResult?> WaitWithMonitoringAsync(IBrowserSession browserSession, Func<Task<bool>> waitCondition, int timeoutMs = 20000, int checkIntervalMs = 2000)
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

                // Run continuous monitoring
                var monitoringResult = await ContinuousMonitoringAsync(browserSession, checkIntervalMs);
                if (monitoringResult != null)
                {
                    return monitoringResult; // Authentication or progress bar issue detected
                }

                // Wait before next check
                await Task.Delay(checkIntervalMs);
            }

            _notifier.Notify($"⏰ Wait timeout after {timeoutMs}ms");
            return null; // Timeout
        }

        /// <summary>
        /// Checks internet connectivity
        /// </summary>
        public async Task<InternetConnectivityResult> CheckInternetConnectivityDetailedAsync()
        {
            _notifier.Notify("🌐 Checking internet connectivity...");

            try
            {
                var isConnected = await CheckInternetConnectivityAsync();
                if (isConnected)
                {
                    _notifier.Notify("✅ Internet connectivity confirmed.");
                    return InternetConnectivityResult.Success();
                }
                else
                {
                    _notifier.Notify("❌ Internet connectivity failed.");
                    return InternetConnectivityResult.Failure("Internet connection unavailable");
                }
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Internet connectivity check failed: {ex.Message}");
                return InternetConnectivityResult.Failure($"Connectivity check failed: {ex.Message}");
            }
        }

        /// <summary>
        /// Checks WhatsApp authentication status with enhanced progress bar handling
        /// </summary>
        public async Task<WhatsAppAuthenticationResult> CheckWhatsAppAuthenticationAsync(IBrowserSession browserSession)
        {
            _notifier.Notify("🔐 Checking WhatsApp authentication status...");

            try
            {
                // Navigate to WhatsApp Web
                await browserSession.NavigateToAsync(WhatsAppConfiguration.WhatsAppBaseUrl);
                await Task.Delay(3000); // Wait for page to load

                // Step 1: Wait for progress bars to disappear
                _notifier.Notify("⏳ Step 1: Waiting for progress bars to disappear...");
                await HandleProgressBarsForCheckAsync(browserSession);

                // Step 2: Check for additional progress bars
                _notifier.Notify("⏳ Step 2: Checking for additional progress bars...");
                await HandleProgressBarsForCheckAsync(browserSession);

                // Step 3: Check for QR code selectors with timeout
                _notifier.Notify("🔐 Step 3: Checking for QR code selectors...");

                bool qrCodeFound = false;
                foreach (var selector in WhatsAppConfiguration.QrCodeSelectors)
                {
                    try
                    {
                        var qrElement = await browserSession.QuerySelectorAsync(selector);
                        if (qrElement != null)
                        {
                            _notifier.Notify($"🔐 QR code detected using selector: {selector}");
                            qrCodeFound = true;
                            break;
                        }
                    }
                    catch (Exception ex)
                    {
                        _notifier.Notify($"⚠️ Error checking QR selector {selector}: {ex.Message}");
                    }
                }

                // Step 4: Check for chat UI selectors with timeout
                _notifier.Notify("💬 Step 4: Checking for chat UI selectors...");

                bool chatUIFound = false;
                foreach (var selector in WhatsAppConfiguration.ChatUIReadySelectors)
                {
                    try
                    {
                        var chatElement = await browserSession.QuerySelectorAsync(selector);
                        if (chatElement != null)
                        {
                            _notifier.Notify($"💬 Chat UI detected using selector: {selector}");
                            chatUIFound = true;
                            break;
                        }
                    }
                    catch (Exception ex)
                    {
                        _notifier.Notify($"⚠️ Error checking chat selector {selector}: {ex.Message}");
                    }
                }

                // Step 5: Determine authentication status based on findings
                if (qrCodeFound && !chatUIFound)
                {
                    _notifier.Notify("❌ QR code found but no chat UI - session not authenticated");
                    return WhatsAppAuthenticationResult.PendingQR("WhatsApp authentication required. Please scan QR code.");
                }
                else if (!qrCodeFound && chatUIFound)
                {
                    _notifier.Notify("✅ Chat UI found but no QR code - session is authenticated");
                    return WhatsAppAuthenticationResult.Success();
                }
                else if (qrCodeFound && chatUIFound)
                {
                    _notifier.Notify("⚠️ Both QR code and chat UI found - ambiguous state");
                    return WhatsAppAuthenticationResult.Failure("Ambiguous authentication state - both QR code and chat UI detected");
                }
                else
                {
                    _notifier.Notify("❌ Neither QR code nor chat UI found - session may not be ready");
                    return WhatsAppAuthenticationResult.Failure("WhatsApp UI not ready. Session may not be authenticated.");
                }
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Exception checking WhatsApp authentication: {ex.Message}");

                // Check for network errors
                if (ex.Message.Contains("ERR_NAME_NOT_RESOLVED") || ex.Message.Contains("net::") || ex.Message.Contains("Timeout"))
                {
                    _notifier.Notify("🌐 Network or timeout error detected - checking internet connectivity");
                    if (!await CheckInternetConnectivityAsync())
                    {
                        return WhatsAppAuthenticationResult.PendingNET("Internet connection unavailable");
                    }
                    return WhatsAppAuthenticationResult.Failure($"Authentication check failed due to network issues: {ex.Message}");
                }

                return WhatsAppAuthenticationResult.Failure($"Authentication check failed: {ex.Message}");
            }
        }

        /// <summary>
        /// Authenticates WhatsApp session by waiting for QR code scan
        /// </summary>
        public async Task<WhatsAppAuthenticationResult> AuthenticateWhatsAppAsync(IBrowserSession browserSession)
        {
            _notifier.Notify("🔐 Starting WhatsApp authentication process...");

            try
            {
                // Navigate to WhatsApp Web
                await browserSession.NavigateToAsync(WhatsAppConfiguration.WhatsAppBaseUrl);

                // Wait for authentication to complete
                await _authenticationService.EnsureAuthenticatedAsync(browserSession);

                // Verify authentication by checking for chat UI
                var chatListSelectors = WhatsAppConfiguration.ChatUIReadySelectors;

                foreach (var selector in chatListSelectors)
                {
                    try
                    {
                        var chatElement = await browserSession.QuerySelectorAsync(selector);
                        if (chatElement != null)
                        {
                            _notifier.Notify("✅ WhatsApp authentication successful.");
                            return WhatsAppAuthenticationResult.Success();
                        }
                    }
                    catch { /* ignore errors */ }
                }

                _notifier.Notify("❌ WhatsApp authentication completed but UI not ready.");
                return WhatsAppAuthenticationResult.Failure("Authentication completed but WhatsApp UI not ready.");
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Exception during WhatsApp authentication: {ex.Message}");

                // Check for network errors

                if (ex.Message.Contains("ERR_NAME_NOT_RESOLVED") || ex.Message.Contains("net::"))
                {
                    return WhatsAppAuthenticationResult.PendingNET("Internet connection unavailable");
                }

                // First check internet connectivity
                if (!await CheckInternetConnectivityAsync())
                {
                    _notifier.Notify("❌ No internet connectivity for authentication.");
                    return WhatsAppAuthenticationResult.PendingNET("Internet connection unavailable");
                }

                return WhatsAppAuthenticationResult.Failure($"Authentication failed: {ex.Message}");
            }
        }

        private async Task<bool> CheckForWhatsAppErrorDialog(IBrowserSession browserSession)
        {
            try
            {
                // First, check if we have a chat textbox (indicates successful navigation to a valid WhatsApp number)
                var chatTextboxSelectors = WhatsAppConfiguration.InputFieldSelectors;

                bool hasChatTextbox = false;
                foreach (var selector in chatTextboxSelectors)
                {
                    try
                    {
                        var textbox = await browserSession.QuerySelectorAsync(selector);
                        if (textbox != null)
                        {
                            _notifier.Notify($"✅ Chat textbox found using selector: {selector} - number has WhatsApp");
                            hasChatTextbox = true;
                            break;
                        }
                    }
                    catch (Exception ex)
                    {
                        _notifier.Notify($"⚠️ Error checking textbox selector {selector}: {ex.Message}");
                    }
                }

                if (hasChatTextbox)
                {
                    return false; // Has WhatsApp
                }

                // If no chat textbox found, check for error dialogs
                var errorDialogSelectors = new[]
                {
                    "div[role='dialog'] div[data-animate-modal-popup='true'][aria-label*='Phone number shared via url is invalid']",
                    "div[role='dialog'] div[data-animate-modal-popup='true'][aria-label*='Phone number shared via url is invalid.']",
                    "div[role='dialog'] div[data-animate-modal-body='true'] div:has-text('Phone number shared via url is invalid')",
                    "div[role='dialog'] div:has-text('Phone number shared via url is invalid')",
                    "div[data-animate-modal-popup='true'][aria-label*='Phone number shared via url is invalid']"
                };

                foreach (var selector in errorDialogSelectors)
                {
                    try
                    {
                        var errorDialog = await browserSession.QuerySelectorAsync(selector);
                        if (errorDialog != null)
                        {
                            _notifier.Notify($"🚫 WhatsApp error dialog detected using selector: {selector}");
                            return true;
                        }
                    }
                    catch (Exception ex)
                    {
                        _notifier.Notify($"⚠️ Error checking selector {selector}: {ex.Message}");
                    }
                }

                // Also check for the specific text content
                try
                {
                    var errorText = await browserSession.QuerySelectorAsync("text='Phone number shared via url is invalid'");
                    if (errorText != null)
                    {
                        _notifier.Notify("🚫 WhatsApp error dialog detected by text content");
                        return true;
                    }
                }
                catch { /* ignore */ }

                _notifier.Notify("⚠️ No chat textbox or error dialog found - unclear status");
                return false; // Default to assuming it has WhatsApp if unclear
            }
            catch (Exception ex)
            {
                _notifier.Notify($"⚠️ Error checking for WhatsApp error dialog: {ex.Message}");
                return false;
            }
        }
        public void Dispose()
        {
            try
            {
                _cts.Cancel();
                _cts.Dispose();
            }
            catch { }
        }
    }
    public class BrowserClosedException : Exception
    {
        public BrowserClosedException(string message, Exception inner) : base(message, inner) { }
    }
}