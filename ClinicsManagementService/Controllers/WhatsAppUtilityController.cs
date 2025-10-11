using Microsoft.AspNetCore.Mvc;
using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.Models;
using ClinicsManagementService.Services.Domain;
using ClinicsManagementService.Services.Infrastructure;
using ClinicsManagementService.Configuration;
using System.Net;

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
        /// <returns>WhatsApp availability status</returns>
        [HttpGet("check-whatsapp/{phoneNumber}")]
        public async Task<ActionResult<OperationResult<bool>>> CheckWhatsAppNumber(string phoneNumber)
        {
            try
            {
                _notifier.Notify($"🔍 Checking if {phoneNumber} has WhatsApp...");

                // Create a direct browser session for this simple check
                var browserSession = _browserSessionFactory();
                var result = await _whatsAppService.CheckWhatsAppNumberAsync(phoneNumber, browserSession);

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
                // var browserSession = await _sessionManager.GetOrCreateSessionAsync();
                var browserSession = _browserSessionFactory();
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
                    _notifier.Notify($"🔔 Authentication pending - will wait up to {WhatsAppConfiguration.DefaultAuthenticationWaitMs / 1000} seconds for user action.");
                    var waitForAuthShort = await _whatsAppUIService.WaitWithMonitoringAsync(browserSession, async () =>
                    {
                        // success condition: any ChatUI selector is present
                        foreach (var selector in WhatsAppConfiguration.ChatUIReadySelectors ?? Array.Empty<string>())
                        {
                            var element = await browserSession.QuerySelectorAsync(selector);
                            if (element != null)
                                return true;
                        }
                        return false;
                    }, WhatsAppConfiguration.DefaultAuthenticationWaitMs, WhatsAppConfiguration.defaultProgressChecksDelayMs);

                    if (waitForAuthShort.IsSuccess == true)
                    {
                        _notifier.Notify("✅ Authentication completed within wait window: Chat UI detected.");
                        return Ok(OperationResult<bool>.Success(true));
                    }

                    if (waitForAuthShort.IsPendingQr())
                    {
                        _notifier.Notify("❌ Authentication failed or timed out: still on QR page after wait period.");
                        return Ok(OperationResult<bool>.Failure("Authentication failed: still on QR page after wait period."));
                    }

                    if (waitForAuthShort.IsPendingNet())
                    {
                        _notifier.Notify("❌ Authentication interrupted due to network issues during wait.");
                        return Ok(OperationResult<bool>.PendingNET(waitForAuthShort.ResultMessage ?? "Internet connection unavailable"));
                    }

                    if (waitForAuthShort.IsWaiting())
                    {
                        _notifier.Notify($"⚠️ Authentication still in progress after wait: {waitForAuthShort.ResultMessage}");
                        return Ok(OperationResult<bool>.Waiting(waitForAuthShort.ResultMessage));
                    }

                    _notifier.Notify($"❌ Authentication unsuccessful after wait: {waitForAuthShort.ResultMessage}");
                    return Ok(OperationResult<bool>.Failure(waitForAuthShort.ResultMessage ?? "Authentication unsuccessful after wait"));
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
                }, WhatsAppConfiguration.DefaultMaxMonitoringWaitMs, WhatsAppConfiguration.defaultProgressChecksDelayMs);

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