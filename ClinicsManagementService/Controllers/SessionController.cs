using Microsoft.AspNetCore.Mvc;
using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.Models;
using ClinicsManagementService.Configuration;

namespace ClinicsManagementService.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class SessionController : ControllerBase
    {
        private readonly IWhatsAppSessionManager _sessionManager;
        private readonly INotifier _notifier;

        public SessionController(IWhatsAppSessionManager sessionManager, INotifier notifier)
        {
            _sessionManager = sessionManager;
            _notifier = notifier;
        }

        [HttpGet("health")]
        public async Task<ActionResult<OperationResult<object>>> Health()
        {
            try
            {
                var session = await _sessionManager.GetCurrentSessionAsync();
                if (session == null)
                    return Ok(OperationResult<object>.Failure("No active session"));

                bool ready = await _sessionManager.IsSessionReadyAsync();
                return Ok(OperationResult<object>.Success(new { Ready = ready }));
            }
            catch (Exception ex)
            {
                _notifier.Notify($"Error getting session health: {ex.Message}");
                return Ok(OperationResult<object>.Failure($"Error getting session health: {ex.Message}"));
            }
        }

        [HttpPost("keepalive")]
        public async Task<ActionResult<OperationResult<bool>>> KeepAlive()
        {
            try
            {
                var session = await _sessionManager.GetOrCreateSessionAsync();
                if (session == null)
                    return Ok(OperationResult<bool>.Failure("Failed to create or retrieve session"));
                // touch Initialize to keep session alive
                await session.InitializeAsync();
                return Ok(OperationResult<bool>.Success(true));
            }
            catch (Exception ex)
            {
                _notifier.Notify($"Error during keepalive: {ex.Message}");
                return Ok(OperationResult<bool>.Failure($"Keepalive failed: {ex.Message}"));
            }
        }
    }
}
