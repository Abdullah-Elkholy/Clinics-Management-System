using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Clinics.Api.DTOs;
using Clinics.Infrastructure;
using Clinics.Api.Services;
using System.Security.Claims;

namespace Clinics.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SessionsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<SessionsController> _logger;
    private readonly QuotaService _quotaService;

    public SessionsController(ApplicationDbContext context, ILogger<SessionsController> logger, QuotaService quotaService)
    {
        _context = context;
        _logger = logger;
        _quotaService = quotaService;
    }

    /// <summary>
    /// Get all ongoing message sending sessions for current user's moderator (unified session per moderator)
    /// </summary>
    [HttpGet("ongoing")]
    public async Task<IActionResult> GetOngoingSessions()
    {
        try
        {
            // Get current user ID
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value
                ?? User.FindFirst("userId")?.Value;
            
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized(new { success = false, error = "المستخدم غير مصرح له" });
            }

            // Get effective moderator ID (unified session per moderator)
            var moderatorId = await _quotaService.GetEffectiveModeratorIdAsync(userId);

            // Get sessions for this moderator only
            var sessions = await _context.MessageSessions
                .Include(s => s.Queue)
                .Where(s => s.ModeratorId == moderatorId && (s.Status == "active" || s.Status == "paused"))
                .OrderByDescending(s => s.StartTime)
                .ToListAsync();

            var sessionDtos = new List<OngoingSessionDto>();

            foreach (var session in sessions)
            {
                // Get messages linked to this session via SessionId
                var sessionMessages = await _context.Messages
                    .Where(m => m.SessionId == session.Id.ToString() && !m.IsDeleted)
                    .ToListAsync();

                // Get unique patient IDs from messages
                var patientIds = sessionMessages
                    .Where(m => m.PatientId.HasValue)
                    .Select(m => m.PatientId!.Value)
                    .Distinct()
                    .ToList();

                // Get patients with their message statuses
                var patients = await _context.Patients
                    .Where(p => patientIds.Contains(p.Id))
                    .Select(p => new
                    {
                        p.Id,
                        p.FullName,
                        p.PhoneNumber,
                        Message = sessionMessages
                            .Where(m => m.PatientId == p.Id)
                            .OrderByDescending(m => m.CreatedAt)
                            .FirstOrDefault()
                    })
                    .ToListAsync();

                sessionDtos.Add(new OngoingSessionDto
                {
                    SessionId = session.Id,
                    QueueName = session.Queue?.DoctorName ?? "غير محدد",
                    StartTime = session.StartTime,
                    Total = session.TotalMessages,
                    Sent = session.SentMessages,
                    Status = session.IsPaused ? "paused" : session.Status,
                    Patients = patients.Select(p => new SessionPatientDto
                    {
                        PatientId = p.Id,
                        Name = p.FullName,
                        Phone = p.PhoneNumber,
                        Status = MapMessageStatus(p.Message?.Status),
                        IsPaused = p.Message?.IsPaused ?? false
                    }).ToList()
                });
            }

            return Ok(new { success = true, data = sessionDtos });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching ongoing sessions");
            return StatusCode(500, new { success = false, error = "حدث خطأ أثناء جلب الجلسات الجارية" });
        }
    }

    /// <summary>
    /// Pause an ongoing session (uses MessagesController session pause logic)
    /// </summary>
    [HttpPost("{id}/pause")]
    public async Task<IActionResult> PauseSession(Guid id)
    {
        try
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value
                ?? User.FindFirst("userId")?.Value;
            
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized(new { success = false, error = "المستخدم غير مصرح له" });
            }

            // Pause all messages in this session
            var messages = await _context.Messages
                .Where(m => m.SessionId == id.ToString() && (m.Status == "queued" || m.Status == "sending") && !m.IsPaused)
                .ToListAsync();

            foreach (var msg in messages)
            {
                msg.IsPaused = true;
                msg.PausedAt = DateTime.UtcNow;
                msg.PausedBy = userId;
                msg.PauseReason = "SessionPaused";
                if (msg.Status == "sending")
                {
                    msg.Status = "queued";
                }
            }

            // Also pause the session itself
            var session = await _context.MessageSessions.FindAsync(id);
            
            if (session != null)
            {
                session.IsPaused = true;
                session.Status = "paused";
                session.PausedAt = DateTime.UtcNow;
                session.PausedBy = userId;
                session.PauseReason = "UserPaused";
                session.LastUpdated = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            return Ok(new { success = true, pausedCount = messages.Count });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error pausing session {SessionId}", id);
            return StatusCode(500, new { success = false, error = "حدث خطأ أثناء إيقاف الجلسة" });
        }
    }

    /// <summary>
    /// Resume a paused session (uses MessagesController session resume logic)
    /// </summary>
    [HttpPost("{id}/resume")]
    public async Task<IActionResult> ResumeSession(Guid id)
    {
        try
        {
            // Resume all paused messages in this session
            var messages = await _context.Messages
                .Where(m => m.SessionId == id.ToString() && m.IsPaused)
                .ToListAsync();

            foreach (var msg in messages)
            {
                msg.IsPaused = false;
                msg.PausedAt = null;
                msg.PausedBy = null;
                msg.PauseReason = null;
            }

            // Also resume the session itself
            var session = await _context.MessageSessions.FindAsync(id);
            
            if (session != null)
            {
                session.IsPaused = false;
                session.Status = "active";
                session.PausedAt = null;
                session.PausedBy = null;
                session.PauseReason = null;
                session.LastUpdated = DateTime.UtcNow;
            }

            await _context.SaveChangesAsync();
            return Ok(new { success = true, resumedCount = messages.Count });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error resuming session {SessionId}", id);
            return StatusCode(500, new { success = false, error = "حدث خطأ أثناء استئناف الجلسة" });
        }
    }

    /// <summary>
    /// Delete/cancel a session
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteSession(Guid id)
    {
        try
        {
            var session = await _context.MessageSessions.FindAsync(id);
            
            if (session == null)
            {
                return NotFound(new { success = false, error = "الجلسة غير موجودة" });
            }

            session.Status = "cancelled";
            session.EndTime = DateTime.UtcNow;
            session.LastUpdated = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting session {SessionId}", id);
            return StatusCode(500, new { success = false, error = "حدث خطأ أثناء حذف الجلسة" });
        }
    }

    /// <summary>
    /// Map internal message status to frontend status
    /// </summary>
    private static string MapMessageStatus(string? status)
    {
        return status switch
        {
            "sent" => "sent",
            "failed" => "failed",
            "queued" => "pending",
            "sending" => "pending", // "sending" is also shown as "pending" in UI
            _ => "pending"
        };
    }
}
