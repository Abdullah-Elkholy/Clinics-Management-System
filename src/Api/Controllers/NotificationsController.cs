using Clinics.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Clinics.Api.Hubs;
using Microsoft.EntityFrameworkCore;

namespace Clinics.Api.Controllers;

public class WhatsAppSessionUpdateDto
{
    public int ModeratorUserId { get; set; }
    public string? Status { get; set; }
    public bool? IsPaused { get; set; }
    public string? PauseReason { get; set; }
    public DateTime Timestamp { get; set; }
}

[ApiController]
[Route("api/[controller]")]
public class NotificationsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IHubContext<DataUpdateHub> _hubContext;
    private readonly ILogger<NotificationsController> _logger;

    public NotificationsController(
        ApplicationDbContext db,
        IHubContext<DataUpdateHub> hubContext,
        ILogger<NotificationsController> logger)
    {
        _db = db;
        _hubContext = hubContext;
        _logger = logger;
    }

    /// <summary>
    /// Receive WhatsAppSession update notifications from the WhatsApp service
    /// and broadcast them via SignalR to connected clients
    /// </summary>
    [HttpPost("whatsapp-session-update")]
    [AllowAnonymous] // Allow calls from the WhatsApp service (same machine, no auth needed)
    public async Task<IActionResult> WhatsAppSessionUpdate([FromBody] WhatsAppSessionUpdateDto update)
    {
        try
        {
            _logger.LogInformation(
                "Received WhatsAppSession update notification for moderator {ModeratorId}: Status={Status}, IsPaused={IsPaused}, PauseReason={PauseReason}",
                update.ModeratorUserId, update.Status, update.IsPaused, update.PauseReason);

            // Fetch the latest WhatsAppSession from database to get all fields
            var whatsappSession = await _db.WhatsAppSessions
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.ModeratorUserId == update.ModeratorUserId && !s.IsDeleted);

            if (whatsappSession == null)
            {
                _logger.LogWarning("WhatsAppSession not found for moderator {ModeratorId}", update.ModeratorUserId);
                return NotFound(new { success = false, error = "WhatsAppSession not found" });
            }

            // Prepare payload for SignalR
            var payload = new
            {
                id = whatsappSession.Id,
                moderatorUserId = whatsappSession.ModeratorUserId,
                status = whatsappSession.Status,
                isPaused = whatsappSession.IsPaused,
                pauseReason = whatsappSession.PauseReason,
                pausedAt = whatsappSession.PausedAt,
                pausedBy = whatsappSession.PausedBy,
                isResumable = whatsappSession.IsResumable,  // Computed property for frontend
                lastSyncAt = whatsappSession.LastSyncAt,
                sessionName = whatsappSession.SessionName,
                providerSessionId = whatsappSession.ProviderSessionId,
                eventType = "updated",
                timestamp = DateTime.UtcNow
            };

            // Broadcast to moderator's group
            await _hubContext.Clients
                .Group($"moderator-{update.ModeratorUserId}")
                .SendAsync("WhatsAppSessionUpdated", payload);

            _logger.LogDebug(
                "SignalR: Sent WhatsAppSessionUpdated event to moderator-{ModeratorId}",
                update.ModeratorUserId);

            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing WhatsAppSession update notification for moderator {ModeratorId}",
                update.ModeratorUserId);
            return StatusCode(500, new { success = false, error = ex.Message });
        }
    }
}
