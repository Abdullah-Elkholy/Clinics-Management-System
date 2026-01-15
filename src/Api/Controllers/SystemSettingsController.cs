using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Clinics.Api.Services;

namespace Clinics.Api.Controllers
{
    /// <summary>
    /// Controller for managing system-wide settings.
    /// Read operations are available to all authenticated users.
    /// Write operations are restricted to admins.
    /// </summary>
    [ApiController]
    [Route("api/settings")]
    [Authorize]  // Require authentication for all endpoints
    public class SystemSettingsController : ControllerBase
    {
        private readonly IRateLimitSettingsService _rateLimitService;
        private readonly ILogger<SystemSettingsController> _logger;

        public SystemSettingsController(
            IRateLimitSettingsService rateLimitService,
            ILogger<SystemSettingsController> logger)
        {
            _rateLimitService = rateLimitService;
            _logger = logger;
        }

        /// <summary>
        /// Get current rate limit settings.
        /// Available to all authenticated users for time estimation purposes.
        /// </summary>
        /// <returns>Rate limit configuration</returns>
        [HttpGet("rate-limit")]
        [ProducesResponseType(typeof(RateLimitSettingsResponse), 200)]
        public async Task<IActionResult> GetRateLimitSettings()
        {
            var settings = await _rateLimitService.GetRateLimitSettingsAsync();

            return Ok(new RateLimitSettingsResponse
            {
                MinSeconds = settings.MinSeconds,
                MaxSeconds = settings.MaxSeconds,
                Enabled = settings.Enabled,
                EstimatedSecondsPerMessage = settings.EstimatedSecondsPerMessage
            });
        }

        /// <summary>
        /// Update rate limit settings.
        /// Restricted to primary_admin and secondary_admin roles only.
        /// </summary>
        /// <param name="request">New rate limit values</param>
        /// <returns>Updated settings</returns>
        [HttpPut("rate-limit")]
        [Authorize(Roles = "primary_admin,secondary_admin")]
        [ProducesResponseType(typeof(RateLimitSettingsResponse), 200)]
        [ProducesResponseType(400)]
        [ProducesResponseType(403)]
        public async Task<IActionResult> UpdateRateLimitSettings([FromBody] UpdateRateLimitRequest request)
        {
            // Validation
            if (request.MinSeconds < 0 || request.MinSeconds > 60)
            {
                return BadRequest(new { message = "الحد الأدنى يجب أن يكون بين 0 و 60 ثانية" });
            }

            if (request.MaxSeconds < 1 || request.MaxSeconds > 120)
            {
                return BadRequest(new { message = "الحد الأقصى يجب أن يكون بين 1 و 120 ثانية" });
            }

            if (request.MaxSeconds < request.MinSeconds)
            {
                return BadRequest(new { message = "الحد الأقصى يجب أن يكون أكبر من أو يساوي الحد الأدنى" });
            }

            // Get current user ID from claims
            var userIdClaim = User.FindFirst("userId")?.Value;
            var userId = int.TryParse(userIdClaim, out var id) ? id : 0;

            try
            {
                await _rateLimitService.UpdateRateLimitSettingsAsync(
                    request.MinSeconds,
                    request.MaxSeconds,
                    request.Enabled,
                    userId);

                _logger.LogInformation("Rate limit settings updated by user {UserId}: Min={Min}s, Max={Max}s, Enabled={Enabled}",
                    userId, request.MinSeconds, request.MaxSeconds, request.Enabled);

                // Return updated settings
                var settings = await _rateLimitService.GetRateLimitSettingsAsync();

                return Ok(new RateLimitSettingsResponse
                {
                    MinSeconds = settings.MinSeconds,
                    MaxSeconds = settings.MaxSeconds,
                    Enabled = settings.Enabled,
                    EstimatedSecondsPerMessage = settings.EstimatedSecondsPerMessage
                });
            }
            catch (ArgumentException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
    }

    /// <summary>
    /// Response DTO for rate limit settings.
    /// </summary>
    public class RateLimitSettingsResponse
    {
        /// <summary>
        /// Minimum delay in seconds between messages.
        /// </summary>
        public int MinSeconds { get; set; }

        /// <summary>
        /// Maximum delay in seconds between messages.
        /// </summary>
        public int MaxSeconds { get; set; }

        /// <summary>
        /// Whether rate limiting is enabled.
        /// </summary>
        public bool Enabled { get; set; }

        /// <summary>
        /// Estimated seconds per message (for UI time estimation).
        /// Calculated as (min+max)/2 + processing time.
        /// </summary>
        public double EstimatedSecondsPerMessage { get; set; }
    }

    /// <summary>
    /// Request DTO for updating rate limit settings.
    /// </summary>
    public class UpdateRateLimitRequest
    {
        /// <summary>
        /// Minimum delay in seconds (0-60).
        /// </summary>
        public int MinSeconds { get; set; }

        /// <summary>
        /// Maximum delay in seconds (1-120).
        /// </summary>
        public int MaxSeconds { get; set; }

        /// <summary>
        /// Enable or disable rate limiting.
        /// </summary>
        public bool Enabled { get; set; } = true;
    }
}
