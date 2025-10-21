using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Clinics.Api.DTOs;
using Clinics.Infrastructure;

namespace Clinics.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SessionsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<SessionsController> _logger;

    public SessionsController(ApplicationDbContext context, ILogger<SessionsController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Get all ongoing message sending sessions
    /// </summary>
    [HttpGet("ongoing")]
    public async Task<IActionResult> GetOngoingSessions()
    {
        try
        {
            var sessions = await _context.MessageSessions
                .Include(s => s.Queue)
                .Where(s => s.Status == "active" || s.Status == "paused")
                .OrderByDescending(s => s.StartTime)
                .ToListAsync();

            var sessionDtos = new List<OngoingSessionDto>();

            foreach (var session in sessions)
            {
                // Get patients associated with this session's queue
                var patients = await _context.Patients
                    .Where(p => p.QueueId == session.QueueId)
                    .Select(p => new
                    {
                        p.Id,
                        p.FullName,
                        p.PhoneNumber,
                        MessageStatus = _context.Messages
                            .Where(m => m.PatientId == p.Id && m.QueueId == session.QueueId)
                            .OrderByDescending(m => m.CreatedAt)
                            .Select(m => m.Status)
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
                    Status = session.Status,
                    Patients = patients.Select(p => new SessionPatientDto
                    {
                        PatientId = p.Id,
                        Name = p.FullName,
                        Phone = p.PhoneNumber,
                        Status = MapMessageStatus(p.MessageStatus)
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
    /// Pause an ongoing session
    /// </summary>
    [HttpPost("{id}/pause")]
    public async Task<IActionResult> PauseSession(Guid id)
    {
        try
        {
            var session = await _context.MessageSessions.FindAsync(id);
            
            if (session == null)
            {
                return NotFound(new { success = false, error = "الجلسة غير موجودة" });
            }

            if (session.Status != "active")
            {
                return BadRequest(new { success = false, error = "لا يمكن إيقاف جلسة غير نشطة" });
            }

            session.Status = "paused";
            session.LastUpdated = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error pausing session {SessionId}", id);
            return StatusCode(500, new { success = false, error = "حدث خطأ أثناء إيقاف الجلسة" });
        }
    }

    /// <summary>
    /// Resume a paused session
    /// </summary>
    [HttpPost("{id}/resume")]
    public async Task<IActionResult> ResumeSession(Guid id)
    {
        try
        {
            var session = await _context.MessageSessions.FindAsync(id);
            
            if (session == null)
            {
                return NotFound(new { success = false, error = "الجلسة غير موجودة" });
            }

            if (session.Status != "paused")
            {
                return BadRequest(new { success = false, error = "لا يمكن استئناف جلسة غير متوقفة" });
            }

            session.Status = "active";
            session.LastUpdated = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return Ok(new { success = true });
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
            _ => "pending"
        };
    }
}
