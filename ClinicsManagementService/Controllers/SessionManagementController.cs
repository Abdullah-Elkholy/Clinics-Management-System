using Microsoft.AspNetCore.Mvc;
using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.Models;

namespace ClinicsManagementService.Controllers
{
    /// <summary>
    /// Controller for WhatsApp session management and optimization operations
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class SessionManagementController : ControllerBase
    {
        private readonly INotifier _notifier;
        private readonly IWhatsAppSessionOptimizer _sessionOptimizer;

        public SessionManagementController(
            INotifier notifier,
            IWhatsAppSessionOptimizer sessionOptimizer)
        {
            _notifier = notifier;
            _sessionOptimizer = sessionOptimizer;
        }

        /// <summary>
        /// Gets session health metrics including size and backup information
        /// </summary>
        /// <returns>Session health metrics</returns>
        [HttpGet("health")]
        public async Task<ActionResult<SessionHealthMetrics>> GetSessionHealth([FromQuery] int moderatorUserId)
        {
            try
            {
                _notifier.Notify("📊 Getting session health metrics...");
                var metrics = await _sessionOptimizer.GetHealthMetricsAsync(moderatorUserId);
                return Ok(metrics);
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Failed to get session health: {ex.Message}");
                return StatusCode(500, new { error = ex.Message });
            }
        }

        /// <summary>
        /// Manually restores session from backup
        /// </summary>
        /// <returns>Restoration result</returns>
        [HttpPost("restore")]
        public async Task<ActionResult<OperationResult<bool>>> RestoreSession([FromQuery] int moderatorUserId)
        {
            try
            {
                _notifier.Notify("🔄 Manual session restore requested...");
                await _sessionOptimizer.RestoreFromBackupAsync(moderatorUserId);
                _notifier.Notify("✅ Session restored successfully from backup");
                return Ok(OperationResult<bool>.Success(true));
            }
            catch (FileNotFoundException ex)
            {
                _notifier.Notify($"❌ No backup found: {ex.Message}");
                return Ok(OperationResult<bool>.Failure("No backup file found. Please authenticate first."));
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Session restore failed: {ex.Message}");
                return Ok(OperationResult<bool>.Failure($"Restoration failed: {ex.Message}"));
            }
        }

        /// <summary>
        /// Manually optimizes the current session (cleanup only, no backup)
        /// </summary>
        /// <returns>Optimization result</returns>
        [HttpPost("optimize")]
        public async Task<ActionResult<OperationResult<bool>>> OptimizeSession([FromQuery] int moderatorUserId)
        {
            try
            {
                _notifier.Notify("🔧 Manual session optimization requested...");
                await _sessionOptimizer.OptimizeCurrentSessionOnlyAsync(moderatorUserId);
                _notifier.Notify("✅ Session optimized successfully (no backup created)");
                return Ok(OperationResult<bool>.Success(true));
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Session optimization failed: {ex.Message}");
                return Ok(OperationResult<bool>.Failure($"Optimization failed: {ex.Message}"));
            }
        }

        /// <summary>
        /// Checks if session size exceeds threshold and auto-restores if needed
        /// </summary>
        /// <returns>Check and restore result</returns>
        [HttpPost("check-and-restore")]
        public async Task<ActionResult<OperationResult<bool>>> CheckAndAutoRestore([FromQuery] int moderatorUserId)
        {
            try
            {
                _notifier.Notify("🔍 Checking session size and auto-restoring if needed...");
                await _sessionOptimizer.CheckAndAutoRestoreIfNeededAsync(moderatorUserId);
                _notifier.Notify("✅ Session check completed");
                return Ok(OperationResult<bool>.Success(true));
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Auto-restore check failed: {ex.Message}");
                return Ok(OperationResult<bool>.Failure($"Check failed: {ex.Message}"));
            }
        }
    }
}
