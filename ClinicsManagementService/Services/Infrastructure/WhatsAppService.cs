
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
    public class WhatsAppService : IWhatsAppService, IDisposable
    {
        private readonly INotifier _notifier;
        private readonly INetworkService _networkService;
        private readonly IWhatsAppUIService _uiService;
        private readonly IRetryService _retryService;
        private readonly IScreenshotService _screenshotService;
        private readonly IWhatsAppSessionManager _sessionManager;
        private readonly CancellationTokenSource _cts = new();

        public WhatsAppService(
            INotifier notifier,
            INetworkService networkService,
            IWhatsAppUIService uiService,
            IRetryService retryService,
            IScreenshotService screenshotService,
            IWhatsAppSessionManager sessionManager)
        {
            _notifier = notifier;
            _networkService = networkService;
            _uiService = uiService;
            _retryService = retryService;
            _screenshotService = screenshotService;
            _sessionManager = sessionManager;
        }

        public async Task<OperationResult<string?>> SendMessageWithIconTypeAsync(string phoneNumber, string message, IBrowserSession browserSession)
        {
            _notifier.Notify($"Starting SendMessageWithIconTypeAsync for {phoneNumber}");
            if (!await CheckInternetConnectivityAsync())
            {
                _notifier.Notify("No internet connectivity detected.");
                return OperationResult<string?>.PendingNET("Internet connection unavailable");
            }
            try
            {
                // var navResult = await NavigateAndCheckRecipientAsync(browserSession, phoneNumber);
                // _notifier.Notify($"Navigation result: Success={navResult.IsSuccess}, Error={navResult.ResultMessage}");
                // if (navResult.IsSuccess == false)
                // {
                //     if (navResult.ResultMessage?.Contains("Session expired") == true || navResult.ResultMessage?.Contains("logged out") == true)
                //     {
                //         _notifier.Notify("🚪 Session expired detected. Returning failure to restart service.");
                //         return OperationResult<string?>.Failure(navResult.ResultMessage ?? "Navigation failed");
                //     }
                //     return OperationResult<string?>.Failure(navResult.ResultMessage ?? "Navigation failed");
                // }
                var result = await DeliverMessageAsync(browserSession, message, phoneNumber);
                _notifier.Notify($"DeliverMessageAsync result: IsSuccess={result?.IsSuccess}, IconType={result?.Data}, ResultMessage={result?.ResultMessage}");
                if (result.IsSuccess == false && (result.ResultMessage?.Contains("Session expired") == true || result.ResultMessage?.Contains("QR code login required") == true))
                {
                    _notifier.Notify("🚪 Session expired detected in delivery. Returning failure to restart service.");
                    return OperationResult<string?>.Failure(result.ResultMessage ?? "Message delivery failed");
                }
                return result ?? OperationResult<string?>.Failure("Message delivery failed: unknown result");
            }
            catch (Exception ex)
            {
                _notifier.Notify($"Exception in SendMessageWithIconTypeAsync: {ex.Message}");
                return OperationResult<string?>.Failure($"Failed: {ex.Message}");
            }
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
                        System.IO.Directory.CreateDirectory(System.IO.Path.GetDirectoryName(path)!);
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


        public Task<OperationResult<bool>> CheckWhatsAppNumberAsync(string phoneNumber, IBrowserSession browserSession)
        {
            return CheckWhatsAppNumberInternalAsync(phoneNumber, browserSession);
        }

        private async Task<OperationResult<bool>> CheckWhatsAppNumberInternalAsync(string phoneNumber, IBrowserSession browserSession)
        {
            bool retried = false;
            IBrowserSession currentSession = browserSession;

            while (true)
            {
                try
                {
                    // Navigate directly to the WhatsApp send URL for the phone number
                    var url = WhatsAppConfiguration.WhatsAppSendUrl + phoneNumber;
                    _notifier.Notify($"🔗 Navigating to {url}...");
                    await currentSession.NavigateToAsync(url);

                    // WaitForPageLoadAsync handles all connectivity/auth/progress monitoring
                        var navRes = await _uiService.WaitForPageLoadAsync(currentSession, WhatsAppConfiguration.ChatUIReadySelectors);
                        // Normalize and centralize result handling
                        var normalizedNav = navRes.Normalize<bool>();
                        if (normalizedNav.IsWaiting())
                        {
                            _notifier.Notify("Navigation is still waiting - will check for error dialogs before deciding.");
                        }
                        else if (normalizedNav.IsPendingNet())
                        {
                            _notifier.Notify($"Navigation interrupted (network): {normalizedNav.ResultMessage}");
                            return OperationResult<bool>.PendingNET(normalizedNav.ResultMessage ?? "Internet issue", false);
                        }
                        else if (normalizedNav.IsPendingQr())
                        {
                            _notifier.Notify($"Navigation interrupted (auth): {normalizedNav.ResultMessage}");
                            return OperationResult<bool>.PendingQR(normalizedNav.ResultMessage ?? "Authentication required", false);
                        }
                        else if (normalizedNav.IsSuccess == false)
                        {
                            _notifier.Notify($"Navigation failed: {normalizedNav.ResultMessage}");
                            return OperationResult<bool>.Failure(normalizedNav.ResultMessage ?? "Navigation failed", false);
                        }
                        else
                        {
                            _notifier.Notify($"Navigation/page-load status: State={normalizedNav.State}, Success={normalizedNav.IsSuccess}, Message={normalizedNav.ResultMessage} - continuing to error-dialog check.");
                        }

                    // Only check error dialog after success page load
                    bool hasError = await CheckForWhatsAppErrorDialog(currentSession);
                    if (hasError)
                    {
                        _notifier.Notify($"❌ Error dialog found - number {phoneNumber} likely does not have WhatsApp.");
                        return OperationResult<bool>.Failure($"Number {phoneNumber} does not have WhatsApp.", false);
                    }
                    // No error dialog and navigation didn't report auth/net blocks -> treat as success
                    return OperationResult<bool>.Success(true);
                }
                catch (Exception ex) when (IsBrowserClosedException(ex))
                {
                    _notifier.Notify($"⚠️ Browser closed while checking number {phoneNumber}: {ex.Message}");
                    if (retried)
                    {
                        return OperationResult<bool>.Failure($"Browser closed during check (after retry): {ex.Message}", false);
                    }

                    // Try one session recreation
                    _notifier.Notify("♻️ Recreating browser session for retry...");
                    retried = true;
                    try
                    {
                        currentSession = await _sessionManager.GetOrCreateSessionAsync();
                        continue;
                    }
                    catch (Exception createEx)
                    {
                        return OperationResult<bool>.Failure($"Failed to recreate session: {createEx.Message}", false);
                    }
                }
                catch (Exception ex)
                {
                    _notifier.Notify($"❌ Exception in CheckWhatsAppNumberAsync for {phoneNumber}: {ex.Message}");
                    return OperationResult<bool>.Failure($"Error checking number: {ex.Message}", false);
                }
            }
        }

        public async Task<OperationResult<bool>> CheckInternetConnectivityDetailedAsync()
        {
            var isConnected = await CheckInternetConnectivityAsync();
            return isConnected ? OperationResult<bool>.Success(true) : OperationResult<bool>.PendingNET("Internet connection unavailable", false);
        }



        public async Task<bool> CheckInternetConnectivityAsync() => await _networkService.CheckInternetConnectivityAsync();

        public async Task<IBrowserSession> PrepareSessionAsync(IBrowserSession browserSession) => await _sessionManager.GetOrCreateSessionAsync();

        // public async Task<OperationResult<bool>> NavigateAndCheckRecipientAsync(IBrowserSession browserSession, string phoneNumber)
        // {
        //     var waitResult = await _uiService.WaitWithMonitoringAsync(browserSession, async () =>
        //     {
        //         var navResult = await _uiService.NavigateToRecipientAsync(browserSession, phoneNumber);
        //         if (navResult != null)
        //         return navResult.IsSuccess;
        //     });
        //     // Robustly handle all result states
        //     if (!waitResult.IsSuccess)
        //     {
        //         if (waitResult.State == OperationState.Waiting)
        //             return OperationResult<bool>.Waiting(false);
        //         if (waitResult.State == OperationState.PendingQR)
        //             return OperationResult<bool>.PendingQR(waitResult.ResultMessage ?? "Authentication required", false);
        //         if (waitResult.State == OperationState.PendingNET)
        //             return OperationResult<bool>.PendingNET(waitResult.ResultMessage ?? "Internet issue", false);
        //         return OperationResult<bool>.Failure(waitResult.ResultMessage ?? "Navigation interrupted", false);
        //     }
        //     // If success, map to Success
        //     return OperationResult<bool>.Success(true);
        // }

        public async Task<OperationResult<string?>> DeliverMessageAsync(
            IBrowserSession browserSession, string message, string? phoneNumber = null, int msgTimeRetryCount = WhatsAppConfiguration.DefaultMsgTimeRetryCount, int maxMsgTimeoutRetryCount = WhatsAppConfiguration.DefaultMaxMsgTimeoutRetryCount)
        {
            return await ExecuteWithCancellationAsync(async (session, ct) =>
            {
                var result = await _uiService.DeliverMessageAsync(session, message, phoneNumber);
                return (result.IsSuccess == true)
                    ? OperationResult<string?>.Success(result.Data)
                    : (result.State == OperationState.PendingQR)
                    ? OperationResult<string?>.PendingQR(result.ResultMessage ?? "Authentication required")
                    : (result.State == OperationState.PendingNET)
                    ? OperationResult<string?>.PendingNET(result.ResultMessage ?? "Internet issue") 
                    : OperationResult<string?>.Failure(result?.ResultMessage ?? "Message delivery failed");
            }, browserSession, "DeliverMessageAsync");
        }

        // Retry logic for message delivery
        public async Task<OperationResult<string?>> ExecuteWithRetryAsync(
            Func<Task<OperationResult<string?>>> taskFunc, int maxAttempts,
            Func<Exception, bool>? treatAsRetryable)
        {
            int attempt = 0;
            while (true)
            {
                try { return await taskFunc(); }
                catch (Exception ex)
                {
                    attempt++;
                    if (attempt >= maxAttempts || (treatAsRetryable != null && !treatAsRetryable(ex)))
                        return OperationResult<string?>.Failure($"Operation failed after {attempt} attempts: {ex.Message}", null);
                }
            }
        }

        // Cancellation-aware execution for browser operations
        private async Task<T> ExecuteWithCancellationAsync<T>(Func<IBrowserSession, CancellationToken, Task<T>> operation, IBrowserSession browserSession, string operationName)
        {
            return await operation(browserSession, _cts.Token);
        }

        private bool IsBrowserClosedException(Exception ex)
        {
            return (ex is PlaywrightException || ex is ObjectDisposedException) &&
                   (ex.Message.Contains("Target page, context or browser has been closed") ||
                    ex.Message.Contains("Browser has been disconnected") ||
                    ex.Message.Contains("Session was closed") ||
                    ex.Message.Contains("Cannot access a disposed object"));
        }

        public async void Dispose()
        {
            try
            {
                _cts.Cancel();
                var session = await _sessionManager.GetCurrentSessionAsync();
                if (session != null)
                {
                    await DisposeBrowserSessionAsync(session);
                }
                _cts.Dispose();
            }
            catch (Exception ex)
            {
                _notifier?.Notify($"⚠️ Error during cleanup: {ex.Message}");
            }
        }



        private async Task<bool> CheckForWhatsAppErrorDialog(IBrowserSession browserSession)
        {
            try
            {
                // First, check if we have a chat textbox (indicates successful navigation to a valid WhatsApp number)
                foreach (var selector in WhatsAppConfiguration.InputFieldSelectors)
                {
                    try
                    {
                        var textbox = await browserSession.QuerySelectorAsync(selector);
                        if (textbox != null)
                        {
                            _notifier.Notify($"✅ Chat textbox found using selector: {selector} - number has WhatsApp");
                            return false; // Has WhatsApp
                        }
                    }
                    catch (Exception ex)
                    {
                        _notifier.Notify($"⚠️ Error checking textbox selector {selector}: {ex.Message}");
                    }
                }

                // If no chat textbox found, check for error dialogs
                foreach (var selector in WhatsAppConfiguration.ErrorDialogSelectors)
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
                _notifier.Notify("⚠️ No chat textbox or error dialog found - unclear status");
                return true; // Default to assuming it hasn't WhatsApp if unclear
            }
            catch (Exception ex)
            {
                _notifier.Notify($"⚠️ Error checking for WhatsApp error dialog: {ex.Message}");
                return true; // On error, assume it hasn't WhatsApp
            }
        }
    }
}