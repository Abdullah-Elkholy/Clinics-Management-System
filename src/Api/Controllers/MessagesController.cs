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
                
                // Validate moderatorId is valid (should never be 0)
                if (effectiveModeratorId <= 0)
                {
                    _logger.LogError("[MessagesController.Send] Invalid effectiveModeratorId: {ModeratorId} for userId: {UserId}", 
                        effectiveModeratorId, userId);
                    return BadRequest(new { success = false, error = "معرف المشرف غير صحيح" });
                }

                // Check if WhatsApp session is paused due to PendingQR
                var whatsappSessionCheck = await _db.WhatsAppSessions
                    .FirstOrDefaultAsync(w => w.ModeratorUserId == effectiveModeratorId && !w.IsDeleted);
                
                if (whatsappSessionCheck != null && whatsappSessionCheck.Status == "pending")
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

                    // Validate: Prevent sending messages to your own WhatsApp number
                    // Get moderator's WhatsApp phone number
                    var moderatorSettings = await _db.Set<ModeratorSettings>()
                        .FirstOrDefaultAsync(m => m.ModeratorUserId == effectiveModeratorId);
                    
                    if (moderatorSettings != null && !string.IsNullOrEmpty(moderatorSettings.WhatsAppPhoneNumber))
                    {
                        // Normalize phone numbers for comparison (remove all non-digit characters except +)
                        // This handles: spaces, dashes, parentheses, country codes with/without +
                        var normalizePhone = (string? phone) => 
                        {
                            if (string.IsNullOrEmpty(phone)) return null;
                            // Remove all non-digit characters, but keep digits
                            var digitsOnly = new string(phone.Where(char.IsDigit).ToArray());
                            return digitsOnly;
                        };
                        
                        var moderatorPhoneNormalized = normalizePhone(moderatorSettings.WhatsAppPhoneNumber);
                        
                        // Check if any patient's phone matches the moderator's WhatsApp phone
                        var ownNumberPatients = patients
                            .Where(p => 
                            {
                                if (string.IsNullOrEmpty(moderatorPhoneNormalized)) return false;
                                
                                var patientPhoneNormalized = normalizePhone(p.PhoneNumber);
                                var patientCountryCodeNormalized = normalizePhone(p.CountryCode);
                                
                                // Try different combinations:
                                // 1. Patient phone only (if moderator phone includes country code)
                                // 2. Patient phone with country code
                                // 3. Patient phone without country code (if moderator phone has country code)
                                var patientPhoneWithCountry = normalizePhone($"{p.CountryCode}{p.PhoneNumber}");
                                
                                // Compare normalized phone numbers
                                return patientPhoneNormalized == moderatorPhoneNormalized ||
                                       patientPhoneWithCountry == moderatorPhoneNormalized ||
                                       (moderatorPhoneNormalized.EndsWith(patientPhoneNormalized ?? "") && 
                                        patientPhoneNormalized?.Length >= 7) || // At least 7 digits match
                                       (patientPhoneNormalized?.EndsWith(moderatorPhoneNormalized) == true &&
                                        moderatorPhoneNormalized.Length >= 7); // At least 7 digits match
                            })
                            .ToList();
                        
                        if (ownNumberPatients.Any())
                        {
                            await transaction.RollbackAsync();
                            
                            var ownNumberDetails = ownNumberPatients.Select(p => new
                            {
                                patientId = p.Id,
                                name = p.FullName,
                                phone = p.PhoneNumber,
                                countryCode = p.CountryCode
                            }).ToList();
                            
                            _logger.LogWarning("User {UserId} (moderator {ModeratorId}) attempted to send messages to their own WhatsApp number. Moderator phone: {ModeratorPhone}, Patient phones: {PatientPhones}", 
                                userId, effectiveModeratorId, moderatorSettings.WhatsAppPhoneNumber, 
                                string.Join(", ", ownNumberPatients.Select(p => $"{p.CountryCode}{p.PhoneNumber}")));
                            
                            return BadRequest(new 
                            { 
                                success = false, 
                                error = "لا يمكن إرسال رسائل إلى رقم الواتساب الخاص بك. واتساب لا يدعم إرسال الرسائل إلى نفس الرقم.",
                                code = "SELF_MESSAGE_NOT_SUPPORTED",
                                message = "لا يمكن إرسال رسائل إلى رقم الواتساب الخاص بك. واتساب لا يدعم إرسال الرسائل إلى نفس الرقم.",
                                ownNumberPatients = ownNumberDetails
                            });
                        }
                    }

                    // Get queue for CurrentPosition
                    var queueId = patients.First().QueueId; // All patients should be from same queue
                    var queue = await _db.Queues.FindAsync(queueId);
                    if (queue == null)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { success = false, error = "Queue not found" });
                    }

                    // Get WhatsAppSession for moderator (for status check, not for session name)
                    // IMPORTANT: Always construct session name from effectiveModeratorId (from header/auth)
                    // This ensures the session name always matches the moderatorId from the JWT token
                    // Format: whatsapp-session-{moderatorId} (matches WhatsAppConfiguration.GetSessionDirectory)
                    var whatsappSession = await _db.WhatsAppSessions
                        .FirstOrDefaultAsync(w => w.ModeratorUserId == effectiveModeratorId && !w.IsDeleted);
                    
                    // ALWAYS use the constructed session name based on moderatorId from header/auth
                    // This is the source of truth - never rely on DB SessionName which might be stale/incorrect
                    var sessionName = $"whatsapp-session-{effectiveModeratorId}";
                    
                    // Log if DB session name doesn't match (indicates data inconsistency)
                    if (whatsappSession != null && !string.IsNullOrEmpty(whatsappSession.SessionName) && 
                        whatsappSession.SessionName != sessionName)
                    {
                        _logger.LogWarning("[MessagesController.Send] DB SessionName mismatch! DB has '{DbSessionName}', but using '{ExpectedSessionName}' for moderator {ModeratorId} (userId: {UserId}). DB value will be ignored.", 
                            whatsappSession.SessionName, sessionName, effectiveModeratorId, userId);
                    }
                    
                    // Truncate to 20 characters if needed (Channel field constraint: StringLength(20))
                    if (sessionName.Length > 20)
                    {
                        _logger.LogWarning("[MessagesController.Send] Session name '{SessionName}' exceeds 20 characters for moderator {ModeratorId}, truncating to '{Truncated}'", 
                            sessionName, effectiveModeratorId, sessionName.Substring(0, 20));
                        sessionName = sessionName.Substring(0, 20);
                    }
                    
                    _logger.LogInformation("[MessagesController.Send] Using session name '{SessionName}' for moderator {ModeratorId} (userId: {UserId})", 
                        sessionName, effectiveModeratorId, userId);

                    // Get all MessageConditions for this queue (for condition matching)
                    var conditions = await _db.Set<MessageCondition>()
                        .Where(c => c.QueueId == queueId && !c.IsDeleted)
                        .Include(c => c.Template)
                        .ToListAsync();

                    // Separate conditions by operator type
                    var valuedConditions = conditions
                        .Where(c => c.Operator == "EQUAL" || c.Operator == "GREATER" || 
                                   c.Operator == "LESS" || c.Operator == "RANGE")
                        .OrderBy(c => c.Id) // Order by ID if Priority doesn't exist
                        .ToList();
                    var defaultCondition = conditions.FirstOrDefault(c => c.Operator == "DEFAULT");
                    var unconditionedConditions = conditions
                        .Where(c => c.Operator == "UNCONDITIONED")
                        .OrderBy(c => c.Id) // Order by ID if Priority doesn't exist
                        .ToList();

                    // Create MessageSession for this batch (unified session per moderator)
                    var sessionId = Guid.NewGuid();
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
                        FailedMessages = 0,
                        OngoingMessages = patients.Count, // All messages start as queued
                        StartTime = creationTimestamp,
                        LastUpdated = creationTimestamp
                    };
                    _db.MessageSessions.Add(messageSession);
                    
                    var messages = new List<Message>();

                    foreach (var p in patients)
                    {
                        // Calculate CalculatedPosition (offset from CQP)
                        var calculatedPosition = p.Position - queue.CurrentPosition;

                        // Match condition based on CalculatedPosition
                        MessageTemplate? selectedTemplate = null;
                        string content;

                        // 1. Check valued conditions FIRST (EQUAL, GREATER, LESS, RANGE) - highest priority
                        foreach (var cond in valuedConditions)
                        {
                            bool matches = cond.Operator switch
                            {
                                "EQUAL" => calculatedPosition == cond.Value,
                                "GREATER" => calculatedPosition > cond.Value,
                                "LESS" => calculatedPosition < cond.Value,
                                "RANGE" => calculatedPosition >= cond.MinValue && 
                                           calculatedPosition <= cond.MaxValue,
                                _ => false
                            };
                            
                            if (matches && cond.Template != null)
                            {
                                selectedTemplate = cond.Template;
                                break; // First match wins
                            }
                        }

                        // 2. Fallback to DEFAULT if no valued condition matched
                        if (selectedTemplate == null && defaultCondition != null && defaultCondition.Template != null)
                        {
                            selectedTemplate = defaultCondition.Template;
                        }

                        // 3. Last resort: UNCONDITIONED (least priority - template with no condition)
                        if (selectedTemplate == null && unconditionedConditions.Any())
                        {
                            var firstUnconditioned = unconditionedConditions.First();
                            if (firstUnconditioned.Template != null)
                            {
                                selectedTemplate = firstUnconditioned.Template;
                            }
                        }

                        // Use selected template or fallback to provided template
                        var finalTemplate = selectedTemplate ?? template;
                        var templateContent = req.OverrideContent ?? finalTemplate.Content;
                        
                        // Replace template variables with actual values
                        // PN: Patient Name (FullName or Id if FullName is null)
                        var patientName = !string.IsNullOrEmpty(p.FullName) ? p.FullName : $"Patient ID: {p.Id}";
                        // PQP: Patient Queue Position (absolute position)
                        var patientQueuePosition = p.Position;
                        // CQP: Current Queue Position
                        var currentQueuePosition = queue.CurrentPosition;
                        // ETR: Estimated Time Remaining (calculated from offset * estimatedTimePerSession)
                        var estimatedTimePerSession = queue.EstimatedWaitMinutes > 0 ? queue.EstimatedWaitMinutes : 15; // Default 15 minutes if not set or invalid
                        var etrMinutes = calculatedPosition * estimatedTimePerSession;
                        var etrDisplay = FormatTimeDisplay(etrMinutes);
                        // DN: Doctor/Queue Name
                        var doctorName = queue.DoctorName ?? "غير محدد";
                        
                        content = templateContent
                            .Replace("{PN}", patientName)
                            .Replace("{PQP}", patientQueuePosition.ToString())
                            .Replace("{CQP}", currentQueuePosition.ToString())
                            .Replace("{ETR}", etrDisplay)
                            .Replace("{DN}", doctorName);

                        var msg = new Message
                        {
                            PatientId = p.Id,
                            TemplateId = finalTemplate.Id,
                            QueueId = p.QueueId,
                            SenderUserId = userId,
                            ModeratorId = effectiveModeratorId,  // Unified session per moderator
                            Channel = sessionName,  // WhatsApp session name
                            CountryCode = p.CountryCode ?? "+20",
                            PatientPhone = p.PhoneNumber,
                            Position = p.Position,
                            CalculatedPosition = calculatedPosition,
                            FullName = p.FullName,
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
                    return StatusCode(500, new { success = false, error = "حدث خطأ أثناء إضافة الرسائل إلى قائمة الانتظار", message = ex.Message });
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
            // IMPORTANT: Validate WhatsApp numbers before retrying
            // Do NOT reset Attempts - preserve the count for retry history
            var failed = await _db.FailedTasks.ToListAsync();
            var requeued = 0;
            var skipped = 0;
            var invalidPatients = new List<string>();
            
            foreach(var f in failed)
            {
                if (f.MessageId.HasValue)
                {
                    var msg = await _db.Messages
                        .Include(m => m.Queue)
                        .FirstOrDefaultAsync(m => m.Id == f.MessageId.Value);
                    
                    if (msg != null)
                    {
                        // CRITICAL: Validate WhatsApp number before retrying
                        if (msg.PatientId.HasValue)
                        {
                            var patient = await _db.Patients.FindAsync(msg.PatientId.Value);
                            
                            if (patient != null)
                            {
                                // Skip if IsValidWhatsAppNumber is null or false
                                if (!patient.IsValidWhatsAppNumber.HasValue || patient.IsValidWhatsAppNumber.Value == false)
                                {
                                    skipped++;
                                    invalidPatients.Add(patient.FullName ?? $"Patient ID: {patient.Id}");
                                    _logger.LogWarning("Skipped retry for message {MessageId} - Patient {PatientId} has unvalidated WhatsApp number", 
                                        msg.Id, patient.Id);
                                    continue;
                                }
                            }
                        }
                        
                        // Requeue the message
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
            
            if (skipped > 0)
            {
                return Ok(new 
                { 
                    success = true, 
                    requeued,
                    skipped,
                    message = $"تم إعادة إضافة {requeued} رسالة إلى قائمة الانتظار. تم تخطي {skipped} رسالة بسبب أرقام واتساب غير محققة.",
                    invalidPatients = invalidPatients.Take(5).ToList()
                });
            }
            
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
        /// Delete a message (soft delete)
        /// Sets IsDeleted = true, DeletedAt, DeletedBy, and UpdatedAt
        /// Status remains unchanged
        /// </summary>
        [HttpDelete("{id}")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin,moderator")]
        public async Task<IActionResult> DeleteMessage(long id)
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

                var message = await _db.Messages.FindAsync(id);
                
                if (message == null)
                    return NotFound(new { success = false, error = "Message not found" });

                if (message.IsDeleted)
                    return BadRequest(new { success = false, error = "Message is already deleted" });

                // Soft delete: Set IsDeleted, DeletedAt, DeletedBy, UpdatedAt
                // Status remains unchanged as per requirements
                message.IsDeleted = true;
                message.DeletedAt = DateTime.UtcNow;
                message.DeletedBy = userId;
                message.UpdatedAt = DateTime.UtcNow;

                await _db.SaveChangesAsync();
                return Ok(new { success = true, message = "Message deleted successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting message {MessageId}", id);
                return StatusCode(500, new { success = false, error = "Error deleting message" });
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

        /// <summary>
        /// Format time in minutes to Arabic display format (e.g., "2 ساعة و 30 دقيقة" or "45 دقيقة")
        /// </summary>
        private static string FormatTimeDisplay(int minutes)
        {
            var mins = Math.Max(0, minutes);
            var hours = mins / 60;
            var rem = mins % 60;
            
            if (hours == 0)
                return $"{rem} دقيقة";
            if (rem == 0)
                return $"{hours} ساعة";
            return $"{hours} ساعة و {rem} دقيقة";
        }
    }
}
