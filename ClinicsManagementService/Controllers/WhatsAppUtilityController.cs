using Microsoft.AspNetCore.Mvc;
using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.Models;
using ClinicsManagementService.Services.Domain;
using ClinicsManagementService.Services.Infrastructure;

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

        public WhatsAppUtilityController(
            IWhatsAppService whatsAppService,
            INotifier notifier,
            IWhatsAppSessionManager sessionManager,
            Func<IBrowserSession> browserSessionFactory)
        {
            _whatsAppService = whatsAppService;
            _notifier = notifier;
            _sessionManager = sessionManager;
            _browserSessionFactory = browserSessionFactory;
        }

        /// <summary>
        /// Checks internet connectivity
        /// </summary>
        /// <returns>Internet connectivity status</returns>
        [HttpGet("check-connectivity")]
        public async Task<ActionResult<InternetConnectivityResult>> CheckConnectivity()
        {
            try
            {
                _notifier.Notify("🌐 Checking internet connectivity...");
                var result = await _whatsAppService.CheckInternetConnectivityDetailedAsync();

                if (result.IsConnected)
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
                return Ok(InternetConnectivityResult.Failure($"Connectivity check failed: {ex.Message}"));
            }
        }

        /// <summary>
        /// Checks if a phone number has WhatsApp
        /// </summary>
        /// <param name="phoneNumber">Phone number to check</param>
        /// <returns>WhatsApp availability status</returns>
        [HttpGet("check-whatsapp/{phoneNumber}")]
        public async Task<ActionResult<WhatsAppNumberCheckResult>> CheckWhatsAppNumber(string phoneNumber)
        {
            try
            {
                _notifier.Notify($"🔍 Checking if {phoneNumber} has WhatsApp...");

                // Create a direct browser session for this simple check
                var browserSession = _browserSessionFactory();
                await browserSession.InitializeAsync();

                var result = await _whatsAppService.CheckWhatsAppNumberAsync(phoneNumber, browserSession);

                // Dispose the session after use
                await browserSession.DisposeAsync();

                if (result.HasWhatsApp)
                {
                    _notifier.Notify($"✅ Number {phoneNumber} has WhatsApp.");
                    return WhatsAppNumberCheckResult.Success();
                }
                else
                {
                    _notifier.Notify($"❌ Number {phoneNumber} does not have WhatsApp.");
                    return WhatsAppNumberCheckResult.Failure($"Number {phoneNumber} does not have WhatsApp.");
                }
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Exception checking WhatsApp number {phoneNumber}: {ex.Message}");
                return Ok(WhatsAppNumberCheckResult.Failure($"Error checking WhatsApp number: {ex.Message}"));
            }
        }

        /// <summary>
        /// Checks WhatsApp authentication status
        /// </summary>
        /// <returns>WhatsApp authentication status</returns>
        [HttpGet("check-authentication")]
        public async Task<ActionResult<WhatsAppAuthenticationResult>> CheckAuthentication()
        {
            try
            {
                _notifier.Notify("🔐 Checking WhatsApp authentication status...");

                // Get the session and run the full authentication check for consistent results
                var browserSession = await _sessionManager.GetOrCreateSessionAsync();
                var result = await _whatsAppService.CheckWhatsAppAuthenticationAsync(browserSession);

                if (result.IsAuthenticated)
                {
                    _notifier.Notify("✅ WhatsApp session is authenticated.");
                }
                else
                {
                    _notifier.Notify("❌ WhatsApp session is not authenticated.");
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Exception checking WhatsApp authentication: {ex.Message}");
                return Ok(WhatsAppAuthenticationResult.Failure($"Authentication check failed: {ex.Message}"));
            }
        }

        /// <summary>
        /// Authenticates WhatsApp session by waiting for QR code scan
        /// </summary>
        /// <returns>WhatsApp authentication result</returns>
        [HttpPost("authenticate")]
        public async Task<ActionResult<WhatsAppAuthenticationResult>> Authenticate()
        {
            try
            {
                _notifier.Notify("🔐 Starting WhatsApp authentication process...");

                var browserSession = await _sessionManager.GetOrCreateSessionAsync();
                var result = await _whatsAppService.AuthenticateWhatsAppAsync(browserSession);

                if (result.IsAuthenticated)
                {
                    _notifier.Notify("✅ WhatsApp authentication successful.");
                }
                else
                {
                    _notifier.Notify("❌ WhatsApp authentication failed.");
                }

                return Ok(result);
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Exception during WhatsApp authentication: {ex.Message}");
                return Ok(WhatsAppAuthenticationResult.Failure($"Authentication failed: {ex.Message}"));
            }
        }
    }
}