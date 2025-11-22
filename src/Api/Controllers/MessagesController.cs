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
                // Get current user ID with fallback claim types
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                    ?? User.FindFirst("sub")?.Value
                    ?? User.FindFirst("userId")?.Value;
                    
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

                // Wrap in transaction for atomicity
                await using var transaction = await _db.Database.BeginTransactionAsync();
                try
                {
                    // Unify datetime for this bulk operation
                    var creationTimestamp = DateTime.UtcNow;

                    var patients = await _db.Patients
                        .Where(p => req.PatientIds.Contains(p.Id))
                        .ToListAsync();
                    
                    // Validate IsValidWhatsAppNumber for all patients
                    var invalidPatients = patients.Where(p => !p.IsValidWhatsAppNumber.HasValue || p.IsValidWhatsAppNumber.Value == false).ToList();
                    if (invalidPatients.Any())
                    {
                        await transaction.RollbackAsync();
                        
                        var invalidDetails = invalidPatients.Select(p => new
                        {
                            patientId = p.Id,
                            name = p.FullName,
                            phone = p.PhoneNumber,
                            isValidWhatsAppNumber = p.IsValidWhatsAppNumber
                        }).ToList();
                        
                        _logger.LogWarning("User {UserId} attempted to send messages to {Count} patients with unvalidated WhatsApp numbers", 
                            userId, invalidPatients.Count);
                        
                        return BadRequest(new 
                        { 
                            success = false, 
                            error = "WhatsAppValidationRequired",
                            message = "بعض المرضى لديهم أرقام واتساب غير محققة. يرجى التحقق من الأرقام أولاً.",
                            invalidPatients = invalidDetails
                        });
                    }
                    
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
                            CreatedAt = creationTimestamp
                        };
                        messages.Add(msg);
                    }

                    if (messages.Count > 0)
                    {
                        await _db.Messages.AddRangeAsync(messages);
                        await _db.SaveChangesAsync();
                        await transaction.CommitAsync();

                        // NOTE: Quota is now consumed on successful send (in MessageProcessor), not on queueing
                        // This ensures quota is only consumed for messages that are actually sent
                        
                        _logger.LogInformation("User {UserId} queued {Count} messages (quota will be consumed on successful send)", 
                            userId, messages.Count);
                    }

                    return Ok(new { success = true, queued = messages.Count });
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    _logger.LogError(ex, "Error queueing messages");
                    throw;
                }
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
