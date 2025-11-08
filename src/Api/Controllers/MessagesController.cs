using Microsoft.AspNetCore.Mvc;
using Clinics.Infrastructure;
using Clinics.Domain;
using Clinics.Api.DTOs;
using Clinics.Api.Services;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Clinics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin,moderator,user")]
    public class MessagesController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly QuotaService _quotaService;
        private readonly ILogger<MessagesController> _logger;

        public MessagesController(
            ApplicationDbContext db, 
            QuotaService quotaService,
            ILogger<MessagesController> logger)
        {
            _db = db;
            _quotaService = quotaService;
            _logger = logger;
        }

        [HttpPost("send")]
        public async Task<IActionResult> Send([FromBody] SendMessageRequest req)
        {
            try
            {
                // Get current user ID
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
                {
                    return Unauthorized(new { success = false, error = "المستخدم غير مصرح له" });
                }

                // Check if user has sufficient quota
                var messageCount = req.PatientIds.Length;
                var hasQuota = await _quotaService.HasMessagesQuotaAsync(userId, messageCount);
                
                if (!hasQuota)
                {
                    _logger.LogWarning("User {UserId} attempted to send {Count} messages but has insufficient quota", 
                        userId, messageCount);
                    return BadRequest(new { success = false, error = "حصة الرسائل غير كافية", code = "QUOTA_EXCEEDED" });
                }

                var template = await _db.MessageTemplates.FindAsync(req.TemplateId);
                if (template == null)
                {
                    return BadRequest(new { success = false, errors = new[] { new { code = "TemplateNotFound", message = "القالب غير موجود" } } });
                }

                var patients = await _db.Patients
                    .Where(p => req.PatientIds.Contains(p.Id))
                    .ToListAsync();
                
                var messages = new List<Message>();

                foreach (var p in patients)
                {
                    var content = req.OverrideContent ?? template.Content;
                    var msg = new Message
                    {
                        PatientId = p.Id,
                        TemplateId = template.Id,
                        QueueId = p.QueueId,
                        SenderUserId = userId,
                        ModeratorId = template.ModeratorId,  // Set moderator from template (or get from context)
                        Channel = req.Channel ?? "whatsapp",
                        RecipientPhone = p.PhoneNumber,
                        Content = content,
                        Status = "queued",
                        Attempts = 0,  // Initialize attempts counter
                        CreatedAt = DateTime.UtcNow
                    };
                    messages.Add(msg);
                }

                if (messages.Count > 0)
                {
                    await _db.Messages.AddRangeAsync(messages);
                    await _db.SaveChangesAsync();

                    // Consume quota after successful queueing
                    await _quotaService.ConsumeMessagesQuotaAsync(userId, messages.Count);
                    
                    _logger.LogInformation("User {UserId} queued {Count} messages, consumed quota", 
                        userId, messages.Count);
                }

                return Ok(new { success = true, queued = messages.Count });
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogError(ex, "Quota operation failed for user");
                return BadRequest(new { success = false, error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending messages");
                return StatusCode(500, new { success = false, error = "حدث خطأ أثناء إرسال الرسائل" });
            }
        }

        // Retry processing for failed messages/tasks - frontend posts to /api/messages/retry
        [HttpPost("retry")]
        public async Task<IActionResult> RetryAll()
        {
            // Simple operation: requeue any failed tasks' messages
            // IMPORTANT: Do NOT reset Attempts - preserve the count for retry history
            var failed = await _db.FailedTasks.ToListAsync();
            var requeued = 0;
            foreach(var f in failed)
            {
                if (f.MessageId.HasValue)
                {
                    var msg = await _db.Messages.FindAsync(f.MessageId.Value);
                    if (msg != null)
                    {
                        msg.Status = "queued";
                        // DO NOT reset: msg.Attempts = 0;  // REMOVED - preserve attempts for history
                        msg.LastAttemptAt = DateTime.UtcNow;  // Update last attempt timestamp
                        _db.FailedTasks.Remove(f);
                        requeued++;
                    }
                }
            }
            await _db.SaveChangesAsync();
            return Ok(new { success = true, requeued });
        }
    }
}
