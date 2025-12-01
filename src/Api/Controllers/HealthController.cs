using Microsoft.AspNetCore.Mvc;
using Clinics.Api.Services;
using Clinics.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Clinics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class HealthController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly CircuitBreakerService _circuitBreaker;
        private readonly ILogger<HealthController> _logger;
        
        // Static field to track processor state (shared across instances)
        private static ProcessorHealthState _processorState = new ProcessorHealthState();

        public HealthController(
            ApplicationDbContext db,
            CircuitBreakerService circuitBreaker,
            ILogger<HealthController> logger)
        {
            _db = db;
            _circuitBreaker = circuitBreaker;
            _logger = logger;
        }

        [HttpGet]
        [Microsoft.AspNetCore.Authorization.AllowAnonymous]
        public IActionResult Get() => Ok(new { status = "healthy", time = System.DateTime.UtcNow });
        
        /// <summary>
        /// Get processor health status
        /// </summary>
        [HttpGet("processor")]
        public async Task<IActionResult> GetProcessorHealth()
        {
            try
            {
                // Get queue statistics
                var queuedCount = await _db.Messages
                    .CountAsync(m => m.Status == "queued" && !m.IsPaused);
                
                var sendingCount = await _db.Messages
                    .CountAsync(m => m.Status == "sending");
                
                var pausedCount = await _db.Messages
                    .CountAsync(m => m.IsPaused);
                
                var failedCount = await _db.Messages
                    .CountAsync(m => m.Status == "failed");
                
                // Get session statistics
                var activeSessionsCount = await _db.MessageSessions
                    .CountAsync(s => s.Status == "active" && !s.IsPaused);
                
                var pausedSessionsCount = await _db.MessageSessions
                    .CountAsync(s => s.IsPaused);
                
                // Get circuit breaker states
                var circuits = _circuitBreaker.GetAllCircuitStatus();
                var openCircuits = circuits.Values.Count(c => c.State == "Open");
                var halfOpenCircuits = circuits.Values.Count(c => c.State == "HalfOpen");

                return Ok(new
                {
                    status = "healthy",
                    timestamp = DateTime.UtcNow,
                    processor = new
                    {
                        lastBatchTime = _processorState.LastBatchTime,
                        lastBatchCount = _processorState.LastBatchCount,
                        totalProcessed = _processorState.TotalProcessed,
                        totalErrors = _processorState.TotalErrors,
                        isRunning = _processorState.IsRunning
                    },
                    queue = new
                    {
                        queued = queuedCount,
                        sending = sendingCount,
                        paused = pausedCount,
                        failed = failedCount
                    },
                    sessions = new
                    {
                        active = activeSessionsCount,
                        paused = pausedSessionsCount
                    },
                    circuitBreakers = new
                    {
                        total = circuits.Count,
                        open = openCircuits,
                        halfOpen = halfOpenCircuits,
                        closed = circuits.Count - openCircuits - halfOpenCircuits,
                        details = circuits.Values.Select(c => new
                        {
                            moderatorId = c.ModeratorId,
                            state = c.State,
                            consecutiveFailures = c.ConsecutiveFailures,
                            lastFailure = c.LastFailureTime,
                            lastSuccess = c.LastSuccessTime
                        })
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting processor health");
                return StatusCode(500, new { status = "error", message = ex.Message });
            }
        }

        /// <summary>
        /// Reset circuit breaker for a specific moderator (admin action)
        /// </summary>
        [HttpPost("circuit/{moderatorId}/reset")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin")]
        public IActionResult ResetCircuit(int moderatorId)
        {
            try
            {
                _circuitBreaker.Reset(moderatorId);
                _logger.LogInformation("Circuit breaker reset for moderator {ModeratorId} by admin", moderatorId);
                
                return Ok(new 
                { 
                    success = true, 
                    message = $"Circuit breaker reset for moderator {moderatorId}",
                    state = _circuitBreaker.GetState(moderatorId).ToString()
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resetting circuit for moderator {ModeratorId}", moderatorId);
                return StatusCode(500, new { success = false, error = ex.Message });
            }
        }

        /// <summary>
        /// Update processor state (called by MessageProcessor)
        /// </summary>
        public static void UpdateProcessorState(int batchCount, int errorCount)
        {
            _processorState.LastBatchTime = DateTime.UtcNow;
            _processorState.LastBatchCount = batchCount;
            _processorState.TotalProcessed += batchCount;
            _processorState.TotalErrors += errorCount;
            _processorState.IsRunning = true;
        }
    }

    /// <summary>
    /// Processor health state (static shared state)
    /// </summary>
    public class ProcessorHealthState
    {
        public DateTime? LastBatchTime { get; set; }
        public int LastBatchCount { get; set; }
        public long TotalProcessed { get; set; }
        public long TotalErrors { get; set; }
        public bool IsRunning { get; set; }
    }
}
