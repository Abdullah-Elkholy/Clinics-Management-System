using Microsoft.AspNetCore.Mvc;
using Clinics.Infrastructure;
using Clinics.Infrastructure.Services;
using Clinics.Domain;
using Clinics.Api.DTOs;
using Clinics.Api.Services;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Microsoft.AspNetCore.SignalR;
using Clinics.Api.Hubs;

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
        private readonly IContentVariableResolver _variableResolver;
        private readonly IdempotencyService _idempotencyService;
        private readonly IHubContext<DataUpdateHub> _hubContext;

        public MessagesController(
            ApplicationDbContext db,
            QuotaService quotaService,
            ILogger<MessagesController> logger,
            IContentVariableResolver variableResolver,
            IdempotencyService idempotencyService,
            IHubContext<DataUpdateHub> hubContext)
        {
            _db = db;
            _quotaService = quotaService;
            _logger = logger;
            _variableResolver = variableResolver;
            _idempotencyService = idempotencyService;
            _hubContext = hubContext;
        }

        [HttpPost("send")]
        public async Task<IActionResult> Send([FromBody] SendMessageRequest req)
        {
            // Generate or use provided correlation ID for request tracking and idempotency
            var correlationId = req.CorrelationId ?? Guid.NewGuid();

            // Check idempotency - if this request was already processed, return cached response
            if (_idempotencyService.TryGetCachedResponse(correlationId, out var cachedResponse))
            {
                _logger.LogInformation("Returning cached response for correlation ID {CorrelationId}", correlationId);
                return Ok(cachedResponse);
            }

            // Get current user ID with fallback claim types (declared outside try block for catch block access)
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value
                ?? User.FindFirst("userId")?.Value;

            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized(new { success = false, error = "المستخدم غير مصرح له" });
            }

            _logger.LogInformation("Processing send request with correlation ID {CorrelationId} for user {UserId}",
                correlationId, userId);

            try
            {

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
                // Admins must provide moderatorId in request, moderators/users use their own
                int effectiveModeratorId;
                var userRole = User.FindFirst(ClaimTypes.Role)?.Value ?? User.FindFirst("role")?.Value;
                bool isAdmin = userRole == "primary_admin" || userRole == "secondary_admin";

                if (isAdmin)
                {
                    // Admins must provide moderatorId - they don't have their own WhatsApp session
                    if (!req.ModeratorId.HasValue || req.ModeratorId.Value <= 0)
                    {
                        _logger.LogWarning("[MessagesController.Send] Admin user {UserId} attempted to send messages without specifying moderatorId", userId);
                        return BadRequest(new
                        {
                            success = false,
                            error = "الأدمن يجب أن يحدد المشرف المسؤول عن جلسة الواتساب",
                            code = "MODERATOR_ID_REQUIRED"
                        });
                    }
                    effectiveModeratorId = req.ModeratorId.Value;
                    _logger.LogInformation("[MessagesController.Send] Admin {UserId} sending messages using moderator {ModeratorId} session",
                        userId, effectiveModeratorId);
                }
                else
                {
                    // Moderators and users use their effective moderator ID
                    effectiveModeratorId = await _quotaService.GetEffectiveModeratorIdAsync(userId);
                }

                // Validate moderatorId is valid (should never be 0)
                if (effectiveModeratorId <= 0)
                {
                    _logger.LogError("[MessagesController.Send] Invalid effectiveModeratorId: {ModeratorId} for userId: {UserId}",
                        effectiveModeratorId, userId);
                    return BadRequest(new { success = false, error = "معرف المشرف غير صحيح" });
                }

                // Check if WhatsApp session is paused globally (due to PendingQR, PendingNET, or BrowserClosure)
                var whatsappSessionCheck = await _db.WhatsAppSessions
                    .FirstOrDefaultAsync(w => w.ModeratorUserId == effectiveModeratorId && !w.IsDeleted);

                // Track if session is user-paused (manual pause) - messages will be created but paused
                bool isUserPaused = false;
                string? userPauseReason = null;

                if (whatsappSessionCheck != null && whatsappSessionCheck.IsPaused)
                {
                    // CRITICAL FIX: Check if there are any active messages/sessions - if not, auto-unpause
                    // This prevents stale pause state from blocking new message sends when all tasks are already cleared
                    var hasActiveMessages = await _db.Messages
                        .AnyAsync(m => m.ModeratorId == effectiveModeratorId
                            && (m.Status == "queued" || m.Status == "sending")
                            && !m.IsDeleted);

                    var hasActiveSessions = await _db.MessageSessions
                        .AnyAsync(s => s.ModeratorId == effectiveModeratorId
                            && (s.Status == "active" || s.Status == "paused")
                            && !s.IsDeleted);

                    if (!hasActiveMessages && !hasActiveSessions)
                    {
                        // CRITICAL: Before auto-unpausing, verify session status is "connected"
                        // Only auto-unpause if session is ready to send messages
                        if (whatsappSessionCheck.Status != "connected")
                        {
                            _logger.LogWarning("Cannot auto-unpause moderator {ModeratorId}: Session status is '{Status}', must be 'connected'",
                                effectiveModeratorId, whatsappSessionCheck.Status);
                            return BadRequest(new
                            {
                                success = false,
                                error = "SessionNotConnected",
                                code = "SESSION_NOT_CONNECTED",
                                message = $"لا يمكن إرسال الرسائل: جلسة الواتساب غير متصلة (الحالة: {whatsappSessionCheck.Status}). يرجى التأكد من الاتصال أولاً.",
                                warning = true
                            });
                        }

                        // No active tasks AND session is connected - auto-unpause to allow new messages
                        _logger.LogInformation("Auto-unpausing WhatsApp session for moderator {ModeratorId} - no active tasks and status is connected",
                            effectiveModeratorId);

                        whatsappSessionCheck.IsPaused = false;
                        whatsappSessionCheck.PausedAt = null;
                        whatsappSessionCheck.PausedBy = null;
                        whatsappSessionCheck.PauseReason = null;
                        whatsappSessionCheck.UpdatedAt = DateTime.UtcNow;
                        whatsappSessionCheck.UpdatedBy = userId;

                        await _db.SaveChangesAsync();

                        // Continue with message sending (don't return error)
                    }
                    else
                    {
                        // Active tasks exist - check pause reason
                        // ONLY block for SYSTEM pauses (PendingQR, PendingNET, BrowserClosure)
                        // User manual pauses ("User paused") should ALLOW message creation (they just won't be sent until resumed)
                        string? errorCode = null;
                        string? code = null;
                        string? errorMessage = null;

                        if (whatsappSessionCheck.PauseReason?.Contains("PendingQR") == true)
                        {
                            errorCode = "PendingQR";
                            code = "AUTHENTICATION_REQUIRED";
                            errorMessage = "جلسة الواتساب تحتاج إلى المصادقة. يرجى المصادقة أولاً قبل إرسال الرسائل.";
                        }
                        else if (whatsappSessionCheck.PauseReason?.Contains("PendingNET") == true)
                        {
                            errorCode = "PendingNET";
                            code = "NETWORK_FAILURE";
                            errorMessage = "فشل الاتصال بالإنترنت. تم إيقاف جميع المهام الجارية. يرجى التحقق من الاتصال والمحاولة مرة أخرى.";
                        }
                        else if (whatsappSessionCheck.PauseReason?.Contains("BrowserClosure") == true)
                        {
                            errorCode = "BrowserClosure";
                            code = "BROWSER_CLOSED";
                            errorMessage = "تم إغلاق المتصفح. تم إيقاف جميع المهام الجارية. يرجى إعادة فتح المتصفح والمحاولة مرة أخرى.";
                        }
                        // NOTE: "User paused" (manual pause) is NOT blocked - messages can be created
                        // The hierarchical pause check in FilterPausedMessagesAsync will prevent processing
                        // by checking MessageSession.IsPaused - no need to update individual message rows

                        // Only block for system-initiated pauses (PendingQR, PendingNET, BrowserClosure)
                        if (errorCode != null)
                        {
                            _logger.LogWarning("User {UserId} attempted to send messages but WhatsApp session is paused: {PauseReason}. Active messages: {ActiveMessages}, Active sessions: {ActiveSessions}",
                                userId, whatsappSessionCheck.PauseReason, hasActiveMessages, hasActiveSessions);
                            return BadRequest(new
                            {
                                success = false,
                                error = errorCode,
                                code = code,
                                message = errorMessage,
                                warning = true
                            });
                        }

                        // User manual pause - allow message creation
                        // MessageSession.IsPaused will be checked hierarchically by FilterPausedMessagesAsync
                        _logger.LogInformation("User {UserId} creating messages while session is user-paused. Messages will be queued and hierarchically paused (not sent until session resumed). PauseReason: {PauseReason}",
                            userId, whatsappSessionCheck.PauseReason);
                    }
                }

                // Also check if WhatsApp session status is "pending" (legacy check for PendingQR)
                if (whatsappSessionCheck != null && whatsappSessionCheck.Status == "pending")
                {
                    _logger.LogWarning("User {UserId} attempted to send messages but WhatsApp session requires authentication (PendingQR)", userId);
                    return BadRequest(new
                    {
                        success = false,
                        error = "PendingQR",
                        code = "AUTHENTICATION_REQUIRED",
                        message = "جلسة الواتساب تحتاج إلى المصادقة. يرجى المصادقة أولاً قبل إرسال الرسائل.",
                        warning = true
                    });
                }

                // Check if there are any paused messages for this moderator (due to PendingQR/PendingNET/BrowserClosure)
                var hasPausedMessages = await _db.Messages
                    .AnyAsync(m => m.ModeratorId == effectiveModeratorId
                        && !m.IsDeleted
                        && m.IsPaused
                        && (m.PauseReason == "PendingQR" || m.PauseReason == "PendingNET" || m.PauseReason == "BrowserClosure")
                        && (m.Status == "queued" || m.Status == "sending"));

                if (hasPausedMessages)
                {
                    // Get the most common pause reason from paused messages
                    var pauseReasons = await _db.Messages
                        .Where(m => m.ModeratorId == effectiveModeratorId
                            && !m.IsDeleted
                            && m.IsPaused
                            && (m.PauseReason == "PendingQR" || m.PauseReason == "PendingNET" || m.PauseReason == "BrowserClosure")
                            && (m.Status == "queued" || m.Status == "sending"))
                        .GroupBy(m => m.PauseReason)
                        .Select(g => new { Reason = g.Key, Count = g.Count() })
                        .OrderByDescending(x => x.Count)
                        .FirstOrDefaultAsync();

                    string errorCode;
                    string code;
                    string errorMessage;

                    if (pauseReasons?.Reason == "PendingQR")
                    {
                        errorCode = "PendingQR";
                        code = "AUTHENTICATION_REQUIRED";
                        errorMessage = "هناك رسائل متوقفة بسبب الحاجة إلى المصادقة. يرجى المصادقة أولاً قبل إرسال رسائل جديدة.";
                    }
                    else if (pauseReasons?.Reason == "PendingNET")
                    {
                        errorCode = "PendingNET";
                        code = "NETWORK_FAILURE";
                        errorMessage = "هناك رسائل متوقفة بسبب فشل الاتصال بالإنترنت. يرجى التحقق من الاتصال والمحاولة مرة أخرى.";
                    }
                    else if (pauseReasons?.Reason == "BrowserClosure")
                    {
                        errorCode = "BrowserClosure";
                        code = "BROWSER_CLOSED";
                        errorMessage = "هناك رسائل متوقفة بسبب إغلاق المتصفح. يرجى إعادة فتح المتصفح والمحاولة مرة أخرى.";
                    }
                    else
                    {
                        errorCode = "MessagesPaused";
                        code = "MESSAGES_PAUSED";
                        errorMessage = "هناك رسائل متوقفة. يرجى استئناف الرسائل أولاً قبل إرسال رسائل جديدة.";
                    }

                    _logger.LogWarning("User {UserId} attempted to send messages but there are paused messages due to {PauseReason}",
                        userId, pauseReasons?.Reason ?? "unknown");
                    return BadRequest(new
                    {
                        success = false,
                        error = errorCode,
                        code = code,
                        message = errorMessage,
                        warning = true
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

                    // Self-messaging validation REMOVED - ModeratorSettings entity deprecated
                    // WhatsApp handles self-messaging prevention internally

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
                    // This is the source of truth - DB SessionName column was deprecated and removed
                    var sessionName = $"whatsapp-session-{effectiveModeratorId}";

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
                        // Status remains "active" - hierarchical check will look at WhatsAppSession.IsPaused if needed
                        Status = "active",
                        IsPaused = false, // MessageSession-level pause is only set via /pause endpoint
                        TotalMessages = patients.Count,
                        SentMessages = 0,
                        FailedMessages = 0,
                        OngoingMessages = patients.Count, // All messages start as queued
                        StartTime = creationTimestamp,
                        LastUpdated = creationTimestamp,
                        CorrelationId = correlationId // Link session to request correlation ID
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

                        // Resolve template variables using centralized service
                        content = _variableResolver.ResolveVariables(
                            templateContent,
                            p,
                            queue,
                            calculatedPosition
                        );

                        var msg = new Message
                        {
                            PatientId = p.Id,
                            TemplateId = finalTemplate.Id,
                            QueueId = p.QueueId,
                            SenderUserId = userId,
                            ModeratorId = effectiveModeratorId,  // Unified session per moderator
                            // Channel property REMOVED - deprecated column (always "whatsapp")
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
                            CorrelationId = correlationId,  // Propagate correlation ID for distributed tracing
                            // No IsPaused flag - hierarchical check in FilterPausedMessagesAsync checks MessageSession.IsPaused
                        };
                        messages.Add(msg);
                    }

                    if (messages.Count > 0)
                    {
                        // GAP FIX 3.2: Validate TotalMessages consistency
                        // Ensure MessageSession.TotalMessages matches actual created message count
                        if (messageSession.TotalMessages != messages.Count)
                        {
                            _logger.LogWarning(
                                "TotalMessages mismatch in session {SessionId}: Expected {Expected}, got {Actual}. Correcting to actual count.",
                                sessionId, messageSession.TotalMessages, messages.Count);

                            // Correct the TotalMessages to match reality
                            messageSession.TotalMessages = messages.Count;
                            messageSession.OngoingMessages = messages.Count;
                        }

                        await _db.Messages.AddRangeAsync(messages);
                        await _db.SaveChangesAsync();
                        await transaction.CommitAsync();

                        // NOTE: Quota is now consumed on successful send (in MessageProcessor), not on queueing
                        // This ensures quota is only consumed for messages that are actually sent

                        _logger.LogInformation("User {UserId} queued {Count} messages in session {SessionId} with correlation ID {CorrelationId}. If session is paused, messages won't be sent until resumed (quota consumed on send only)",
                            userId, messages.Count, sessionId, correlationId);

                        // Cache response for idempotency
                        var response = new SendMessageResponse
                        {
                            Success = true,
                            Queued = messages.Count,
                            SessionId = sessionId.ToString(),
                            CorrelationId = correlationId
                        };
                        _idempotencyService.CacheResponse(correlationId, response);

                        return Ok(response);
                    }

                    var emptyResponse = new SendMessageResponse
                    {
                        Success = true,
                        Queued = 0,
                        SessionId = sessionId.ToString(),
                        CorrelationId = correlationId
                    };
                    _idempotencyService.CacheResponse(correlationId, emptyResponse);
                    return Ok(emptyResponse);
                }
                catch (Exception ex)
                {
                    await transaction.RollbackAsync();
                    _logger.LogError(ex, "Error queueing messages");
                    return StatusCode(500, new { success = false, error = "حدث خطأ أثناء إضافة الرسائل إلى قائمة الانتظار", message = ex.Message });
                }
            }
            catch (InvalidOperationException ex) when (
                ex.Message.StartsWith("PendingQR:", StringComparison.OrdinalIgnoreCase) ||
                ex.Message.StartsWith("PendingNET:", StringComparison.OrdinalIgnoreCase) ||
                ex.Message.StartsWith("BrowserClosure:", StringComparison.OrdinalIgnoreCase))
            {
                // PendingQR, PendingNET, or BrowserClosure detected during message queueing
                // These errors are caught from WhatsAppServiceSender when checking session status
                string errorCode;
                string errorMessage;
                string code;

                if (ex.Message.StartsWith("PendingQR:", StringComparison.OrdinalIgnoreCase))
                {
                    errorCode = "PendingQR";
                    code = "AUTHENTICATION_REQUIRED";
                    errorMessage = ex.Message.Replace("PendingQR: ", "") ?? "جلسة الواتساب تحتاج إلى المصادقة. يرجى المصادقة أولاً قبل إرسال الرسائل.";
                }
                else if (ex.Message.StartsWith("PendingNET:", StringComparison.OrdinalIgnoreCase))
                {
                    errorCode = "PendingNET";
                    code = "NETWORK_FAILURE";
                    errorMessage = ex.Message.Replace("PendingNET: ", "") ?? "فشل الاتصال بالإنترنت. تم إيقاف جميع المهام الجارية.";
                }
                else // BrowserClosure
                {
                    errorCode = "BrowserClosure";
                    code = "BROWSER_CLOSED";
                    errorMessage = ex.Message.Replace("BrowserClosure: ", "") ?? "تم إغلاق المتصفح. تم إيقاف جميع المهام الجارية.";
                }

                _logger.LogWarning("Message queueing blocked due to {ErrorCode} for user {UserId}: {Message}",
                    errorCode, userId, errorMessage);

                return BadRequest(new
                {
                    success = false,
                    error = errorCode,
                    code = code,
                    message = errorMessage,
                    warning = true
                });
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
            // FailedTasks table removed - now query Messages with Status = 'failed' directly
            var failedMessages = await _db.Messages
                .Where(m => m.Status == "failed" && !m.IsDeleted)
                .ToListAsync();

            var requeued = 0;
            var skipped = 0;
            var invalidPatients = new List<string>();
            var updatedMessages = new List<(Guid messageId, int moderatorId)>();

            foreach (var msg in failedMessages)
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
                // FailedTasks removal REMOVED - table no longer exists
                requeued++;

                if (msg.ModeratorId.HasValue)
                {
                    updatedMessages.Add((msg.Id, msg.ModeratorId.Value));
                }
            }

            await _db.SaveChangesAsync();

            // Broadcast MessageUpdated events via SignalR for each retried message
            foreach (var (messageId, moderatorId) in updatedMessages)
            {
                await _hubContext.Clients
                    .Group($"moderator-{moderatorId}")
                    .SendAsync("MessageUpdated", new { messageId, isPaused = false, status = "queued" });
            }

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
        /// Retry a single message by its ID
        /// </summary>
        [HttpPost("{id}/retry")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin,moderator")]
        public async Task<IActionResult> RetryMessage(Guid id)
        {
            try
            {
                var message = await _db.Messages
                    .Include(m => m.Queue)
                    .FirstOrDefaultAsync(m => m.Id == id);

                if (message == null)
                    return NotFound(new { success = false, error = "Message not found" });

                // CRITICAL: Validate WhatsApp number before retrying
                if (message.PatientId.HasValue)
                {
                    var patient = await _db.Patients.FindAsync(message.PatientId.Value);

                    if (patient != null && (!patient.IsValidWhatsAppNumber.HasValue || patient.IsValidWhatsAppNumber.Value == false))
                    {
                        _logger.LogWarning("Retry rejected for message {MessageId} - Patient {PatientId} has unvalidated WhatsApp number",
                            id, patient.Id);

                        return BadRequest(new
                        {
                            success = false,
                            error = "WhatsAppValidationRequired",
                            message = "رقم الواتساب للمريض غير محقق. يجب التحقق من رقم الواتساب أولاً."
                        });
                    }
                }

                // Requeue the message
                message.Status = "queued";
                message.IsPaused = false;
                message.PausedAt = null;
                message.PauseReason = null;
                message.LastAttemptAt = DateTime.UtcNow;

                await _db.SaveChangesAsync();

                // Broadcast MessageUpdated event via SignalR
                var moderatorId = message.ModeratorId ?? 0;
                if (moderatorId > 0)
                {
                    await _hubContext.Clients
                        .Group($"moderator-{moderatorId}")
                        .SendAsync("MessageUpdated", new { messageId = message.Id, isPaused = false, status = "queued" });
                }

                return Ok(new { success = true, status = message.Status, attempts = message.Attempts });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrying message {MessageId}", id);
                return StatusCode(500, new { success = false, error = "Error retrying message" });
            }
        }

        /// <summary>
        /// Pause a single message
        /// </summary>
        [HttpPost("{id}/pause")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin,moderator")]
        public async Task<IActionResult> PauseMessage(Guid id)
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

                // Broadcast MessageUpdated event via SignalR
                var moderatorId = message.ModeratorId ?? 0;
                if (moderatorId > 0)
                {
                    await _hubContext.Clients
                        .Group($"moderator-{moderatorId}")
                        .SendAsync("MessageUpdated", new { messageId = message.Id, isPaused = true, status = message.Status });
                }

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
        public async Task<IActionResult> ResumeMessage(Guid id)
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

                // CRITICAL FIX: Reset status to "queued" if it's stuck in "sending"
                // This ensures the MessageProcessor will pick it up again
                // When a message is paused during sending, it should be retryable on resume
                if (message.Status == "sending")
                {
                    message.Status = "queued";
                }

                await _db.SaveChangesAsync();

                // Broadcast MessageUpdated event via SignalR
                var moderatorId = message.ModeratorId ?? 0;
                if (moderatorId > 0)
                {
                    await _hubContext.Clients
                        .Group($"moderator-{moderatorId}")
                        .SendAsync("MessageUpdated", new { messageId = message.Id, isPaused = false, status = message.Status });
                }

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
        public async Task<IActionResult> DeleteMessage(Guid id)
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

                // Broadcast MessageDeleted event via SignalR
                var moderatorId = message.ModeratorId ?? 0;
                if (moderatorId > 0)
                {
                    await _hubContext.Clients
                        .Group($"moderator-{moderatorId}")
                        .SendAsync("MessageDeleted", new { messageId = message.Id, isDeleted = true });
                }

                return Ok(new { success = true, message = "Message deleted successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting message {MessageId}", id);
                return StatusCode(500, new { success = false, error = "Error deleting message" });
            }
        }

        /// <summary>
        /// Pause all messages for a session (uses hierarchical pause - session level only)
        /// Per 3-tier hierarchy: WhatsAppSession > MessageSession > Message
        /// This only sets MessageSession.IsPaused = true, no cascade to individual messages.
        /// </summary>
        [HttpPost("session/{sessionId}/pause")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin,moderator")]
        public async Task<IActionResult> PauseSessionMessages(string sessionId)
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");

                // Parse session ID
                if (!Guid.TryParse(sessionId, out var sessionGuid))
                {
                    return BadRequest(new { success = false, error = "Invalid session ID" });
                }

                // Pause the session itself (hierarchical pause - no cascade to messages)
                var session = await _db.MessageSessions.FindAsync(sessionGuid);

                if (session == null)
                {
                    return NotFound(new { success = false, error = "Session not found" });
                }

                // Set session-level pause (MessageProcessor will check this at query time)
                session.IsPaused = true;
                session.Status = "paused";
                session.PausedAt = DateTime.UtcNow;
                session.PausedBy = userId;
                session.PauseReason = "UserPaused";
                session.LastUpdated = DateTime.UtcNow;

                // Count affected messages (for UI feedback - no database changes to messages)
                var affectedMessageCount = await _db.Messages
                    .Where(m => m.SessionId == sessionId
                        && (m.Status == "queued" || m.Status == "sending")
                        && !m.IsPaused
                        && !m.IsDeleted)
                    .CountAsync();

                // Update OngoingMessages counter
                session.OngoingMessages = 0; // All messages in this session are now paused via hierarchy

                _logger.LogInformation("Session {SessionId} paused via hierarchy. {AffectedCount} messages paused at query time.",
                    sessionId, affectedMessageCount);

                await _db.SaveChangesAsync();

                // Broadcast SessionUpdated event via SignalR (single event for session pause)
                var moderatorId = session.ModeratorId;
                if (moderatorId > 0)
                {
                    await _hubContext.Clients
                        .Group($"moderator-{moderatorId}")
                        .SendAsync("SessionUpdated", new { sessionId = sessionGuid, isPaused = true, status = "paused" });
                }

                return Ok(new { success = true, pausedCount = affectedMessageCount });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error pausing session messages {SessionId}", sessionId);
                return StatusCode(500, new { success = false, error = "Error pausing session messages" });
            }
        }

        /// <summary>
        /// Resume all paused messages for a session (uses hierarchical resume - session level only)
        /// Per 3-tier hierarchy: WhatsAppSession > MessageSession > Message
        /// This only sets MessageSession.IsPaused = false.
        /// Messages will automatically become processable unless individually paused.
        /// </summary>
        [HttpPost("session/{sessionId}/resume")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin,moderator")]
        public async Task<IActionResult> ResumeSessionMessages(string sessionId)
        {
            try
            {
                // Parse session ID
                if (!Guid.TryParse(sessionId, out var sessionGuid))
                {
                    return BadRequest(new { success = false, error = "Invalid session ID" });
                }

                // Resume the session itself (hierarchical resume - no cascade to messages)
                var session = await _db.MessageSessions.FindAsync(sessionGuid);

                if (session == null)
                {
                    return NotFound(new { success = false, error = "Session not found" });
                }

                // Clear session-level pause
                session.IsPaused = false;
                session.Status = "active";
                session.PausedAt = null;
                session.PausedBy = null;
                session.PauseReason = null;
                session.LastUpdated = DateTime.UtcNow;

                // Count messages that will become processable (not individually paused)
                var resumedMessageCount = await _db.Messages
                    .Where(m => m.SessionId == sessionId
                        && (m.Status == "queued" || m.Status == "sending")
                        && !m.IsPaused  // Only count messages not individually paused
                        && !m.IsDeleted)
                    .CountAsync();

                // Update OngoingMessages counter
                session.OngoingMessages = resumedMessageCount;

                _logger.LogInformation("Session {SessionId} resumed via hierarchy. {ResumedCount} messages now processable.",
                    sessionId, resumedMessageCount);

                await _db.SaveChangesAsync();

                // Broadcast SessionUpdated event via SignalR
                var moderatorId = session.ModeratorId;
                if (moderatorId > 0)
                {
                    await _hubContext.Clients
                        .Group($"moderator-{moderatorId}")
                        .SendAsync("SessionUpdated", new { sessionId = sessionGuid, isPaused = false, status = "active" });
                }

                return Ok(new { success = true, resumedCount = resumedMessageCount });
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

                // Broadcast MessageUpdated events via SignalR for each paused message
                if (messages.Any())
                {
                    foreach (var msg in messages)
                    {
                        await _hubContext.Clients
                            .Group($"moderator-{moderatorId}")
                            .SendAsync("MessageUpdated", new { messageId = msg.Id, isPaused = true, status = msg.Status });
                    }
                }

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

                    // CRITICAL FIX: Reset status to "queued" if stuck in "sending"
                    // This ensures MessageProcessor will pick up these messages again
                    if (msg.Status == "sending")
                    {
                        msg.Status = "queued";
                    }
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

                // Broadcast MessageUpdated events via SignalR for each resumed message
                if (messages.Any())
                {
                    foreach (var msg in messages)
                    {
                        await _hubContext.Clients
                            .Group($"moderator-{moderatorId}")
                            .SendAsync("MessageUpdated", new { messageId = msg.Id, isPaused = false, status = msg.Status });
                    }
                }

                return Ok(new { success = true, resumedMessages = messages.Count, resumedSessions = sessions.Count });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resuming all moderator messages {ModeratorId}", moderatorId);
                return StatusCode(500, new { success = false, error = "Error resuming all messages" });
            }
        }

        /// <summary>
        /// Preview retry operation for a session - shows which messages can be retried vs skipped
        /// </summary>
        [HttpPost("sessions/{sessionId}/retry-preview")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin,moderator,user")]
        public async Task<IActionResult> RetryPreview(Guid sessionId)
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");

                // Get all failed messages for this session
                var failedMessages = await _db.Messages
                    .Where(m => m.SessionId == sessionId.ToString() && m.Status == "failed")
                    .Select(m => new { m.Id, m.PatientId, m.ErrorMessage })
                    .ToListAsync();

                if (!failedMessages.Any())
                {
                    return Ok(new
                    {
                        success = true,
                        retryable = new { count = 0, reasons = new List<object>() },
                        nonRetryable = new { count = 0, reasons = new List<object>() },
                        requiresAction = new { count = 0, reasons = new List<object>() }
                    });
                }

                // Get error messages from Message.ErrorMessage (FailedTasks table removed)
                var messageIds = failedMessages.Select(m => m.Id).ToList();
                var failedReasons = failedMessages
                    .ToDictionary(m => m.Id, m => m.ErrorMessage ?? "Unknown");

                // Get patients for deleted check
                var patientIds = failedMessages.Where(m => m.PatientId.HasValue).Select(m => m.PatientId!.Value).Distinct().ToList();
                var deletedPatients = await _db.Patients
                    .Where(p => patientIds.Contains(p.Id) && (p.IsDeleted || p.IsValidWhatsAppNumber == false))
                    .Select(p => p.Id)
                    .ToListAsync();
                var deletedPatientIds = new HashSet<int>(deletedPatients);

                // Classify messages based on failure reason
                var retryable = new List<(Guid msgId, string reason)>();
                var nonRetryable = new List<(Guid msgId, string reason)>();
                var requiresAction = new List<(Guid msgId, string reason)>();

                foreach (var msg in failedMessages)
                {
                    string failureReason = failedReasons.TryGetValue(msg.Id, out var reason) ? reason : "Unknown";

                    // Check if patient is deleted or invalid
                    var patientIssue = msg.PatientId.HasValue && deletedPatientIds.Contains(msg.PatientId.Value);

                    // Retryable: Temporary failures
                    if (!patientIssue && (
                        failureReason.Contains("timeout", StringComparison.OrdinalIgnoreCase) ||
                        failureReason.Contains("network", StringComparison.OrdinalIgnoreCase) ||
                        failureReason.Contains("rate limit", StringComparison.OrdinalIgnoreCase) ||
                        failureReason.Contains("QR", StringComparison.OrdinalIgnoreCase) ||
                        failureReason.Contains("connection", StringComparison.OrdinalIgnoreCase) ||
                        failureReason.Contains("مهلة", StringComparison.OrdinalIgnoreCase) ||
                        failureReason.Contains("شبكة", StringComparison.OrdinalIgnoreCase) ||
                        failureReason.Contains("اتصال", StringComparison.OrdinalIgnoreCase)))
                    {
                        retryable.Add((msg.Id, failureReason));
                    }
                    // Non-retryable: Permanent failures
                    else if (patientIssue ||
                             failureReason.Contains("invalid phone", StringComparison.OrdinalIgnoreCase) ||
                             failureReason.Contains("deleted", StringComparison.OrdinalIgnoreCase) ||
                             failureReason.Contains("not found", StringComparison.OrdinalIgnoreCase) ||
                             failureReason.Contains("validation", StringComparison.OrdinalIgnoreCase) ||
                             failureReason.Contains("رقم غير صالح", StringComparison.OrdinalIgnoreCase) ||
                             failureReason.Contains("محذوف", StringComparison.OrdinalIgnoreCase))
                    {
                        nonRetryable.Add((msg.Id, failureReason));
                    }
                    // Requires Action: Session/account issues
                    else if (failureReason.Contains("paused", StringComparison.OrdinalIgnoreCase) ||
                             failureReason.Contains("suspended", StringComparison.OrdinalIgnoreCase) ||
                             failureReason.Contains("authentication", StringComparison.OrdinalIgnoreCase) ||
                             failureReason.Contains("متوقف", StringComparison.OrdinalIgnoreCase) ||
                             failureReason.Contains("معلق", StringComparison.OrdinalIgnoreCase))
                    {
                        requiresAction.Add((msg.Id, failureReason));
                    }
                    // Default: treat as retryable if unknown
                    else
                    {
                        retryable.Add((msg.Id, failureReason));
                    }
                }

                // Group by failure reason and count
                var groupRetryable = retryable
                    .GroupBy(x => x.reason)
                    .Select(g => new { reason = g.Key, count = g.Count() })
                    .OrderByDescending(x => x.count)
                    .ToList();

                var groupNonRetryable = nonRetryable
                    .GroupBy(x => x.reason)
                    .Select(g => new { reason = g.Key, count = g.Count() })
                    .OrderByDescending(x => x.count)
                    .ToList();

                var groupRequiresAction = requiresAction
                    .GroupBy(x => x.reason)
                    .Select(g => new { reason = g.Key, count = g.Count() })
                    .OrderByDescending(x => x.count)
                    .ToList();

                return Ok(new
                {
                    success = true,
                    retryable = new
                    {
                        count = retryable.Count,
                        reasons = groupRetryable
                    },
                    nonRetryable = new
                    {
                        count = nonRetryable.Count,
                        reasons = groupNonRetryable
                    },
                    requiresAction = new
                    {
                        count = requiresAction.Count,
                        reasons = groupRequiresAction
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error generating retry preview for session {SessionId}", sessionId);
                return StatusCode(500, new { success = false, error = "Error generating retry preview" });
            }
        }
    }
}
