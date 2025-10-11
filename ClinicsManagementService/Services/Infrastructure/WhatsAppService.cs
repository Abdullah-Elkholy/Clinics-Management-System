
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
        private readonly IRetryService _retryService;
        private readonly IWhatsAppUIService _uiService;
        private readonly IWhatsAppSessionManager _sessionManager;
        private readonly CancellationTokenSource _cts = new();

        public WhatsAppService(
            INotifier notifier,
            INetworkService networkService,
            IWhatsAppUIService uiService,
            IWhatsAppSessionManager sessionManager,
            IRetryService retryService)
        {
            _notifier = notifier;
            _networkService = networkService;
            _retryService = retryService;
            _uiService = uiService;
            _sessionManager = sessionManager;
        }

        public async Task<OperationResult<string?>> SendMessageWithIconTypeAsync(string phoneNumber, string message, IBrowserSession browserSession)
        {
            // Should be completed, BUT LATER
            try
            {
                return OperationResult<string?>.Failure("Message delivery failed: unknown result");
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
                if (browserSession is PlaywrightBrowserSession pbs)
                {
                    var pageField = typeof(PlaywrightBrowserSession)
                        .GetField("_page", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
                    if (pageField?.GetValue(pbs) is IPage page)
                    {
                        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
                        await page.ScreenshotAsync(new PageScreenshotOptions { Path = path });
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
            try
            {
                _notifier.Notify($"Disposing browser session... (timestamp: {DateTime.UtcNow:O})");
                // Log call-site stack to help trace who triggered disposal
                var stack = Environment.StackTrace;
                _notifier.Notify($"Dispose called from stack:\n{stack}");

                if (browserSession is IAsyncDisposable asyncDisposable)
                    await asyncDisposable.DisposeAsync();
                else if (browserSession is IDisposable disposable)
                    disposable.Dispose();

                _notifier.Notify($"Disposed browser session. (timestamp: {DateTime.UtcNow:O})");
            }
            catch (Exception ex)
            {
                _notifier.Notify($"Error disposing browser session: {ex.GetType().Name}: {ex.Message}\nStack: {ex.StackTrace}");
                throw;
            }
        }


        public Task<OperationResult<bool>> CheckWhatsAppNumberAsync(string phoneNumber, IBrowserSession browserSession)
        {
            // Apply full-operation retry at the public entry point so callers get retries on Waiting results
            // and Playwright/browser-closed exceptions. This keeps the internal method single-pass and
            // simpler to reason about.
            return _retryService.ExecuteWithRetryAsync<bool>(
                () => CheckWhatsAppNumberInternalAsync(phoneNumber, browserSession),
                maxAttempts: Math.Max(1, WhatsAppConfiguration.DefaultMaxRetryAttempts),
                shouldRetryResult: r => r?.IsWaiting() == true,
                isRetryable: ex => _retryService.IsBrowserClosedException(ex));
        }

        private async Task<OperationResult<bool>> CheckWhatsAppNumberInternalAsync(string phoneNumber, IBrowserSession browserSession)
        {
            try
            {
                await browserSession.InitializeAsync();
                // Navigate directly to the WhatsApp send URL for the phone number
                var url = WhatsAppConfiguration.WhatsAppSendUrl + phoneNumber;
                _notifier.Notify($"🔗 Navigating to {url}...");
                await browserSession.NavigateToAsync(url);

                // WaitForPageLoadAsync handles connectivity/auth/progress monitoring
                var navRes = await _uiService.WaitForPageLoadAsync(browserSession, WhatsAppConfiguration.ChatUIReadySelectors);
                if (navRes == null)
                {
                    _notifier.Notify("Navigation result was null - treating as waiting state");
                    return OperationResult<bool>.Waiting("Navigation result was null", false);
                }
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
                    // fall through to error-dialog checks
                }
                else
                {
                    _notifier.Notify($"Navigation/page-load status: State={normalizedNav.State}, Success={normalizedNav.IsSuccess}, Message={normalizedNav.ResultMessage} - continuing to error-dialog check.");
                }

                // Only check error dialog after success page load
                var hasWhatsApp = await _retryService.ExecuteWithRetryAsync<bool>(
                    () => CheckForWhatsAppErrorDialog(browserSession),
                    maxAttempts: WhatsAppConfiguration.DefaultMaxRetryErrorDialog,
                    shouldRetryResult: r => r?.IsWaiting() == true,
                    isRetryable: null);

                if (hasWhatsApp.IsWaiting())
                {
                    _notifier.Notify($"Could not determine WhatsApp status in single pass: {hasWhatsApp.ResultMessage}");
                    return OperationResult<bool>.Waiting(hasWhatsApp.ResultMessage, false);
                }
                else if (hasWhatsApp.IsPendingNet())
                {
                    _notifier.Notify($"Network issue detected while checking number: {hasWhatsApp.ResultMessage}");
                    return OperationResult<bool>.PendingNET(hasWhatsApp.ResultMessage ?? "Internet connection unavailable", false);
                }
                else if (hasWhatsApp.IsPendingQr())
                {
                    _notifier.Notify($"Authentication required while checking number: {hasWhatsApp.ResultMessage}");
                    return OperationResult<bool>.PendingQR(hasWhatsApp.ResultMessage ?? "Authentication required", false);
                }
                else if (hasWhatsApp.IsSuccess == false)
                {
                    _notifier.Notify($"❌ Error dialog found - number {phoneNumber} does not have WhatsApp.");
                    return OperationResult<bool>.Failure($"Number {phoneNumber} does not have WhatsApp.", false);
                }

                _notifier.Notify($"✅ Number {phoneNumber} has WhatsApp.");
                return OperationResult<bool>.Success(true);
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Exception in CheckWhatsAppNumberInternalAsync for {phoneNumber}: {ex.Message}");
                return OperationResult<bool>.Failure($"Error checking number: {ex.Message}", false);
            }
        }

        public async Task<OperationResult<bool>> CheckInternetConnectivityDetailedAsync()
        {
            var isConnected = await CheckInternetConnectivityAsync();
            return isConnected ? OperationResult<bool>.Success(true) : OperationResult<bool>.PendingNET("Internet connection unavailable", false);
        }



        public async Task<bool> CheckInternetConnectivityAsync() => await _networkService.CheckInternetConnectivityAsync();

        public async Task<IBrowserSession> PrepareSessionAsync(IBrowserSession browserSession) => await _sessionManager.GetOrCreateSessionAsync();

        // Delegate retry logic to central IRetryService
        public async Task<OperationResult<string?>> ExecuteWithRetryAsync(
            Func<Task<OperationResult<string?>>> taskFunc, int maxAttempts,
            Func<OperationResult<string?>, bool>? shouldRetryResult = null,
            Func<Exception, bool>? isRetryable = null)
        {
            // Delegate to domain retry service's OperationResult-aware overload.
            return await _retryService.ExecuteWithRetryAsync<string?>(taskFunc, maxAttempts, shouldRetryResult, isRetryable);
        }

        public async void Dispose()
        {
            try
            {
                try
                {
                    if (_cts != null)
                    {
                        // Cancel if not already cancelled; guard against double-dispose
                        try { _cts.Cancel(); } catch (ObjectDisposedException) { /* already disposed, ignore */ }
                    }
                }
                catch (Exception cancelEx)
                {
                    _notifier?.Notify($"⚠️ Error cancelling CTS during cleanup: {cancelEx.Message}");
                }

                // IMPORTANT: do NOT dispose shared session here. The WhatsApp session is managed
                // by `WhatsAppSessionManager` and by the application shutdown hook in Program.cs.
                // Disposing the shared Playwright session when this scoped service is disposed
                // was causing the browser/page to be closed right after controller actions completed.
                try { _cts?.Dispose(); } catch (ObjectDisposedException) { /* ignore */ }
            }
            catch (Exception ex)
            {
                _notifier?.Notify($"⚠️ Error during cleanup: {ex.Message}");
            }
        }


        // Check for WhatsApp error dialog indicating whether the number is registered or not
        private async Task<OperationResult<bool>> CheckForWhatsAppErrorDialog(IBrowserSession browserSession)
        {
            try
            {
                // Check if we have a chat textbox (indicates successful navigation to a valid WhatsApp number)
                foreach (var selector in WhatsAppConfiguration.InputFieldSelectors)
                {
                    try
                    {
                        var textbox = await browserSession.QuerySelectorAsync(selector);
                        if (textbox != null)
                        {
                            _notifier.Notify($"✅ Chat textbox found using selector: {selector} - number has WhatsApp.");
                            return OperationResult<bool>.Success(true); // Has input field for chat -> have WhatsApp
                        }
                    }
                    catch (Exception ex)
                    {
                        if (_retryService.IsBrowserClosedException(ex)) break;
                        _notifier.Notify($"⚠️ Error checking textbox selector {selector}: {ex.Message}");
                    }
                }
                // _notifier.Notify("❌ No chat textbox found - checking for error dialogs...");

                // If no chat textbox found, check for error dialogs
                foreach (var selector in WhatsAppConfiguration.ErrorDialogSelectors)
                {
                    try
                    {
                        var errorDialog = await browserSession.QuerySelectorAsync(selector);
                        if (errorDialog != null)
                        {
                            _notifier.Notify($"🚫 WhatsApp error dialog detected using selector: {selector}.");
                            return OperationResult<bool>.Failure($"Error dialog detected, using selector: {selector}"); // Has error dialog -> does not have WhatsApp
                        }
                    }
                    catch (Exception ex)
                    {
                        if (_retryService.IsBrowserClosedException(ex)) break;
                        _notifier.Notify($"⚠️ Error checking selector {selector}: {ex.Message}");
                    }
                }
                // _notifier.Notify("⚠️ No chat textbox or error dialog found - unclear status.");
                return OperationResult<bool>.Waiting("Could not determine WhatsApp status in single pass");
            }
            catch (Exception ex)
            {
                _notifier.Notify($"⚠️ Error checking for WhatsApp error dialog: {ex.Message}");
                return OperationResult<bool>.Failure($"Error checking for WhatsApp error dialog: {ex.Message}"); // On error, return Waiting so caller may retry
            }
        }
    }
}