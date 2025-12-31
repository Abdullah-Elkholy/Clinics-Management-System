using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Cors;
using Clinics.Api.Services.Extension;
using Clinics.Infrastructure;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Clinics.Api.Controllers
{
    /// <summary>
    /// Controller for browser extension pairing, lease management, and command handling.
    /// </summary>
    [ApiController]
    [Route("api/extension")]
    [EnableCors("ExtensionPolicy")]
    public class ExtensionController : ControllerBase
    {
        private readonly IExtensionPairingService _pairingService;
        private readonly IExtensionLeaseService _leaseService;
        private readonly IExtensionCommandService _commandService;
        private readonly ApplicationDbContext _db;
        private readonly ILogger<ExtensionController> _logger;

        public ExtensionController(
            IExtensionPairingService pairingService,
            IExtensionLeaseService leaseService,
            IExtensionCommandService commandService,
            ApplicationDbContext db,
            ILogger<ExtensionController> logger)
        {
            _pairingService = pairingService;
            _leaseService = leaseService;
            _commandService = commandService;
            _db = db;
            _logger = logger;
        }

        #region Pairing Endpoints

        /// <summary>
        /// Start pairing process - generates a short code for moderator to enter in extension.
        /// Requires authenticated moderator.
        /// </summary>
        [HttpPost("pairing/start")]
        [Authorize(Policy = "ModeratorOrAbove")]
        public async Task<ActionResult<PairingStartResponse>> StartPairing()
        {
            var moderatorId = GetModeratorId();
            if (moderatorId == null)
            {
                return BadRequest(new { error = "Unable to determine moderator ID" });
            }

            var pairingCode = await _pairingService.StartPairingAsync(moderatorId.Value);

            return Ok(new PairingStartResponse
            {
                Code = pairingCode.Code,
                ExpiresAt = pairingCode.ExpiresAtUtc,
                ExpiresInSeconds = (int)(pairingCode.ExpiresAtUtc - DateTime.UtcNow).TotalSeconds
            });
        }

        /// <summary>
        /// Complete pairing - extension submits code and receives device token.
        /// No authentication required (code is the auth).
        /// </summary>
        [HttpPost("pairing/complete")]
        [AllowAnonymous]
        public async Task<ActionResult<PairingCompleteResponse>> CompletePairing([FromBody] PairingCompleteRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Code) || string.IsNullOrWhiteSpace(request.DeviceId))
            {
                return BadRequest(new { error = "Code and DeviceId are required" });
            }

            var (device, token, error) = await _pairingService.CompletePairingAsync(
                request.Code,
                request.DeviceId,
                request.DeviceName,
                request.ExtensionVersion,
                request.UserAgent);

            if (device == null)
            {
                return BadRequest(new { error });
            }

            return Ok(new PairingCompleteResponse
            {
                DeviceId = device.Id,
                ModeratorUserId = device.ModeratorUserId,
                DeviceToken = token!,
                TokenExpiresAt = device.TokenExpiresAtUtc
            });
        }

        /// <summary>
        /// Get all paired devices for current moderator.
        /// </summary>
        [HttpGet("devices")]
        [Authorize(Policy = "ModeratorOrAbove")]
        public async Task<ActionResult<IList<DeviceDto>>> GetDevices()
        {
            var moderatorId = GetModeratorId();
            if (moderatorId == null)
            {
                return BadRequest(new { error = "Unable to determine moderator ID" });
            }

            var devices = await _pairingService.GetDevicesAsync(moderatorId.Value);

            return Ok(devices.Select(d => new DeviceDto
            {
                Id = d.Id,
                DeviceId = d.DeviceId,
                DeviceName = d.DeviceName,
                ExtensionVersion = d.ExtensionVersion,
                LastSeenAt = d.LastSeenAtUtc,
                IsActive = d.IsActive,
                RevokedAt = d.RevokedAtUtc,
                RevokedReason = d.RevokedReason
            }));
        }

        /// <summary>
        /// Revoke a device (logout).
        /// </summary>
        [HttpPost("devices/{deviceId}/revoke")]
        [Authorize(Policy = "ModeratorOrAbove")]
        public async Task<ActionResult> RevokeDevice(Guid deviceId, [FromBody] RevokeDeviceRequest request)
        {
            var moderatorId = GetModeratorId();
            if (moderatorId == null)
            {
                return BadRequest(new { error = "Unable to determine moderator ID" });
            }

            // Verify device belongs to this moderator
            var device = await _db.ExtensionDevices.FindAsync(deviceId);
            if (device == null || device.ModeratorUserId != moderatorId.Value)
            {
                return NotFound(new { error = "Device not found" });
            }

            var success = await _pairingService.RevokeDeviceAsync(deviceId, request.Reason ?? "UserRevoked");

            return success 
                ? Ok(new { success = true }) 
                : BadRequest(new { error = "Failed to revoke device" });
        }

        /// <summary>
        /// Delete/revoke a device (alternative DELETE endpoint).
        /// This permanently removes the device and all associated data.
        /// </summary>
        [HttpDelete("devices/{deviceId}")]
        [Authorize(Policy = "ModeratorOrAbove")]
        public async Task<ActionResult> DeleteDevice(Guid deviceId)
        {
            var moderatorId = GetModeratorId();
            if (moderatorId == null)
            {
                return BadRequest(new { error = "Unable to determine moderator ID" });
            }

            // Verify device belongs to this moderator
            var device = await _db.ExtensionDevices.FindAsync(deviceId);
            if (device == null || device.ModeratorUserId != moderatorId.Value)
            {
                return NotFound(new { error = "Device not found" });
            }

            var success = await _pairingService.DeleteDeviceAsync(deviceId);

            return success 
                ? NoContent() 
                : BadRequest(new { error = "Failed to delete device" });
        }

        #endregion

        #region Lease Endpoints

        /// <summary>
        /// Acquire a session lease for the extension.
        /// Extension must provide device token for authentication.
        /// </summary>
        [HttpPost("lease/acquire")]
        [AllowAnonymous]
        public async Task<ActionResult<LeaseAcquireResponse>> AcquireLease([FromBody] LeaseAcquireRequest request)
        {
            try
            {
                _logger.LogDebug("Lease acquisition request for device {DeviceId}", request.DeviceId);
                
                // Validate device token
                var device = await ValidateDeviceToken(request.DeviceId, request.DeviceToken);
                if (device == null)
                {
                    _logger.LogWarning("Invalid device token for device {DeviceId}", request.DeviceId);
                    return Unauthorized(new { error = "Invalid device token" });
                }

                _logger.LogDebug("Device validated, acquiring lease for moderator {ModeratorId}", device.ModeratorUserId);

                var (lease, leaseToken, error) = await _leaseService.AcquireLeaseAsync(
                    device.ModeratorUserId,
                    device.Id,
                    request.ForceTakeover);

                if (lease == null)
                {
                    _logger.LogWarning("Failed to acquire lease: {Error}", error);
                    return BadRequest(new { error });
                }

                _logger.LogInformation("Lease acquired successfully for moderator {ModeratorId}", device.ModeratorUserId);

                return Ok(new LeaseAcquireResponse
                {
                    LeaseId = lease.Id,
                    LeaseToken = leaseToken!,
                    ModeratorUserId = lease.ModeratorUserId,
                    ExpiresAt = lease.ExpiresAtUtc
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception in AcquireLease for device {DeviceId}", request.DeviceId);
                return StatusCode(500, new { error = $"Internal server error: {ex.Message}" });
            }
        }

        /// <summary>
        /// Heartbeat to keep lease alive and report status.
        /// </summary>
        [HttpPost("lease/heartbeat")]
        [AllowAnonymous]
        public async Task<ActionResult> Heartbeat([FromBody] HeartbeatRequest request)
        {
            _logger.LogDebug("Heartbeat received - LeaseId: {LeaseId}, WhatsAppStatus: {Status}", 
                request.LeaseId, request.WhatsAppStatus);
            
            var (success, error) = await _leaseService.HeartbeatAsync(
                request.LeaseId,
                request.LeaseToken,
                request.CurrentUrl,
                request.WhatsAppStatus,
                request.LastError);

            if (success)
            {
                _logger.LogDebug("Heartbeat successful for lease {LeaseId}", request.LeaseId);
            }
            else
            {
                _logger.LogWarning("Heartbeat failed for lease {LeaseId}: {Error}", request.LeaseId, error);
            }

            return success 
                ? Ok(new { success = true }) 
                : BadRequest(new { error });
        }

        /// <summary>
        /// Release lease explicitly.
        /// </summary>
        [HttpPost("lease/release")]
        [AllowAnonymous]
        public async Task<ActionResult> ReleaseLease([FromBody] LeaseReleaseRequest request)
        {
            var success = await _leaseService.ReleaseLeaseAsync(
                request.LeaseId,
                request.LeaseToken,
                request.Reason ?? "Released");

            return success 
                ? Ok(new { success = true }) 
                : BadRequest(new { error = "Failed to release lease" });
        }

        /// <summary>
        /// Get active lease status for current moderator (for web UI).
        /// </summary>
        [HttpGet("lease/status")]
        [Authorize(Policy = "ModeratorOrAbove")]
        public async Task<ActionResult<LeaseStatusResponse>> GetLeaseStatus()
        {
            var moderatorId = GetModeratorId();
            if (moderatorId == null)
            {
                return BadRequest(new { error = "Unable to determine moderator ID" });
            }

            var lease = await _leaseService.GetActiveLeaseAsync(moderatorId.Value);

            return Ok(new LeaseStatusResponse
            {
                HasActiveLease = lease != null,
                LeaseId = lease?.Id,
                DeviceId = lease?.DeviceId,
                DeviceName = lease?.Device?.DeviceName,
                WhatsAppStatus = lease?.WhatsAppStatus,
                CurrentUrl = lease?.CurrentUrl,
                LastHeartbeat = lease?.LastHeartbeatAtUtc,
                ExpiresAt = lease?.ExpiresAtUtc
            });
        }

        /// <summary>
        /// Force release the current lease from web UI.
        /// </summary>
        [HttpPost("lease/force-release")]
        [Authorize(Policy = "ModeratorOrAbove")]
        public async Task<ActionResult> ForceReleaseLease()
        {
            var moderatorId = GetModeratorId();
            if (moderatorId == null)
            {
                return BadRequest(new { error = "Unable to determine moderator ID" });
            }

            var lease = await _leaseService.GetActiveLeaseAsync(moderatorId.Value);
            if (lease == null)
            {
                return Ok(new { success = true, message = "No active lease" });
            }

            var success = await _leaseService.ForceReleaseLeaseAsync(moderatorId.Value, "ForceReleasedFromUI");

            return success 
                ? Ok(new { success = true }) 
                : BadRequest(new { error = "Failed to release lease" });
        }

        #endregion

        #region Command Endpoints

        /// <summary>
        /// Get pending commands (polling fallback for extension).
        /// </summary>
        [HttpGet("commands/pending")]
        [AllowAnonymous]
        public async Task<ActionResult<IList<CommandDto>>> GetPendingCommands(
            [FromQuery] Guid leaseId,
            [FromQuery] string leaseToken)
        {
            var isValid = await _leaseService.ValidateLeaseAsync(leaseId, leaseToken);
            if (!isValid)
            {
                return Unauthorized(new { error = "Invalid lease" });
            }

            var lease = await _db.ExtensionSessionLeases.FindAsync(leaseId);
            if (lease == null)
            {
                return NotFound(new { error = "Lease not found" });
            }

            var commands = await _commandService.GetPendingCommandsAsync(lease.ModeratorUserId);

            return Ok(commands.Select(c => new CommandDto
            {
                Id = c.Id,
                CommandType = c.CommandType,
                PayloadJson = c.PayloadJson,
                CreatedAt = c.CreatedAtUtc,
                ExpiresAt = c.ExpiresAtUtc
            }));
        }

        /// <summary>
        /// Acknowledge command receipt.
        /// </summary>
        [HttpPost("commands/{commandId}/ack")]
        [AllowAnonymous]
        public async Task<ActionResult> AckCommand(Guid commandId, [FromBody] CommandAuthRequest request)
        {
            var isValid = await _leaseService.ValidateLeaseAsync(request.LeaseId, request.LeaseToken);
            if (!isValid)
            {
                return Unauthorized(new { error = "Invalid lease" });
            }

            var success = await _commandService.AcknowledgeAsync(commandId);
            return success 
                ? Ok(new { success = true }) 
                : BadRequest(new { error = "Failed to acknowledge command" });
        }

        /// <summary>
        /// Complete command with result.
        /// </summary>
        [HttpPost("commands/{commandId}/complete")]
        [AllowAnonymous]
        public async Task<ActionResult> CompleteCommand(Guid commandId, [FromBody] CommandCompleteRequest request)
        {
            var isValid = await _leaseService.ValidateLeaseAsync(request.LeaseId, request.LeaseToken);
            if (!isValid)
            {
                return Unauthorized(new { error = "Invalid lease" });
            }

            var success = await _commandService.CompleteAsync(commandId, request.ResultStatus, request.ResultData);
            return success 
                ? Ok(new { success = true }) 
                : BadRequest(new { error = "Failed to complete command" });
        }

        #endregion

        #region Status Endpoint

        /// <summary>
        /// Extension reports its WhatsApp status.
        /// </summary>
        [HttpPost("status")]
        [AllowAnonymous]
        public async Task<ActionResult> ReportStatus([FromBody] StatusReportRequest request)
        {
            var (success, error) = await _leaseService.HeartbeatAsync(
                request.LeaseId,
                request.LeaseToken,
                request.Url,
                request.Status,
                request.Error);

            return success 
                ? Ok(new { success = true }) 
                : BadRequest(new { error });
        }

        #endregion

        #region Helper Methods

        private int? GetModeratorId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!int.TryParse(userIdClaim, out var userId))
            {
                return null;
            }

            var user = _db.Users.AsNoTracking().FirstOrDefault(u => u.Id == userId);
            if (user == null) return null;

            // If user is a moderator, return their ID
            if (user.Role == "moderator")
            {
                return user.Id;
            }

            // If user is a regular user, return their moderator's ID
            if (user.Role == "user" && user.ModeratorId.HasValue)
            {
                return user.ModeratorId.Value;
            }

            // Admins can't have extensions (or could return the target moderator ID from request)
            return null;
        }

        private async Task<Domain.ExtensionDevice?> ValidateDeviceToken(string deviceId, string deviceToken)
        {
            // Look up by the extension's DeviceId (string), not the DB primary key (Guid)
            var device = await _db.ExtensionDevices
                .FirstOrDefaultAsync(d => d.DeviceId == deviceId);
            if (device == null) return null;

            if (!device.IsActive) return null;

            var tokenHash = ExtensionPairingService.HashToken(deviceToken);
            if (device.TokenHash != tokenHash) return null;

            // Update last seen
            device.LastSeenAtUtc = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            return device;
        }

        #endregion
    }

    #region DTOs

    public class PairingStartResponse
    {
        public string Code { get; set; } = "";
        public DateTime ExpiresAt { get; set; }
        public int ExpiresInSeconds { get; set; }
    }

    public class PairingCompleteRequest
    {
        public string Code { get; set; } = "";
        public string DeviceId { get; set; } = "";
        public string? DeviceName { get; set; }
        public string? ExtensionVersion { get; set; }
        public string? UserAgent { get; set; }
    }

    public class PairingCompleteResponse
    {
        public Guid DeviceId { get; set; }
        public int ModeratorUserId { get; set; }
        public string DeviceToken { get; set; } = "";
        public DateTime TokenExpiresAt { get; set; }
    }

    public class DeviceDto
    {
        public Guid Id { get; set; }
        public string DeviceId { get; set; } = "";
        public string? DeviceName { get; set; }
        public string? ExtensionVersion { get; set; }
        public DateTime? LastSeenAt { get; set; }
        public bool IsActive { get; set; }
        public DateTime? RevokedAt { get; set; }
        public string? RevokedReason { get; set; }
    }

    public class RevokeDeviceRequest
    {
        public string? Reason { get; set; }
    }

    public class LeaseAcquireRequest
    {
        /// <summary>
        /// The extension's unique device identifier (string UUID, not the DB primary key).
        /// </summary>
        public string DeviceId { get; set; } = "";
        public string DeviceToken { get; set; } = "";
        public bool ForceTakeover { get; set; }
    }

    public class LeaseAcquireResponse
    {
        public Guid LeaseId { get; set; }
        public string LeaseToken { get; set; } = "";
        public int ModeratorUserId { get; set; }
        public DateTime ExpiresAt { get; set; }
    }

    public class HeartbeatRequest
    {
        public Guid LeaseId { get; set; }
        public string LeaseToken { get; set; } = "";
        public string? CurrentUrl { get; set; }
        public string? WhatsAppStatus { get; set; }
        public string? LastError { get; set; }
    }

    public class LeaseReleaseRequest
    {
        public Guid LeaseId { get; set; }
        public string LeaseToken { get; set; } = "";
        public string? Reason { get; set; }
    }

    public class LeaseStatusResponse
    {
        public bool HasActiveLease { get; set; }
        public Guid? LeaseId { get; set; }
        public Guid? DeviceId { get; set; }
        public string? DeviceName { get; set; }
        public string? WhatsAppStatus { get; set; }
        public string? CurrentUrl { get; set; }
        public DateTime? LastHeartbeat { get; set; }
        public DateTime? ExpiresAt { get; set; }
    }

    public class CommandDto
    {
        public Guid Id { get; set; }
        public string CommandType { get; set; } = "";
        public string PayloadJson { get; set; } = "";
        public DateTime CreatedAt { get; set; }
        public DateTime ExpiresAt { get; set; }
    }

    public class CommandAuthRequest
    {
        public Guid LeaseId { get; set; }
        public string LeaseToken { get; set; } = "";
    }

    public class CommandCompleteRequest
    {
        public Guid LeaseId { get; set; }
        public string LeaseToken { get; set; } = "";
        public string ResultStatus { get; set; } = "";
        public object? ResultData { get; set; }
    }

    public class StatusReportRequest
    {
        public Guid LeaseId { get; set; }
        public string LeaseToken { get; set; } = "";
        public string Status { get; set; } = "";
        public string? Url { get; set; }
        public string? Error { get; set; }
    }

    #endregion
}
