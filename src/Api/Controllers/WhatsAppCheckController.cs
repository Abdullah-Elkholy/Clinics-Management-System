using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Clinics.Infrastructure;
using Clinics.Domain;
using Clinics.Api.Services.Extension;
using Clinics.Api.DTOs;
using System.Security.Claims;

namespace Clinics.Api.Controllers
{
    /// <summary>
    /// Controller for WhatsApp number validation using browser extension.
    /// Replaces legacy Playwright-based check-whatsapp endpoint.
    /// </summary>
    [ApiController]
    [Route("api/whatsapp/check")]
    [Authorize]
    public class WhatsAppCheckController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly IExtensionCommandService _commandService;
        private readonly ILogger<WhatsAppCheckController> _logger;

        public WhatsAppCheckController(
            ApplicationDbContext db,
            IExtensionCommandService commandService,
            ILogger<WhatsAppCheckController> logger)
        {
            _db = db;
            _commandService = commandService;
            _logger = logger;
        }

        /// <summary>
        /// Check if a phone number is a valid WhatsApp number.
        /// Creates a check session (MessageSession with SessionType=check_whatsapp) and pauses sending.
        /// </summary>
        /// <param name="phoneNumber">Phone number with country code (e.g., 966512345678)</param>
        /// <param name="queueId">Optional queue ID for queue-specific checks</param>
        /// <returns>OperationResult&lt;bool&gt; indicating if number is valid</returns>
        [HttpPost("{phoneNumber}")]
        [Authorize(Policy = "ModeratorOrAbove")]
        public async Task<ActionResult<OperationResult<bool>>> CheckPhoneNumber(
            string phoneNumber,
            [FromQuery] int? queueId = null,
            [FromQuery] bool forceCheck = false)
        {
            var moderatorId = GetModeratorId();
            if (moderatorId == null)
            {
                return BadRequest(new OperationResult<bool>
                {
                    Success = false,
                    Category = "BadRequest",
                    Message = "Unable to determine moderator ID"
                });
            }

            var userId = GetUserId();
            if (userId == null)
            {
                return BadRequest(new OperationResult<bool>
                {
                    Success = false,
                    Category = "BadRequest",
                    Message = "Unable to determine user ID"
                });
            }

            // Validate phone number format
            if (string.IsNullOrWhiteSpace(phoneNumber) || !System.Text.RegularExpressions.Regex.IsMatch(phoneNumber, @"^\d{10,15}$"))
            {
                return BadRequest(new OperationResult<bool>
                {
                    Success = false,
                    Category = "BadRequest",
                    Message = "Invalid phone number format. Must be 10-15 digits with country code."
                });
            }

            using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                // Get or create WhatsAppSession
                var whatsappSession = await _db.WhatsAppSessions
                    .FirstOrDefaultAsync(ws => ws.ModeratorUserId == moderatorId.Value);

                if (whatsappSession == null)
                {
                    return BadRequest(new OperationResult<bool>
                    {
                        Success = false,
                        Category = "NotConnected",
                        Message = "WhatsApp session not found. Please connect your browser extension."
                    });
                }

                // Pre-flight checks: verify session is connected and not already paused by user
                if (whatsappSession.Status != "connected")
                {
                    return BadRequest(new OperationResult<bool>
                    {
                        Success = false,
                        Category = whatsappSession.Status == "qr_pending" ? "PendingQR" : "NotConnected",
                        Message = $"WhatsApp session status is {whatsappSession.Status}. Cannot check numbers."
                    });
                }

                // Check if already checking (prevent concurrent checks)
                var existingCheckSession = await _db.MessageSessions
                    .Where(ms => ms.ModeratorId == moderatorId.Value
                        && ms.SessionType == MessageSessionTypes.CheckWhatsApp
                        && (ms.Status == "active" || ms.Status == "paused"))
                    .FirstOrDefaultAsync();

                if (existingCheckSession != null)
                {
                    return BadRequest(new OperationResult<bool>
                    {
                        Success = false,
                        Category = "ConcurrentCheck",
                        Message = "A check operation is already in progress. Please wait for it to complete."
                    });
                }

                // Create check session (higher priority than send sessions)
                var checkSession = new MessageSession
                {
                    QueueId = queueId ?? 0, // 0 for non-queue checks
                    ModeratorId = moderatorId.Value,
                    UserId = userId.Value,
                    SessionType = MessageSessionTypes.CheckWhatsApp,
                    Status = "active",
                    IsPaused = false,
                    TotalMessages = 1,
                    SentMessages = 0,
                    FailedMessages = 0,
                    OngoingMessages = 1,
                    StartTime = DateTime.UtcNow
                };

                _db.MessageSessions.Add(checkSession);
                await _db.SaveChangesAsync(); // Save to get session ID

                // Set global pause with CheckWhatsApp reason (unresumable)
                whatsappSession.IsPaused = true;
                whatsappSession.PausedAt = DateTime.UtcNow;
                whatsappSession.PausedBy = userId.Value;
                whatsappSession.PauseReason = "CheckWhatsApp";
                whatsappSession.UpdatedAt = DateTime.UtcNow;
                whatsappSession.UpdatedBy = userId.Value;

                await _db.SaveChangesAsync();

                // Create extension command
                var command = new ExtensionCommand
                {
                    CommandType = ExtensionCommandTypes.CheckWhatsAppNumber,
                    Status = ExtensionCommandStatuses.Pending,
                    ModeratorUserId = moderatorId.Value,
                    CreatedAtUtc = DateTime.UtcNow,
                    ExpiresAtUtc = DateTime.UtcNow.AddMinutes(2), // 2 min timeout for checks
                    Priority = 200, // Higher priority than SendMessage (100)
                    PayloadJson = System.Text.Json.JsonSerializer.Serialize(new
                    {
                        phoneNumber,
                        sessionId = checkSession.Id
                    })
                };

                _db.ExtensionCommands.Add(command);
                await _db.SaveChangesAsync();

                await transaction.CommitAsync();

                _logger.LogInformation(
                "Check session {SessionId} created for phone {Phone} by moderator {ModeratorId}",
                checkSession.Id, phoneNumber, moderatorId.Value);

                // Poll for command completion (with timeout)
                var result = await PollForCheckResult(command.Id, checkSession.Id, TimeSpan.FromMinutes(2));

                return Ok(result);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Error creating check session for phone {Phone}", phoneNumber);

                return StatusCode(500, new OperationResult<bool>
                {
                    Success = false,
                    Category = "ServerError",
                    Message = "Failed to initiate number check"
                });
            }
        }

        /// <summary>
        /// Cancel a running check session.
        /// Called when MessagePreviewModal is closed or user clicks cancel.
        /// </summary>
        [HttpPost("sessions/{sessionId}/cancel")]
        [Authorize(Policy = "ModeratorOrAbove")]
        public async Task<ActionResult> CancelCheckSession(Guid sessionId)
        {
            var moderatorId = GetModeratorId();
            if (moderatorId == null)
            {
                return BadRequest(new { success = false, error = "Unable to determine moderator ID" });
            }

            var userId = GetUserId();
            if (userId == null)
            {
                return BadRequest(new { success = false, error = "Unable to determine user ID" });
            }

            try
            {
                var checkSession = await _db.MessageSessions
                    .FirstOrDefaultAsync(ms => ms.Id == sessionId
                        && ms.ModeratorId == moderatorId.Value
                        && ms.SessionType == MessageSessionTypes.CheckWhatsApp);

                if (checkSession == null)
                {
                    return NotFound(new { success = false, error = "Check session not found" });
                }

                // Mark session as cancelled
                checkSession.Status = "cancelled";
                checkSession.LastUpdated = DateTime.UtcNow;

                // Expire pending commands for this session
                var pendingCommands = await _db.ExtensionCommands
                    .Where(cmd => cmd.ModeratorUserId == moderatorId.Value
                        && cmd.CommandType == ExtensionCommandTypes.CheckWhatsAppNumber
                        && cmd.Status == ExtensionCommandStatuses.Pending
                        && cmd.PayloadJson.Contains(sessionId.ToString()))
                    .ToListAsync();

                foreach (var cmd in pendingCommands)
                {
                    cmd.Status = ExtensionCommandStatuses.Expired;
                }

                // Clear CheckWhatsApp pause reason (allow resuming)
                var whatsappSession = await _db.WhatsAppSessions
                    .FirstOrDefaultAsync(ws => ws.ModeratorUserId == moderatorId.Value);

                if (whatsappSession != null && whatsappSession.PauseReason == "CheckWhatsApp")
                {
                    whatsappSession.IsPaused = false;
                    whatsappSession.PauseReason = null;
                }

                await _db.SaveChangesAsync();

                _logger.LogInformation("Check session {SessionId} cancelled by user {UserId}", sessionId, userId.Value);

                return Ok(new { success = true, message = "Check session cancelled" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error cancelling check session {SessionId}", sessionId);
                return StatusCode(500, new { success = false, error = "Failed to cancel check session" });
            }
        }

        #region Helpers

        private int? GetModeratorId()
        {
            var moderatorIdClaim = User.FindFirst("moderatorId")?.Value;
            if (!string.IsNullOrEmpty(moderatorIdClaim) && int.TryParse(moderatorIdClaim, out var moderatorId))
            {
                return moderatorId;
            }

            // Fallback: if user is a moderator, use their own ID
            var userRole = User.FindFirst(ClaimTypes.Role)?.Value;
            if (userRole == "moderator")
            {
                var userId = GetUserId();
                return userId;
            }

            return null;
        }

        private int? GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value
                ?? User.FindFirst("userId")?.Value;

            if (!string.IsNullOrEmpty(userIdClaim) && int.TryParse(userIdClaim, out var userId))
            {
                return userId;
            }

            return null;
        }

        /// <summary>
        /// Poll for check command result with timeout.
        /// </summary>
        private async Task<OperationResult<bool>> PollForCheckResult(Guid commandId, Guid sessionId, TimeSpan timeout)
        {
            var startTime = DateTime.UtcNow;
            var pollInterval = TimeSpan.FromMilliseconds(500);

            while (DateTime.UtcNow - startTime < timeout)
            {
                var command = await _db.ExtensionCommands.FindAsync(commandId);
                if (command == null)
                {
                    return new OperationResult<bool>
                    {
                        Success = false,
                        Category = "CommandNotFound",
                        Message = "Check command not found"
                    };
                }

                // Check if command completed
                if (command.Status == ExtensionCommandStatuses.Completed)
                {
                    // Parse result from command
                    var resultPayload = command.ResultJson != null
                        ? System.Text.Json.JsonSerializer.Deserialize<CheckResultPayload>(command.ResultJson)
                        : null;

                    // Clean up: clear pause and mark session complete
                    await CleanupCheckSession(sessionId, command.ModeratorUserId, success: true);

                    return new OperationResult<bool>
                    {
                        Success = true,
                        Category = "Success",
                        Data = resultPayload?.IsValid ?? false,
                        Message = resultPayload?.IsValid == true
                            ? "Number is a valid WhatsApp account"
                            : "Number is not registered on WhatsApp"
                    };
                }

                // Check if command failed
                if (command.Status == ExtensionCommandStatuses.Failed || command.Status == ExtensionCommandStatuses.Expired)
                {
                    await CleanupCheckSession(sessionId, command.ModeratorUserId, success: false);

                    return new OperationResult<bool>
                    {
                        Success = false,
                        Category = command.Status == ExtensionCommandStatuses.Expired ? "Timeout" : "Failed",
                        Message = command.ResultJson ?? "Check operation failed"
                    };
                }

                await Task.Delay(pollInterval);
            }

            // Timeout: expire command and clear pause
            await CleanupCheckSession(sessionId, null, success: false);

            return new OperationResult<bool>
            {
                Success = false,
                Category = "Timeout",
                Message = "Check operation timed out"
            };
        }

        /// <summary>
        /// Cleanup check session: mark complete/failed and clear CheckWhatsApp pause.
        /// </summary>
        private async Task CleanupCheckSession(Guid sessionId, int? moderatorId, bool success)
        {
            var session = await _db.MessageSessions.FindAsync(sessionId);
            if (session != null)
            {
                session.Status = success ? "completed" : "failed";
                session.OngoingMessages = 0;
                session.SentMessages = success ? 1 : 0;
                session.FailedMessages = success ? 0 : 1;
                session.LastUpdated = DateTime.UtcNow;
                session.EndTime = DateTime.UtcNow;
            }

            // Clear CheckWhatsApp pause
            if (moderatorId.HasValue || session != null)
            {
                var modId = moderatorId ?? session!.ModeratorId;
                var whatsappSession = await _db.WhatsAppSessions
                    .FirstOrDefaultAsync(ws => ws.ModeratorUserId == modId);

                if (whatsappSession != null && whatsappSession.PauseReason == "CheckWhatsApp")
                {
                    whatsappSession.IsPaused = false;
                    whatsappSession.PauseReason = null;
                }
            }

            await _db.SaveChangesAsync();
        }

        #endregion
    }

    #region DTOs

    public class CheckResultPayload
    {
        public bool IsValid { get; set; }
        public string? Status { get; set; }
    }

    #endregion
}
