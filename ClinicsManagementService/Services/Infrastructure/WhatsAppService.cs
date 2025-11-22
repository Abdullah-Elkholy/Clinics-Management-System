
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
        private int? _lastModeratorId;

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

        public async Task<OperationResult<string?>> SendMessageWithIconTypeAsync(string phoneNumber, string message, IBrowserSession browserSession, CancellationToken cancellationToken = default)
        {
            try
            {
                // Check cancellation before starting
                cancellationToken.ThrowIfCancellationRequested();

                // Initialize session/page
                await browserSession.InitializeAsync();

                // Check cancellation after initialization
                cancellationToken.ThrowIfCancellationRequested();

                // Navigate to send URL for the phone number
                var url = WhatsAppConfiguration.WhatsAppSendUrl + phoneNumber;
                _notifier.Notify($"🔗 Navigating to {url}...");
                await browserSession.NavigateToAsync(url);

                // Check cancellation after navigation
                cancellationToken.ThrowIfCancellationRequested();

                // Wait for chat UI (handles progressbars, auth and network via WaitForPageLoadAsync)
                var uiLoad = await _uiService.WaitForPageLoadAsync(browserSession, WhatsAppConfiguration.ChatUIReadySelectors);
                
                // Check cancellation after page load wait
                cancellationToken.ThrowIfCancellationRequested();

                if (uiLoad.IsPendingNet())
                {
                    _notifier.Notify($"❌ Network unavailable during navigation: {uiLoad.ResultMessage}");
                    return OperationResult<string?>.PendingNET(uiLoad.ResultMessage ?? "Internet connection unavailable");
                }
                if (uiLoad.IsPendingQr())
                {
                    _notifier.Notify($"❌ Authentication required during navigation: {uiLoad.ResultMessage}");
                    return OperationResult<string?>.PendingQR(uiLoad.ResultMessage ?? "WhatsApp authentication required");
                }
                if (uiLoad.IsWaiting())
                {
                    _notifier.Notify($"⚠️ Page load waiting state: {uiLoad.ResultMessage}");
                    return OperationResult<string?>.Waiting(uiLoad.ResultMessage ?? "Waiting for page load");
                }

                // Check cancellation before error dialog check
                cancellationToken.ThrowIfCancellationRequested();

                // Check for WhatsApp error dialog (e.g., number not registered) before attempting to type/send
                var hasWhatsApp = await _retryService.ExecuteWithRetryAsync(
                    () => CheckForWhatsAppErrorDialog(browserSession),
                    maxAttempts: WhatsAppConfiguration.DefaultMaxRetryErrorDialog,
                    shouldRetryResult: r => r?.IsWaiting() == true,
                    isRetryable: null);

                // Check cancellation after error dialog check
                cancellationToken.ThrowIfCancellationRequested();

                if (hasWhatsApp.IsWaiting())
                {
                    _notifier.Notify($"Could not determine WhatsApp chat status in single pass: {hasWhatsApp.ResultMessage}");
                    return OperationResult<string?>.Waiting(hasWhatsApp.ResultMessage ?? "Could not determine chat status");
                }
                if (hasWhatsApp.IsPendingNet())
                {
                    _notifier.Notify($"❌ Network issue detected while checking chat status: {hasWhatsApp.ResultMessage}");
                    return OperationResult<string?>.PendingNET(hasWhatsApp.ResultMessage ?? "Internet connection unavailable");
                }
                if (hasWhatsApp.IsPendingQr())
                {
                    _notifier.Notify($"❌ Authentication required while checking chat status: {hasWhatsApp.ResultMessage}");
                    return OperationResult<string?>.PendingQR(hasWhatsApp.ResultMessage ?? "Authentication required");
                }
                if (hasWhatsApp.IsSuccess == false)
                {
                    _notifier.Notify($"❌ Error dialog found - number {phoneNumber} does not have WhatsApp.");
                    return OperationResult<string?>.Failure(hasWhatsApp.ResultMessage ?? $"Number {phoneNumber} does not have WhatsApp.");
                }

                // Check cancellation before input field wait
                cancellationToken.ThrowIfCancellationRequested();

                // Ensure input field exists (use WaitForPageLoadAsync so progressbars/auth/network are observed)
                var inputWait = await _uiService.WaitForPageLoadAsync(browserSession, WhatsAppConfiguration.InputFieldSelectors, WhatsAppConfiguration.DefaultSelectorTimeoutMs, WhatsAppConfiguration.defaultChecksFrequencyDelayMs);
                
                // Check cancellation after input field wait
                cancellationToken.ThrowIfCancellationRequested();

                if (inputWait.IsPendingNet())
                {
                    _notifier.Notify($"❌ Network lost while waiting for input field: {inputWait.ResultMessage}");
                    return OperationResult<string?>.PendingNET(inputWait.ResultMessage ?? "Internet connection unavailable");
                }
                if (inputWait.IsPendingQr())
                {
                    _notifier.Notify($"❌ Authentication required while waiting for input field: {inputWait.ResultMessage}");
                    return OperationResult<string?>.PendingQR(inputWait.ResultMessage ?? "WhatsApp authentication required");
                }
                if (inputWait.IsWaiting())
                {
                    _notifier.Notify($"⚠️ Waiting for input field: {inputWait.ResultMessage}");
                    return OperationResult<string?>.Waiting(inputWait.ResultMessage ?? "Waiting for input field");
                }

                // Check cancellation before finding input element
                cancellationToken.ThrowIfCancellationRequested();

                // Find input element
                IElementHandle? input = null;
                foreach (var selector in WhatsAppConfiguration.InputFieldSelectors)
                {
                    // Check cancellation in loop
                    cancellationToken.ThrowIfCancellationRequested();

                    try
                    {
                        input = await browserSession.QuerySelectorAsync(selector);
                        if (input != null) break;
                    }
                    catch (Exception ex)
                    {
                        if (_retryService.IsBrowserClosedException(ex))
                        {
                            _notifier.Notify("❌ Browser closed while querying input selector");
                            return OperationResult<string?>.Failure("Failed: Browser session terminated while querying input field");
                        }
                        _notifier.Notify($"⚠️ Error querying input selector {selector}: {ex.Message}");
                    }
                }

                if (input == null)
                {
                    _notifier.Notify("❌ Input field not found after waiting");
                    return OperationResult<string?>.Failure("Message input box not found.");
                }

                // Check cancellation before typing
                cancellationToken.ThrowIfCancellationRequested();

                await input.FocusAsync();
                await input.FillAsync(message);

                // Check cancellation after typing
                cancellationToken.ThrowIfCancellationRequested();

                // Check cancellation before finding send button
                cancellationToken.ThrowIfCancellationRequested();

                // Try to find send button
                IElementHandle? sendButton = null;
                foreach (var sendSelector in WhatsAppConfiguration.SendButtonSelectors)
                {
                    // Check cancellation in loop
                    cancellationToken.ThrowIfCancellationRequested();

                    try
                    {
                        sendButton = await browserSession.QuerySelectorAsync(sendSelector);
                        if (sendButton != null)
                        {
                            _notifier.Notify($"Found send button, using selector: {sendSelector}.");
                            break;
                        }
                    }
                    catch (Exception ex)
                    {
                        if (_retryService.IsBrowserClosedException(ex))
                        {
                            _notifier.Notify("❌ Browser closed while querying send button");
                            return OperationResult<string?>.Failure("Failed: Browser session terminated while querying send button");
                        }
                    }
                }

                // Check cancellation before sending
                cancellationToken.ThrowIfCancellationRequested();

                if (sendButton != null)
                {
                    await sendButton.ClickAsync();
                    _notifier.Notify("🔘 Clicked send button.");
                }
                else if (!string.IsNullOrEmpty(WhatsAppConfiguration.SendEnterKey))
                {
                    _notifier.Notify("↩️ Send button not found, pressing Enter...");
                    await input.PressAsync(WhatsAppConfiguration.SendEnterKey);
                }
                else
                {
                    _notifier.Notify("❌ Send button not found and no Enter key configured.");
                    return OperationResult<string?>.Waiting("Send button not found and no Enter key configured.");
                }

                // Check cancellation after sending
                cancellationToken.ThrowIfCancellationRequested();

                // Wait for message status icon
                var maxWaitMs = WhatsAppConfiguration.DefaultSelectorTimeoutMs;
                var pollIntervalMs = WhatsAppConfiguration.defaultChecksFrequencyDelayMs;
                int elapsed = 0;

                while (elapsed < maxWaitMs)
                {
                    // Check cancellation at start of each polling iteration
                    cancellationToken.ThrowIfCancellationRequested();

                    // Run continuous monitoring to detect progressbars/auth/network
                    var mon = await _uiService.ContinuousMonitoringAsync(browserSession, pollIntervalMs);
                    if (mon != null)
                    {
                        if (mon.IsPendingNet())
                        {
                            _notifier.Notify($"❌ Network lost while waiting for message status: {mon.ResultMessage}");
                            return OperationResult<string?>.PendingNET(mon.ResultMessage ?? "Internet connection unavailable");
                        }
                        if (mon.IsPendingQr())
                        {
                            _notifier.Notify($"❌ Authentication required while waiting for message status: {mon.ResultMessage}");
                            return OperationResult<string?>.PendingQR(mon.ResultMessage ?? "Authentication required");
                        }
                        if (mon.IsWaiting())
                        {
                            _notifier.Notify($"⚠️ Monitoring reported waiting while polling message status: {mon.ResultMessage}");
                            return OperationResult<string?>.Waiting(mon.ResultMessage ?? "Waiting for progress to finish");
                        }
                    }

                    var status = await _uiService.GetLastOutgoingMessageStatusAsync(browserSession, message);
                    var iconType = status.IconType;
                    _notifier.Notify($"Polling message status: iconType={iconType}, elapsed={elapsed}ms");

                    if (!string.IsNullOrEmpty(iconType))
                    {
                        if (iconType == "msg-check" || iconType == "msg-dblcheck")
                        {
                            _notifier.Notify($"✅ Message sent: iconType={iconType}");
                            return OperationResult<string?>.Success(iconType);
                        }
                        if (iconType == "msg-time")
                        {
                            _notifier.Notify("⏳ Message pending (msg-time), will wait...");
                        }
                        else
                        {
                            _notifier.Notify($"⚠️ Unexpected iconType: {iconType}");
                            var path = $"Screenshots/unexpected_icon_{iconType}_{DateTime.Now:yyyyMMdd_HHmmss}.png";
                            await TakeScreenshotAsync(browserSession, path);
                            _notifier.Notify($"Screenshot taken: {path}");
                        }
                    }

                    // Use cancellation token for delay
                    await Task.Delay(pollIntervalMs, cancellationToken);
                    elapsed += pollIntervalMs;
                }

                // If we reach here without success, return Waiting so higher-level retry logic can act
                _notifier.Notify("⚠️ Message status not confirmed within timeout");
                return OperationResult<string?>.Waiting("No status icon found after polling");
            }
            catch (OperationCanceledException)
            {
                _notifier.Notify($"⚠️ Operation cancelled while sending message to {phoneNumber}");
                return OperationResult<string?>.Failure("Operation was cancelled");
            }
            catch (Exception ex)
            {
                if (_retryService.IsBrowserClosedException(ex))
                {
                    _notifier.Notify($"❌ Browser closed during SendMessageWithIconTypeAsync: {ex.Message}");
                    return OperationResult<string?>.Failure("Failed: Browser session terminated during send");
                }
                _notifier.Notify($"❌ Exception in SendMessageWithIconTypeAsync: {ex.Message}");
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
            _notifier.Notify("Disposing browser session...");
            if (browserSession is IAsyncDisposable asyncDisposable)
                await asyncDisposable.DisposeAsync();
            else if (browserSession is IDisposable disposable)
                disposable.Dispose();
            _notifier.Notify("Disposed browser session.");
        }


        public Task<OperationResult<bool>> CheckWhatsAppNumberAsync(string phoneNumber, IBrowserSession browserSession, CancellationToken cancellationToken = default)
        {
            // Apply full-operation retry at the public entry point so callers get retries on Waiting results
            // and Playwright/browser-closed exceptions. This keeps the internal method single-pass and
            // simpler to reason about.
            return _retryService.ExecuteWithRetryAsync<bool>(
                () => CheckWhatsAppNumberInternalAsync(phoneNumber, browserSession, cancellationToken),
                maxAttempts: Math.Max(1, WhatsAppConfiguration.DefaultMaxRetryAttempts),
                shouldRetryResult: r => r?.IsWaiting() == true,
                isRetryable: ex => _retryService.IsBrowserClosedException(ex));
        }

        private async Task<OperationResult<bool>> CheckWhatsAppNumberInternalAsync(string phoneNumber, IBrowserSession browserSession, CancellationToken cancellationToken)
        {
            try
            {
                // Check cancellation before starting
                cancellationToken.ThrowIfCancellationRequested();

                await browserSession.InitializeAsync();
                
                // Check cancellation after initialization
                cancellationToken.ThrowIfCancellationRequested();
                
                // Navigate directly to the WhatsApp send URL for the phone number
                var url = WhatsAppConfiguration.WhatsAppSendUrl + phoneNumber;
                _notifier.Notify($"🔗 Navigating to {url}...");
                await browserSession.NavigateToAsync(url);
                
                // Check cancellation after navigation
                cancellationToken.ThrowIfCancellationRequested();

                // WaitForPageLoadAsync handles connectivity/auth/progress monitoring
                var navRes = await _uiService.WaitForPageLoadAsync(browserSession, WhatsAppConfiguration.ChatUIReadySelectors);
                
                // Check cancellation after page load wait
                cancellationToken.ThrowIfCancellationRequested();
                
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

                // Check cancellation before error dialog check
                cancellationToken.ThrowIfCancellationRequested();

                // Check for blank or invalid pages after navigation (handle stuck states)
                try
                {
                    var currentUrl = await browserSession.GetUrlAsync();
                    
                    // Check for blank or invalid pages (only check for blank pages, not URL content)
                    if (string.IsNullOrWhiteSpace(currentUrl) || 
                        currentUrl == "about:blank" || 
                        currentUrl.Contains("data:text/html") ||
                        currentUrl.Contains("chrome-error://"))
                    {
                        _notifier.Notify("⚠️ Blank or invalid page detected - attempting recovery");
                        
                        // Recovery attempt 1: Reload page once
                        await browserSession.NavigateToAsync(url);
                        
                        // Wait again after reload
                        var retryNavRes = await _uiService.WaitForPageLoadAsync(browserSession, WhatsAppConfiguration.ChatUIReadySelectors);
                        
                        // Check URL again after retry
                        currentUrl = await browserSession.GetUrlAsync();
                        
                        // If still blank or invalid, return waiting state (page may still be loading)
                        if (string.IsNullOrWhiteSpace(currentUrl) || 
                            currentUrl == "about:blank")
                        {
                            _notifier.Notify("⚠️ Still on blank or invalid page after recovery attempt");
                            return OperationResult<bool>.Waiting("Blank page detected - page may still be loading. Please try again.", false);
                        }
                        
                        _notifier.Notify("✅ Page recovered successfully after reload");
                    }
                }
                catch (Exception urlEx)
                {
                    _notifier.Notify($"⚠️ Error checking URL after navigation: {urlEx.Message} - continuing with error-dialog check");
                    // Continue with error dialog check even if URL check fails
                }

                // Only check error dialog after success page load
                var hasWhatsApp = await _retryService.ExecuteWithRetryAsync<bool>(
                    () => CheckForWhatsAppErrorDialog(browserSession),
                    maxAttempts: WhatsAppConfiguration.DefaultMaxRetryErrorDialog,
                    shouldRetryResult: r => r?.IsWaiting() == true,
                    isRetryable: null);
                
                // Check cancellation after error dialog check
                cancellationToken.ThrowIfCancellationRequested();

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
            catch (OperationCanceledException)
            {
                _notifier.Notify($"⚠️ Operation cancelled while checking WhatsApp number {phoneNumber}");
                return OperationResult<bool>.Failure("Operation was cancelled", false);
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

        public async Task<IBrowserSession> PrepareSessionAsync(int moderatorId)
        {
            _lastModeratorId = moderatorId;
            return await _sessionManager.GetOrCreateSessionAsync(moderatorId);
        }

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

                IBrowserSession? session = null;
                if (_lastModeratorId.HasValue)
                {
                    session = await _sessionManager.GetCurrentSessionAsync(_lastModeratorId.Value);
                }
                if (session != null)
                {
                    try { await DisposeBrowserSessionAsync(session); } catch (Exception disposeEx) { _notifier?.Notify($"⚠️ Error disposing browser session: {disposeEx.Message}"); }
                }

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
                foreach (var selector in WhatsAppConfiguration.StartingChatDialogSelectors)
                {
                    var selectorDialog = await browserSession.QuerySelectorAsync(selector);
                    if (selectorDialog != null)
                    {
                        _notifier.Notify("Dialog element found on page, checking further...");
                        await browserSession.WaitForSelectorAsync(selector, state: WaitForSelectorState.Detached);
                        // var dialogHTML = await selectorDialog.InnerHTMLAsync();
                        // _notifier.Notify($"Dialog HTML: {dialogHTML}");
                        break; // Found a dialog, wait for it to go away after disposal
                    }
                }

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