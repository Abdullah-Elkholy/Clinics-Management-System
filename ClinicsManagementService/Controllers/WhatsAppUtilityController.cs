using Microsoft.AspNetCore.Mvc;
using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.Models;
using ClinicsManagementService.Services.Domain;
using ClinicsManagementService.Services.Infrastructure;
using ClinicsManagementService.Configuration;
using System.Net;
using System.Threading;

namespace ClinicsManagementService.Controllers
{
    /// <summary>
    /// Controller for WhatsApp utility operations
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class WhatsAppUtilityController : ControllerBase
    {
        private readonly IWhatsAppService _whatsAppService;
        private readonly INotifier _notifier;
        private readonly IWhatsAppSessionManager _sessionManager;
        private readonly Func<IBrowserSession> _browserSessionFactory;
        private readonly IWhatsAppUIService _whatsAppUIService;
        private readonly IRetryService _retryService;


        public WhatsAppUtilityController(
            IWhatsAppService whatsAppService,
            INotifier notifier,
            IWhatsAppSessionManager sessionManager,
            Func<IBrowserSession> browserSessionFactory,
            IWhatsAppUIService whatsAppUIService,
            IRetryService retryService)
        {
            _whatsAppService = whatsAppService;
            _notifier = notifier;
            _sessionManager = sessionManager;
            _browserSessionFactory = browserSessionFactory;
            _whatsAppUIService = whatsAppUIService;
            _retryService = retryService;
        }

        /// <summary>
        /// Checks internet connectivity
        /// </summary>
        /// <returns>Internet connectivity status</returns>
        [HttpGet("check-connectivity")]
        public async Task<ActionResult<OperationResult<bool>>> CheckConnectivity()
        {
            try
            {
                _notifier.Notify("🌐 Checking internet connectivity...");
                var result = await _whatsAppService.CheckInternetConnectivityDetailedAsync();

                if (result.Data == true)
                {
                    _notifier.Notify("✅ Internet connectivity confirmed.");
                    return Ok(result);
                }
                else
                {
                    _notifier.Notify("❌ Internet connectivity failed.");
                    return Ok(result);
                }
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Internet connectivity check failed: {ex.Message}");
                return Ok(OperationResult<bool>.Failure($"Connectivity check failed: {ex.Message}"));
            }
        }

        /// <summary>
        /// Checks if a phone number has WhatsApp
        /// </summary>
        /// <param name="phoneNumber">Phone number to check</param>
        /// <param name="cancellationToken">Cancellation token to detect client disconnection</param>
        /// <returns>WhatsApp availability status</returns>
        [HttpGet("check-whatsapp/{phoneNumber}")]
        public async Task<ActionResult<OperationResult<bool>>> CheckWhatsAppNumber(
            string phoneNumber,
            CancellationToken cancellationToken = default)
        {
            try
            {
                // Check if request was already cancelled
                cancellationToken.ThrowIfCancellationRequested();

                _notifier.Notify($"🔍 Checking if {phoneNumber} has WhatsApp...");

                // Create a direct browser session for this simple check
                var browserSession = await _sessionManager.GetOrCreateSessionAsync();
                
                // Check cancellation before starting operation
                cancellationToken.ThrowIfCancellationRequested();
                
                var result = await _whatsAppService.CheckWhatsAppNumberAsync(phoneNumber, browserSession, cancellationToken);

                // Check cancellation before disposing
                cancellationToken.ThrowIfCancellationRequested();

                // Dispose the session after use
                await browserSession.DisposeAsync();

                if (result != null)
                {
                    if (result.IsSuccess == true)
                    {
                        _notifier.Notify($"✅ Number {phoneNumber} has WhatsApp.");
                    }
                    else if (result.IsPendingQr())
                    {
                        _notifier.Notify($"❌ WhatsApp authentication required to check number {phoneNumber}.");
                    }
                    else if (result.IsPendingNet())
                    {
                        _notifier.Notify($"❌ Internet connection unavailable to check number {phoneNumber}.");
                    }
                    else if (result.IsSuccess == false && result.State != OperationState.Failure)
                    {
                        _notifier.Notify($"❌ Number {phoneNumber} does not have WhatsApp.");
                    }
                    else if (result.IsWaiting())
                    {
                        _notifier.Notify($"❓ Waiting state returned when checking number {phoneNumber}.");
                    }
                }
                else
                {
                    _notifier.Notify($"❌ Unable to determine WhatsApp status for {phoneNumber}.");
                }
                return Ok(result);
            }
            catch (OperationCanceledException)
            {
                _notifier.Notify($"⚠️ Request cancelled while checking WhatsApp number {phoneNumber}");
                return Ok(OperationResult<bool>.Failure("Request was cancelled", false));
            }
            catch (TimeoutException tex)
            {
                _notifier.Notify($"❌ Timeout checking WhatsApp number {phoneNumber}: {tex.Message}");
                return Ok(OperationResult<bool>.Failure($"Timeout checking WhatsApp number: {tex.Message}"));
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Exception checking WhatsApp number {phoneNumber}: {ex.Message}");
                return Ok(OperationResult<bool>.Failure($"Error checking WhatsApp number: {ex.Message}"));
            }
        }

        /// <summary>
        /// Checks WhatsApp authentication status
        /// </summary>
        /// <returns>WhatsApp authentication status</returns>
        [HttpGet("check-authentication")]
        public async Task<ActionResult<OperationResult<bool>>> CheckAuthentication()
        {
            try
            {
                _notifier.Notify("🔐 Checking WhatsApp authentication status...");

                // Get the session and run the full authentication check for consistent results
                var browserSession = await _sessionManager.GetOrCreateSessionAsync();
                await browserSession.InitializeAsync();
                // Navigate directly to the WhatsApp base URL for the phone number
                var url = WhatsAppConfiguration.WhatsAppBaseUrl;
                _notifier.Notify($"🔗 Navigating to {url}...");
                await browserSession.NavigateToAsync(url);

                var waitUIResult = await _whatsAppUIService.WaitForPageLoadAsync(browserSession, WhatsAppConfiguration.ChatUIReadySelectors);

                if (waitUIResult.IsSuccess == true && waitUIResult.State == OperationState.Success)
                {
                    _notifier.Notify("✅ WhatsApp is authenticated and ready.");
                }
                else if (waitUIResult.IsPendingQr())
                {
                    _notifier.Notify("❌ WhatsApp is not authenticated.");
                }
                // Return the unified OperationResult<bool> from the UI service
                return Ok(waitUIResult);
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Exception checking WhatsApp authentication: {ex.Message}");
                return Ok(OperationResult<bool>.Failure($"Authentication check failed: {ex.Message}"));
            }
        }

        /// <summary>
        /// Authenticates WhatsApp session by waiting for QR code scan
        /// </summary>
        /// <returns>WhatsApp authentication result</returns>
        [HttpPost("authenticate")]
        public async Task<ActionResult<OperationResult<bool>>> Authenticate()
        {
            try
            {
                _notifier.Notify("🔐 Starting WhatsApp authentication process...");

                // Use the session manager so we operate on the shared/persistent session
                var browserSession = await _sessionManager.GetOrCreateSessionAsync();
                await browserSession.InitializeAsync();

                var url = WhatsAppConfiguration.WhatsAppBaseUrl;
                _notifier.Notify($"🔗 Navigating to {url}...");
                await browserSession.NavigateToAsync(url);

                // First quick pass: check if already authenticated (ChatUI present)
                var initial = await _whatsAppUIService.WaitForPageLoadAsync(browserSession, WhatsAppConfiguration.ChatUIReadySelectors);
                if (initial.IsSuccess == true)
                {
                    _notifier.Notify("✅ WhatsApp already authenticated.");
                    return Ok(OperationResult<bool>.Success(true));
                }

                if (initial.IsPendingNet())
                {
                    _notifier.Notify("❌ Internet connection issue detected during authentication check.");
                    return Ok(OperationResult<bool>.PendingNET(initial.ResultMessage ?? "Internet connection unavailable"));
                }

                // If we reached here, authentication is required (QR) or ambiguous. If initial check detected QR,
                // wait for the user to scan and authenticate for a reasonable period (DefaultAuthenticationWaitMs).
                _notifier.Notify("⏳ Waiting for user to scan QR and for authentication to complete...");

                // If initial state shows PendingQR, give the user some time to scan the QR
                if (initial.IsPendingQr())
                {
                    var totalMs = WhatsAppConfiguration.DefaultAuthenticationWaitMs;
                    var intervalMs = WhatsAppConfiguration.defaultChecksFrequencyDelayMs;
                    _notifier.Notify($"🔔 Authentication pending - will wait up to {totalMs / 1000} seconds for user action.");

                    var start = DateTime.UtcNow;
                    var timeout = TimeSpan.FromMilliseconds(totalMs);
                    try
                    {
                        while (DateTime.UtcNow - start < timeout)
                        {
                            // Check success condition: any ChatUI selector is present
                            foreach (var selector in WhatsAppConfiguration.ChatUIReadySelectors ?? Array.Empty<string>())
                            {
                                try
                                {
                                    var element = await browserSession.QuerySelectorAsync(selector);
                                    if (element != null)
                                    {
                                        _notifier.Notify("✅ Authentication completed: Chat UI detected after QR scan.");
                                        return Ok(OperationResult<bool>.Success(true));
                                    }
                                }
                                catch (Exception ex)
                                {
                                    if (_retryService.IsBrowserClosedException(ex))
                                    {
                                        _notifier.Notify("❗ Browser closed detected during authentication while waiting for Chat UI.");
                                        // Return a failure result instead of throwing to avoid terminating the host process
                                        return Ok(OperationResult<bool>.Failure("Authentication failed: browser session was closed during authentication"));
                                    }
                                    _notifier.Notify($"⚠️ Error checking Chat UI selector {selector}: {ex.Message}");
                                }
                            }

                            // Run continuous monitoring to detect progress bars, QR presence and network state
                            OperationResult<bool>? monitoringResult = null;
                            if (_whatsAppUIService is Services.Domain.WhatsAppUIService concreteMonitor)
                            {
                                monitoringResult = await concreteMonitor.ContinuousMonitoringAsync(browserSession, intervalMs, totalMs);
                            }
                            else
                            {
                                _notifier.Notify("⚠️ Monitoring not available on current UI service implementation.");
                            }
                            if (monitoringResult != null)
                            {
                                if (monitoringResult.IsPendingNet())
                                {
                                    _notifier.Notify("❌ Authentication interrupted due to network issues during wait.");
                                    return Ok(OperationResult<bool>.PendingNET(monitoringResult.ResultMessage ?? "Internet connection unavailable"));
                                }
                                if (monitoringResult.IsWaiting())
                                {
                                    // Progress bar didn't disappear in the monitoring window
                                    _notifier.Notify($"⚠️ Authentication still in progress: {monitoringResult.ResultMessage}");
                                    return Ok(OperationResult<bool>.Waiting(monitoringResult.ResultMessage));
                                }
                                if (monitoringResult.IsPendingQr())
                                {
                                    // Still on QR, continue waiting until timeout
                                    _notifier.Notify($"⏳ Still waiting for QR scan: {monitoringResult.ResultMessage}");
                                }
                                else if (monitoringResult.IsSuccess == true)
                                {
                                    _notifier.Notify("✅ Authentication completed (monitoring detected success).");
                                    return Ok(OperationResult<bool>.Success(true));
                                }
                                else if (monitoringResult.IsSuccess == false)
                                {
                                    _notifier.Notify($"❌ Monitoring reported failure: {monitoringResult.ResultMessage}");
                                    return Ok(OperationResult<bool>.Failure(monitoringResult.ResultMessage ?? "Authentication failed during monitoring"));
                                }
                            }

                            // Send periodic progress notification (percent/time left)
                            var elapsed = DateTime.UtcNow - start;
                            var remaining = timeout - elapsed;
                            var pct = Math.Min(100, (int)((elapsed.TotalMilliseconds / totalMs) * 100));
                            if (remaining.TotalSeconds > 0)
                                _notifier.Notify($"⏳ Waiting for QR scan... {pct}% ({(int)remaining.TotalSeconds}s left)");

                            await Task.Delay(Math.Max(250, intervalMs));
                        }

                        // Timed out waiting for QR scan
                        _notifier.Notify("❌ Authentication failed or timed out: still on QR page after wait period.");
                        return Ok(OperationResult<bool>.Failure("Authentication failed: still on QR page after wait period."));
                    }
                    catch (Exception ex)
                    {
                        if (_retryService.IsBrowserClosedException(ex))
                        {
                            _notifier.Notify("❗ Browser closed detected during authentication. Consider recreating the browser session before retrying.");
                            // Return a failure so the caller can decide to recreate a session instead of rethrowing
                            return Ok(OperationResult<bool>.Failure("Authentication failed: browser session was closed during authentication."));
                        }
                        _notifier.Notify($"❌ Exception while waiting for QR scan: {ex.Message}");
                        return Ok(OperationResult<bool>.Failure($"Authentication failed: {ex.Message}"));
                    }
                }

                // Otherwise, proceed to monitor until a longer default monitoring timeout (progress/transition)
                var waitForAuth = await _whatsAppUIService.WaitWithMonitoringAsync(browserSession, async () =>
                {
                    foreach (var selector in WhatsAppConfiguration.ChatUIReadySelectors ?? Array.Empty<string>())
                    {
                        var element = await browserSession.QuerySelectorAsync(selector);
                        if (element != null)
                            return true;
                    }
                    return false;
                }, WhatsAppConfiguration.DefaultMaxMonitoringWaitMs, WhatsAppConfiguration.defaultChecksFrequencyDelayMs);

                if (waitForAuth.IsSuccess == true)
                {
                    _notifier.Notify("✅ Authentication completed: Chat UI detected.");
                    return Ok(OperationResult<bool>.Success(true));
                }

                // If monitoring detected a QR (came back to QR) that's a failed authentication attempt
                if (waitForAuth.IsPendingQr())
                {
                    _notifier.Notify("❌ Authentication failed: returned to QR code page after progress.");
                    return Ok(OperationResult<bool>.Failure("Authentication failed: returned to QR code page after progress."));
                }

                if (waitForAuth.IsPendingNet())
                {
                    _notifier.Notify("❌ Authentication interrupted due to network issues.");
                    return Ok(OperationResult<bool>.PendingNET(waitForAuth.ResultMessage ?? "Internet connection unavailable"));
                }

                if (waitForAuth.IsWaiting())
                {
                    _notifier.Notify($"⚠️ Authentication still in progress after timeout: {waitForAuth.ResultMessage}");
                    return Ok(OperationResult<bool>.Waiting(waitForAuth.ResultMessage));
                }

                // Any other failure
                _notifier.Notify($"❌ Authentication failed: {waitForAuth.ResultMessage}");
                return Ok(OperationResult<bool>.Failure(waitForAuth.ResultMessage ?? "Authentication failed"));
            }
            catch (Exception ex)
            {
                if (_retryService.IsBrowserClosedException(ex))
                {
                    _notifier.Notify("❗ Browser closed detected during authentication. Consider recreating the browser session before retrying.");
                    throw;
                }
                _notifier.Notify($"❌ Exception during WhatsApp authentication: {ex.Message}");
                return Ok(OperationResult<bool>.Failure($"Authentication failed: {ex.Message}"));
            }
        }
    }
}