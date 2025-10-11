using Microsoft.AspNetCore.Mvc;
using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.Models;
using ClinicsManagementService.Services.Domain;
using ClinicsManagementService.Services.Infrastructure;
using ClinicsManagementService.Configuration;

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

        public WhatsAppUtilityController(
            IWhatsAppService whatsAppService,
            INotifier notifier,
            IWhatsAppSessionManager sessionManager,
            Func<IBrowserSession> browserSessionFactory,
            IWhatsAppUIService whatsAppUIService)
        {
            _whatsAppService = whatsAppService;
            _notifier = notifier;
            _sessionManager = sessionManager;
            _browserSessionFactory = browserSessionFactory;
            _whatsAppUIService = whatsAppUIService;
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
                    if (result.Data == true)
                    {
                        _notifier.Notify($"✅ Number {phoneNumber} has WhatsApp.");
                    }
                    else if (result.Data == false)
                    {
                        _notifier.Notify($"❌ Number {phoneNumber} does not have WhatsApp.");
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
                var browserSession = await _sessionManager.GetOrCreateSessionAsync();

                var waitUIResult = await _whatsAppUIService.WaitForPageLoadAsync(browserSession, WhatsAppConfiguration.ChatUIReadySelectors);

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

                var browserSession = await _sessionManager.GetOrCreateSessionAsync();
                var waitUIResult = await _whatsAppUIService.WaitForPageLoadAsync(browserSession, WhatsAppConfiguration.ChatUIReadySelectors);
                return Ok(waitUIResult);
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Exception during WhatsApp authentication: {ex.Message}");
                return Ok(OperationResult<bool>.Failure($"Authentication failed: {ex.Message}"));
            }
        }
    }
}