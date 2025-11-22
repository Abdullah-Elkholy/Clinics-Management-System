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

                // Get effective moderator ID (unified WhatsApp session per moderator)
                var effectiveModeratorId = await _quotaService.GetEffectiveModeratorIdAsync(userId);

                // Check if WhatsApp session is paused due to PendingQR
                var whatsappSession = await _db.WhatsAppSessions
                    .FirstOrDefaultAsync(w => w.ModeratorUserId == effectiveModeratorId && !w.IsDeleted);
                
                if (whatsappSession != null && whatsappSession.Status == "pending")
                {
                    _logger.LogWarning("User {UserId} attempted to send messages but WhatsApp session requires authentication (PendingQR)", userId);
                    return BadRequest(new 
                    { 
                        success = false, 
                        error = "PendingQR",
                        code = "AUTHENTICATION_REQUIRED",
                        message = "جلسة الواتساب تحتاج إلى المصادقة. يرجى المصادقة أولاً قبل إرسال الرسائل."
                    });
                }

                // Check if there are any paused messages for this moderator (due to PendingQR)
                var hasPausedMessages = await _db.Messages
                    .AnyAsync(m => m.ModeratorId == effectiveModeratorId 
                        && m.IsPaused 
                        && m.PauseReason == "PendingQR"
                        && (m.Status == "queued" || m.Status == "sending"));
                
                if (hasPausedMessages)
                {
                    _logger.LogWarning("User {UserId} attempted to send messages but there are paused messages due to PendingQR", userId);
                    return BadRequest(new 
                    { 
                        success = false, 
                        error = "PendingQR",
                        code = "AUTHENTICATION_REQUIRED",
                        message = "هناك رسائل متوقفة بسبب الحاجة إلى المصادقة. يرجى المصادقة أولاً قبل إرسال رسائل جديدة."
                    });
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

                    // Create MessageSession for this batch (unified session per moderator)
                    var sessionId = Guid.NewGuid();
                    var queueId = patients.First().QueueId; // All patients should be from same queue
                    var messageSession = new MessageSession
                    {
                        Id = sessionId,
                        QueueId = queueId,
                        ModeratorId = effectiveModeratorId,
                        UserId = userId,
                        Status = "active",
                        IsPaused = false,
                        TotalMessages = patients.Count,
                        SentMessages = 0,
                        StartTime = creationTimestamp,
                        LastUpdated = creationTimestamp
                    };
                    _db.MessageSessions.Add(messageSession);
                    
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
                            ModeratorId = effectiveModeratorId,  // Unified session per moderator
                            Channel = req.Channel ?? "whatsapp",
                            RecipientPhone = p.PhoneNumber,
                            Content = content,
                            Status = "queued",
                            Attempts = 0,  // Initialize attempts counter
                            CreatedAt = creationTimestamp,
                            SessionId = sessionId.ToString(),  // Link to MessageSession
                            IsPaused = false
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
                        
                        _logger.LogInformation("User {UserId} queued {Count} messages in session {SessionId} (quota will be consumed on successful send)", 
                            userId, messages.Count, sessionId);
                    }

                    return Ok(new { success = true, queued = messages.Count, sessionId = sessionId.ToString() });
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    _logger.LogError(ex, "Error queueing messages");
                    return StatusCode(500, new { success = false, error = "حدث خطأ أثناء إضافة الرسائل إلى قائمة الانتظار", message = "حدث خطأ أثناء إضافة الرسائل إلى قائمة الانتظار." });
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
                        msg.IsPaused = false; // Resume paused messages on retry
                        msg.PausedAt = null;
                        msg.PauseReason = null;
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

        /// <summary>
        /// Pause a single message
        /// </summary>
        [HttpPost("{id}/pause")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin,moderator")]
        public async Task<IActionResult> PauseMessage(long id)
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
                var message = await _db.Messages.FindAsync(id);
                
                if (message == null)
                    return NotFound(new { success = false, error = "Message not found" });

                if (message.Status != "queued" && message.Status != "sending")
                    return BadRequest(new { success = false, error = "يمكن إيقاف الرسائل في حالة الانتظار أو الإرسال فقط", message = "يمكن إيقاف الرسائل في حالة الانتظار أو الإرسال فقط." });

                message.IsPaused = true;
                message.PausedAt = DateTime.UtcNow;
                message.PausedBy = userId;
                message.PauseReason = "UserPaused";
                
                // If status is "sending", reset to "queued" so it can be resumed
                if (message.Status == "sending")
                {
                    message.Status = "queued";
                }

                await _db.SaveChangesAsync();
                return Ok(new { success = true, message = "Message paused successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error pausing message {MessageId}", id);
                return StatusCode(500, new { success = false, error = "Error pausing message" });
            }
        }

        /// <summary>
        /// Resume a paused message
        /// </summary>
        [HttpPost("{id}/resume")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin,moderator")]
        public async Task<IActionResult> ResumeMessage(long id)
        {
            try
            {
                var message = await _db.Messages.FindAsync(id);
                
                if (message == null)
                    return NotFound(new { success = false, error = "Message not found" });

                if (!message.IsPaused)
                    return BadRequest(new { success = false, error = "Message is not paused" });

                message.IsPaused = false;
                message.PausedAt = null;
                message.PausedBy = null;
                message.PauseReason = null;

                await _db.SaveChangesAsync();
                return Ok(new { success = true, message = "Message resumed successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resuming message {MessageId}", id);
                return StatusCode(500, new { success = false, error = "Error resuming message" });
            }
        }

        /// <summary>
        /// Pause all messages for a session
        /// </summary>
        [HttpPost("session/{sessionId}/pause")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin,moderator")]
        public async Task<IActionResult> PauseSessionMessages(string sessionId)
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
                
                // Pause all messages in this session
                var messages = await _db.Messages
                    .Where(m => m.SessionId == sessionId && (m.Status == "queued" || m.Status == "sending") && !m.IsPaused)
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
                var session = await _db.MessageSessions
                    .FirstOrDefaultAsync(s => s.Id.ToString() == sessionId || s.Id == Guid.Parse(sessionId));
                
                if (session != null)
                {
                    session.IsPaused = true;
                    session.Status = "paused";
                    session.PausedAt = DateTime.UtcNow;
                    session.PausedBy = userId;
                    session.PauseReason = "UserPaused";
                    session.LastUpdated = DateTime.UtcNow;
                }

                await _db.SaveChangesAsync();
                return Ok(new { success = true, pausedCount = messages.Count });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error pausing session messages {SessionId}", sessionId);
                return StatusCode(500, new { success = false, error = "Error pausing session messages" });
            }
        }

        /// <summary>
        /// Resume all paused messages for a session
        /// </summary>
        [HttpPost("session/{sessionId}/resume")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin,moderator")]
        public async Task<IActionResult> ResumeSessionMessages(string sessionId)
        {
            try
            {
                // Resume all paused messages in this session
                var messages = await _db.Messages
                    .Where(m => m.SessionId == sessionId && m.IsPaused)
                    .ToListAsync();

                foreach (var msg in messages)
                {
                    msg.IsPaused = false;
                    msg.PausedAt = null;
                    msg.PausedBy = null;
                    msg.PauseReason = null;
                }

                // Also resume the session itself
                var session = await _db.MessageSessions
                    .FirstOrDefaultAsync(s => s.Id.ToString() == sessionId || s.Id == Guid.Parse(sessionId));
                
                if (session != null)
                {
                    session.IsPaused = false;
                    session.Status = "active";
                    session.PausedAt = null;
                    session.PausedBy = null;
                    session.PauseReason = null;
                    session.LastUpdated = DateTime.UtcNow;
                }

                await _db.SaveChangesAsync();
                return Ok(new { success = true, resumedCount = messages.Count });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resuming session messages {SessionId}", sessionId);
                return StatusCode(500, new { success = false, error = "Error resuming session messages" });
            }
        }

        /// <summary>
        /// Pause all messages for a moderator (unified WhatsApp session)
        /// </summary>
        [HttpPost("moderator/{moderatorId}/pause")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin,moderator")]
        public async Task<IActionResult> PauseAllModeratorMessages(int moderatorId)
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
                
                // Verify user has access to this moderator
                var isAdmin = User.IsInRole("primary_admin") || User.IsInRole("secondary_admin");
                if (!isAdmin)
                {
                    var effectiveModeratorId = await _quotaService.GetEffectiveModeratorIdAsync(userId);
                    if (effectiveModeratorId != moderatorId)
                    {
                        return Forbid();
                    }
                }

                // Pause all queued/sending messages for this moderator
                var messages = await _db.Messages
                    .Where(m => m.ModeratorId == moderatorId 
                        && (m.Status == "queued" || m.Status == "sending") 
                        && !m.IsPaused)
                    .ToListAsync();

                foreach (var msg in messages)
                {
                    msg.IsPaused = true;
                    msg.PausedAt = DateTime.UtcNow;
                    msg.PausedBy = userId;
                    msg.PauseReason = "ModeratorPaused";
                    if (msg.Status == "sending")
                    {
                        msg.Status = "queued";
                    }
                }

                // Also pause all active sessions for this moderator
                var sessions = await _db.MessageSessions
                    .Where(s => s.ModeratorId == moderatorId && s.Status == "active" && !s.IsPaused)
                    .ToListAsync();

                foreach (var session in sessions)
                {
                    session.IsPaused = true;
                    session.Status = "paused";
                    session.PausedAt = DateTime.UtcNow;
                    session.PausedBy = userId;
                    session.PauseReason = "UserPaused";
                    session.LastUpdated = DateTime.UtcNow;
                }

                await _db.SaveChangesAsync();
                return Ok(new { success = true, pausedMessages = messages.Count, pausedSessions = sessions.Count });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error pausing all moderator messages {ModeratorId}", moderatorId);
                return StatusCode(500, new { success = false, error = "Error pausing all messages" });
            }
        }

        /// <summary>
        /// Resume all paused messages for a moderator
        /// </summary>
        [HttpPost("moderator/{moderatorId}/resume")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin,moderator")]
        public async Task<IActionResult> ResumeAllModeratorMessages(int moderatorId)
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
                
                // Verify user has access to this moderator
                var isAdmin = User.IsInRole("primary_admin") || User.IsInRole("secondary_admin");
                if (!isAdmin)
                {
                    var effectiveModeratorId = await _quotaService.GetEffectiveModeratorIdAsync(userId);
                    if (effectiveModeratorId != moderatorId)
                    {
                        return Forbid();
                    }
                }

                // Resume all paused messages for this moderator
                var messages = await _db.Messages
                    .Where(m => m.ModeratorId == moderatorId && m.IsPaused)
                    .ToListAsync();

                foreach (var msg in messages)
                {
                    msg.IsPaused = false;
                    msg.PausedAt = null;
                    msg.PausedBy = null;
                    msg.PauseReason = null;
                }

                // Also resume all paused sessions for this moderator
                var sessions = await _db.MessageSessions
                    .Where(s => s.ModeratorId == moderatorId && s.IsPaused)
                    .ToListAsync();

                foreach (var session in sessions)
                {
                    session.IsPaused = false;
                    session.Status = "active";
                    session.PausedAt = null;
                    session.PausedBy = null;
                    session.PauseReason = null;
                    session.LastUpdated = DateTime.UtcNow;
                }

                await _db.SaveChangesAsync();
                return Ok(new { success = true, resumedMessages = messages.Count, resumedSessions = sessions.Count });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resuming all moderator messages {ModeratorId}", moderatorId);
                return StatusCode(500, new { success = false, error = "Error resuming all messages" });
            }
        }
    }
}
