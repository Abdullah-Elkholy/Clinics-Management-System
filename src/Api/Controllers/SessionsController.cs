using Microsoft.AspNetCore.Mvc;
using Clinics.Domain;
using Clinics.Infrastructure;
using Clinics.Api.DTOs;
using Clinics.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Clinics.Api.Logging;
using System.Security.Claims;
using Microsoft.AspNetCore.SignalR;
using Clinics.Api.Hubs;

namespace Clinics.Api.Controllers
{
    /// <summary>
    /// Controller for managing message sessions (ongoing, failed, completed tasks).
    /// This replaces the old FailedTasks table approach with Message.Status-based filtering.
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "primary_admin,secondary_admin,moderator,user")]
    public class SessionsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly QuotaService _quotaService;
        private readonly ILogger<SessionsController> _logger;
        private readonly IHubContext<DataUpdateHub> _hubContext;

        public SessionsController(
            ApplicationDbContext db,
            QuotaService quotaService,
            ILogger<SessionsController> logger,
            IHubContext<DataUpdateHub> hubContext)
        {
            _db = db;
            _quotaService = quotaService;
            _logger = logger;
            _hubContext = hubContext;
        }

        /// <summary>
        /// Get the current user's moderator ID based on their role.
        /// </summary>
        private async Task<(int? userId, int? moderatorId, string? error)> GetUserAndModeratorId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value
                ?? User.FindFirst("userId")?.Value;

            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return (null, null, "المستخدم غير مصرح له");
            }

            // [FIX] For Admins, we don't enforce a moderator ID for VIEWING data
            if (User.IsInRole("primary_admin") || User.IsInRole("secondary_admin"))
            {
                return (userId, null, null);
            }

            try
            {
                var effectiveModeratorId = await _quotaService.GetEffectiveModeratorIdAsync(userId);
                if (effectiveModeratorId <= 0)
                {
                    return (userId, null, "لم يتم العثور على المشرف المرتبط");
                }
                return (userId, effectiveModeratorId, null);
            }
            catch (InvalidOperationException)
            {
                return (userId, null, "لم يتم العثور على المشرف المرتبط");
            }
        }

        /// <summary>
        /// Get all ongoing sessions for the current user's moderator.
        /// Ongoing sessions have messages with Status = "queued" or "sending".
        /// For Admins: optionally filter by moderatorId query parameter.
        /// </summary>
        [HttpGet("ongoing")]
        public async Task<IActionResult> GetOngoingSessions([FromQuery] int? moderatorId = null)
        {
            var (userId, effectiveModeratorId, error) = await GetUserAndModeratorId();
            if (error != null)
            {
                return Unauthorized(new { success = false, error });
            }

            // For Admins: use provided moderatorId parameter if specified
            // For non-Admins: always use their effective moderatorId (parameter ignored)
            int? filterModeratorId = effectiveModeratorId ?? moderatorId;

            try
            {
                var userRole = User.IsInRole("primary_admin") ? "PrimaryAdmin" : User.IsInRole("secondary_admin") ? "SecondaryAdmin" : "Moderator";
                var moderatorDisplay = filterModeratorId.HasValue ? filterModeratorId.Value.ToString() : "(All - Admin View)";
                _logger.LogDebug("[SessionsController] Getting ongoing sessions for moderator {ModeratorId} (User: {UserId}, Role: {Role})", moderatorDisplay, userId, userRole);

                // Get sessions that have ongoing messages (queued or sending)
                // IMPORTANT: Don't filter by session.Status - a session might be marked "completed" 
                // but still have queued/sending messages if processing was interrupted
                var query = _db.MessageSessions
                    .AsNoTracking()
                    .Where(s => !s.IsDeleted
                        && s.SessionType == "send" // Only message sending sessions, not check_whatsapp
                        && (s.OngoingMessages > 0 || _db.Messages.Any(m =>
                            m.SessionId == s.Id.ToString()
                            && !m.IsDeleted
                            && (m.Status == "queued" || m.Status == "sending"))));

                // Filter by moderator if specified
                if (filterModeratorId.HasValue)
                {
                    query = query.Where(s => s.ModeratorId == filterModeratorId.Value);
                }

                var sessions = await query
                    .Include(s => s.Queue)
                    .OrderBy(s => s.StartTime) // FIFO: oldest session first (will be processed in order)
                    .ToListAsync();

                var result = new List<OngoingSessionDto>();

                foreach (var session in sessions)
                {
                    // Get ongoing messages for this session
                    // Note: Message stores patient data (FullName, PatientPhone, CountryCode) directly
                    // IMPORTANT: Sort by Position (ascending) to match MessagePreviewModal ordering
                    // This ensures patients are displayed in the same order as when messages were previewed
                    var messages = await _db.Messages
                        .AsNoTracking()
                        .Where(m => m.SessionId == session.Id.ToString()
                            && !m.IsDeleted
                            && (m.Status == "queued" || m.Status == "sending"))
                        .OrderBy(m => m.Position)
                        .ToListAsync();

                    // Build SessionPatientDto from Message entity fields
                    var patients = messages.Select(m => new SessionPatientDto
                    {
                        PatientId = m.PatientId ?? 0,
                        MessageId = m.Id,
                        Name = m.FullName ?? "غير معروف",
                        Phone = m.PatientPhone ?? "",
                        CountryCode = m.CountryCode ?? "+966",
                        Status = m.Status ?? "pending",
                        IsPaused = m.IsPaused,
                        Attempts = m.Attempts,
                        FailedReason = m.ErrorMessage,
                        AttemptNumber = m.Attempts + 1,
                        MessageContent = m.Content
                    }).ToList();

                    // Calculate actual counts from messages
                    var total = await _db.Messages
                        .CountAsync(m => m.SessionId == session.Id.ToString() && !m.IsDeleted);
                    var sent = await _db.Messages
                        .CountAsync(m => m.SessionId == session.Id.ToString() && !m.IsDeleted && m.Status == "sent");

                    // Check if session is currently being processed (has messages with 'sending' status)
                    var isProcessing = patients.Any(p => p.Status == "sending");

                    result.Add(new OngoingSessionDto
                    {
                        SessionId = session.Id,
                        QueueId = session.QueueId,
                        QueueName = session.Queue?.DoctorName ?? "غير معروف",
                        StartTime = session.StartTime,
                        Total = total,
                        Sent = sent,
                        Status = session.IsPaused ? "paused" : "active",
                        IsProcessing = isProcessing, // Indicates if session is currently active (sending messages)
                        Patients = patients,
                        CorrelationId = session.CorrelationId,
                        PauseDetails = session.IsPaused ? new PauseReasonDetails
                        {
                            ReasonCode = session.PauseReason ?? "USER_INITIATED",
                            Message = GetPauseReasonMessage(session.PauseReason),
                            PausedAt = session.PausedAt ?? DateTime.UtcNow,
                            PausedBy = session.PausedBy
                        } : null
                    });
                }

                _logger.LogDebug("[SessionsController] Found {Count} ongoing sessions for moderator {ModeratorId}",
                    result.Count, filterModeratorId.HasValue ? filterModeratorId.Value.ToString() : "(All)");

                return Ok(new { success = true, data = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SessionsController] Error getting ongoing sessions for moderator {ModeratorId}", filterModeratorId);
                return StatusCode(500, new { success = false, error = "حدث خطأ أثناء جلب الجلسات الجارية" });
            }
        }

        /// <summary>
        /// Get all failed sessions for the current user's moderator.
        /// Failed sessions have messages with Status = "failed".
        /// For Admins: optionally filter by moderatorId query parameter.
        /// </summary>
        [HttpGet("failed")]
        public async Task<IActionResult> GetFailedSessions([FromQuery] int? moderatorId = null)
        {
            var (userId, effectiveModeratorId, error) = await GetUserAndModeratorId();
            if (error != null)
            {
                return Unauthorized(new { success = false, error });
            }

            // For Admins: use provided moderatorId parameter if specified
            int? filterModeratorId = effectiveModeratorId ?? moderatorId;

            try
            {
                var moderatorDisplay = filterModeratorId.HasValue ? filterModeratorId.Value.ToString() : "(All - Admin View)";
                _logger.LogDebug("[SessionsController] Getting failed sessions for moderator {ModeratorId} (User: {UserId})", moderatorDisplay, userId);

                // Get sessions that have failed messages
                // Get sessions that have failed messages
                var query = _db.MessageSessions
                    .AsNoTracking()
                    .Where(s => !s.IsDeleted
                        && s.SessionType == "send"
                        && (s.FailedMessages > 0 || _db.Messages.Any(m =>
                            m.SessionId == s.Id.ToString()
                            && !m.IsDeleted
                            && m.Status == "failed")));

                // Filter by moderator if specified
                if (filterModeratorId.HasValue)
                {
                    query = query.Where(s => s.ModeratorId == filterModeratorId.Value);
                }

                var sessions = await query
                    .Include(s => s.Queue)
                    .OrderByDescending(s => s.StartTime)
                    .ToListAsync();

                var result = new List<FailedSessionDto>();

                foreach (var session in sessions)
                {
                    // Get failed messages for this session
                    // Note: Message stores patient data (FullName, PatientPhone, CountryCode) directly
                    // Sort by CalculatedPosition for consistency with MessagePreviewModal ordering
                    var messages = await _db.Messages
                        .AsNoTracking()
                        .Where(m => m.SessionId == session.Id.ToString()
                            && !m.IsDeleted
                            && m.Status == "failed")
                        .OrderBy(m => m.Position)
                        .ToListAsync();

                    if (messages.Count == 0) continue; // Skip if no failed messages

                    // Build SessionPatientDto from Message entity fields
                    var patients = messages.Select(m => new SessionPatientDto
                    {
                        PatientId = m.PatientId ?? 0,
                        MessageId = m.Id,
                        Name = m.FullName ?? "غير معروف",
                        Phone = m.PatientPhone ?? "",
                        CountryCode = m.CountryCode ?? "+966",
                        Status = "failed",
                        IsPaused = m.IsPaused,
                        Attempts = m.Attempts,
                        FailedReason = m.ErrorMessage,
                        AttemptNumber = m.Attempts,
                        MessageContent = m.Content
                    }).ToList();

                    var total = await _db.Messages
                        .CountAsync(m => m.SessionId == session.Id.ToString() && !m.IsDeleted);

                    result.Add(new FailedSessionDto
                    {
                        SessionId = session.Id,
                        QueueId = session.QueueId,
                        QueueName = session.Queue?.DoctorName ?? "غير معروف",
                        StartTime = session.StartTime,
                        Total = total,
                        Failed = messages.Count,
                        Patients = patients
                    });
                }

                _logger.LogDebug("[SessionsController] Found {Count} failed sessions for moderator {ModeratorId}",
                    result.Count, filterModeratorId.HasValue ? filterModeratorId.Value.ToString() : "(All)");

                return Ok(new { success = true, data = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SessionsController] Error getting failed sessions for moderator {ModeratorId}", filterModeratorId);
                return StatusCode(500, new { success = false, error = "حدث خطأ أثناء جلب الجلسات الفاشلة" });
            }
        }

        /// <summary>
        /// Get all completed sessions for the current user's moderator.
        /// Shows sessions that have at least one sent message, even if still processing.
        /// This allows tracking sent messages while remaining messages are queued/processing.
        /// For Admins: optionally filter by moderatorId query parameter.
        /// </summary>
        [HttpGet("completed")]
        public async Task<IActionResult> GetCompletedSessions([FromQuery] int? moderatorId = null)
        {
            var (userId, effectiveModeratorId, error) = await GetUserAndModeratorId();
            if (error != null)
            {
                return Unauthorized(new { success = false, error });
            }

            // For Admins: use provided moderatorId parameter if specified
            int? filterModeratorId = effectiveModeratorId ?? moderatorId;

            try
            {
                var moderatorDisplay = filterModeratorId.HasValue ? filterModeratorId.Value.ToString() : "(All - Admin View)";
                _logger.LogDebug("[SessionsController] Getting completed sessions for moderator {ModeratorId} (User: {UserId})", moderatorDisplay, userId);

                var query = _db.MessageSessions
                    .AsNoTracking()
                    .Where(s => !s.IsDeleted
                        && s.SessionType == "send"
                        && _db.Messages.Any(m =>
                            m.SessionId == s.Id.ToString()
                            && !m.IsDeleted
                            && m.Status == "sent"));

                // Filter by moderator if specified
                if (filterModeratorId.HasValue)
                {
                    query = query.Where(s => s.ModeratorId == filterModeratorId.Value);
                }

                // Get sessions that have at least one sent message (regardless of session status)
                // This allows tracking sent messages even while session is still processing
                var sessions = await query
                    .Include(s => s.Queue)
                    .OrderByDescending(s => s.EndTime ?? s.StartTime)
                    .Take(50) // Limit to last 50 sessions with sent messages
                    .ToListAsync();

                var result = new List<CompletedSessionDto>();

                foreach (var session in sessions)
                {
                    // Get sent messages for this session
                    var sentMessages = await _db.Messages
                        .AsNoTracking()
                        .Where(m => m.SessionId == session.Id.ToString()
                            && !m.IsDeleted
                            && m.Status == "sent")
                        .OrderBy(m => m.Position)
                        .ToListAsync();

                    // Count messages by status
                    var failedCount = await _db.Messages
                        .CountAsync(m => m.SessionId == session.Id.ToString()
                            && !m.IsDeleted
                            && m.Status == "failed");

                    var queuedCount = await _db.Messages
                        .CountAsync(m => m.SessionId == session.Id.ToString()
                            && !m.IsDeleted
                            && (m.Status == "queued" || m.Status == "sending"));

                    var total = await _db.Messages
                        .CountAsync(m => m.SessionId == session.Id.ToString() && !m.IsDeleted);

                    // Determine if session is fully completed (no queued messages remaining)
                    var isFullyCompleted = queuedCount == 0;
                    var hasOngoingMessages = queuedCount > 0;

                    // Build SentMessageDto from Message entity fields
                    var sentMessageDtos = sentMessages.Select(m => new SentMessageDto
                    {
                        MessageId = m.Id,
                        PatientId = m.PatientId ?? 0,
                        PatientName = m.FullName ?? "غير معروف",
                        PatientPhone = m.PatientPhone ?? "",
                        CountryCode = m.CountryCode ?? "+966",
                        Content = m.Content ?? "",
                        SentAt = m.SentAt ?? m.UpdatedAt,
                        CreatedBy = m.CreatedBy,
                        UpdatedBy = m.UpdatedBy
                    }).ToList();

                    result.Add(new CompletedSessionDto
                    {
                        SessionId = session.Id,
                        QueueId = session.QueueId,
                        QueueName = session.Queue?.DoctorName ?? "غير معروف",
                        StartTime = session.StartTime,
                        CompletedAt = isFullyCompleted ? session.EndTime : null,
                        Total = total,
                        Sent = sentMessages.Count,
                        Failed = failedCount,
                        Queued = queuedCount,
                        HasFailedMessages = failedCount > 0,
                        HasOngoingMessages = hasOngoingMessages,
                        IsFullyCompleted = isFullyCompleted,
                        SessionStatus = isFullyCompleted ? "completed" : "in_progress",
                        SentMessages = sentMessageDtos
                    });
                }

                _logger.LogDebug("[SessionsController] Found {Count} sessions with sent messages for moderator {ModeratorId}",
                    result.Count, filterModeratorId.HasValue ? filterModeratorId.Value.ToString() : "(All)");

                return Ok(new { success = true, data = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SessionsController] Error getting completed sessions for moderator {ModeratorId}", filterModeratorId);
                return StatusCode(500, new { success = false, error = "حدث خطأ أثناء جلب الجلسات المكتملة" });
            }
        }

        /// <summary>
        /// Pause a session (hierarchical - messages won't be sent but aren't updated in DB).
        /// FilterPausedMessagesAsync checks MessageSession.IsPaused to prevent processing.
        /// </summary>
        [HttpPost("{sessionId}/pause")]
        public async Task<IActionResult> PauseSession(Guid sessionId)
        {
            var (userId, moderatorId, error) = await GetUserAndModeratorId();
            if (error != null)
            {
                return Unauthorized(new { success = false, error });
            }

            try
            {
                var query = _db.MessageSessions.Where(s => s.Id == sessionId && !s.IsDeleted);

                // Only filter by moderator if explicitly restricted (non-admin)
                if (moderatorId.HasValue)
                {
                    query = query.Where(s => s.ModeratorId == moderatorId.Value);
                }

                var session = await query.FirstOrDefaultAsync();

                if (session == null)
                {
                    return NotFound(new { success = false, error = "الجلسة غير موجودة" });
                }

                if (session.IsPaused)
                {
                    return Ok(new { success = true, pausedCount = 0, message = "الجلسة متوقفة بالفعل" });
                }

                session.IsPaused = true;
                session.PausedAt = DateTime.UtcNow;
                session.PausedBy = userId;
                session.PauseReason = "USER_INITIATED";
                session.LastUpdated = DateTime.UtcNow;

                // Do NOT update individual messages - hierarchical pause check in FilterPausedMessagesAsync
                // will prevent them from being processed without needing to update thousands of rows

                await _db.SaveChangesAsync();

                _logger.LogInformation("[SessionsController] Paused session {SessionId} hierarchically (no message rows updated)", sessionId);
                _logger.LogBusinessInformation("تم إيقاف الجلسة {SessionId} مؤقتاً بواسطة {UserId}", sessionId, userId);

                return Ok(new { success = true, message = "تم إيقاف الجلسة (سيتم منع إرسال الرسائل تلقائياً)" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SessionsController] Error pausing session {SessionId}", sessionId);
                return StatusCode(500, new { success = false, error = "حدث خطأ أثناء إيقاف الجلسة" });
            }
        }

        /// <summary>
        /// Resume a paused session (does NOT cascade to messages).
        /// </summary>
        [HttpPost("{sessionId}/resume")]
        public async Task<IActionResult> ResumeSession(Guid sessionId)
        {
            var (userId, moderatorId, error) = await GetUserAndModeratorId();
            if (error != null)
            {
                return Unauthorized(new { success = false, error });
            }

            try
            {
                var query = _db.MessageSessions.Where(s => s.Id == sessionId && !s.IsDeleted);

                // Only filter by moderator if explicitly restricted (non-admin)
                if (moderatorId.HasValue)
                {
                    query = query.Where(s => s.ModeratorId == moderatorId.Value);
                }

                var session = await query.FirstOrDefaultAsync();

                if (session == null)
                {
                    return NotFound(new { success = false, error = "الجلسة غير موجودة" });
                }

                if (!session.IsPaused)
                {
                    return Ok(new { success = true, resumedCount = 0, message = "الجلسة نشطة بالفعل" });
                }

                session.IsPaused = false;
                session.PausedAt = null;
                session.PausedBy = null;
                session.PauseReason = null;
                session.LastUpdated = DateTime.UtcNow;

                // Hierarchical resume - no need to update individual message rows
                // FilterPausedMessagesAsync will allow messages to be processed when MessageSession.IsPaused = false

                await _db.SaveChangesAsync();

                _logger.LogInformation("[SessionsController] Resumed session {SessionId} hierarchically (no message rows updated)", sessionId);
                _logger.LogBusinessInformation("تم استئناف الجلسة {SessionId} بواسطة {UserId}", sessionId, userId);

                return Ok(new { success = true, message = "تم استئناف الجلسة (ستستأنف معالجة الرسائل تلقائياً)" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SessionsController] Error resuming session {SessionId}", sessionId);
                return StatusCode(500, new { success = false, error = "حدث خطأ أثناء استئناف الجلسة" });
            }
        }

        /// <summary>
        /// Retry all failed messages in a session.
        /// </summary>
        [HttpPost("{sessionId}/retry")]
        public async Task<IActionResult> RetrySession(Guid sessionId)
        {
            var (userId, moderatorId, error) = await GetUserAndModeratorId();
            if (error != null)
            {
                return Unauthorized(new { success = false, error });
            }

            try
            {
                var query = _db.MessageSessions.Where(s => s.Id == sessionId && !s.IsDeleted);

                // Only filter by moderator if explicitly restricted (non-admin)
                if (moderatorId.HasValue)
                {
                    query = query.Where(s => s.ModeratorId == moderatorId.Value);
                }

                var session = await query.FirstOrDefaultAsync();

                if (session == null)
                {
                    return NotFound(new { success = false, error = "الجلسة غير موجودة" });
                }

                // Get failed messages in this session
                // Note: Message stores patient phone info directly - no need to join with Patient
                var failedMessages = await _db.Messages
                    .Where(m => m.SessionId == sessionId.ToString()
                        && !m.IsDeleted
                        && m.Status == "failed")
                    .ToListAsync();

                if (failedMessages.Count == 0)
                {
                    return Ok(new { success = true, requeued = 0, skipped = 0, message = "لا توجد رسائل فاشلة لإعادة المحاولة" });
                }

                var requeued = 0;
                var skipped = 0;
                var invalidPatients = new List<string>();

                foreach (var message in failedMessages)
                {
                    // Validate phone number before retry (stored directly in Message)
                    if (string.IsNullOrEmpty(message.PatientPhone))
                    {
                        skipped++;
                        invalidPatients.Add(message.FullName ?? $"Patient {message.PatientId}");
                        continue;
                    }

                    // Reset message for retry
                    message.Status = "queued";
                    message.IsPaused = false;
                    message.ErrorMessage = null;
                    message.Attempts++;
                    message.UpdatedAt = DateTime.UtcNow;
                    message.UpdatedBy = userId;
                    requeued++;
                }

                // Update session counters
                session.FailedMessages -= requeued;
                session.OngoingMessages += requeued;
                if (session.Status == "completed")
                {
                    session.Status = "active";
                }
                session.LastUpdated = DateTime.UtcNow;

                await _db.SaveChangesAsync();

                _logger.LogInformation("[SessionsController] Retried session {SessionId}: {Requeued} requeued, {Skipped} skipped",
                    sessionId, requeued, skipped);
                _logger.LogBusinessInformation("تمت إعادة محاولة الجلسة {SessionId} بواسطة {UserId} ({Requeued} رسالة)", sessionId, userId, requeued);

                return Ok(new
                {
                    success = true,
                    requeued,
                    skipped,
                    message = skipped > 0 ? $"تم إعادة {requeued} رسالة، وتم تخطي {skipped} رسالة بسبب أرقام غير صالحة" : null,
                    invalidPatients = invalidPatients.Count > 0 ? invalidPatients : null
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SessionsController] Error retrying session {SessionId}", sessionId);
                return StatusCode(500, new { success = false, error = "حدث خطأ أثناء إعادة المحاولة" });
            }
        }

        /// <summary>
        /// Delete/cancel a session and all its messages.
        /// </summary>
        [HttpDelete("{sessionId}")]
        public async Task<IActionResult> DeleteSession(Guid sessionId)
        {
            var (userId, moderatorId, error) = await GetUserAndModeratorId();
            if (error != null)
            {
                return Unauthorized(new { success = false, error });
            }

            try
            {
                var query = _db.MessageSessions.Where(s => s.Id == sessionId && !s.IsDeleted);

                // Only filter by moderator if explicitly restricted (non-admin)
                if (moderatorId.HasValue)
                {
                    query = query.Where(s => s.ModeratorId == moderatorId.Value);
                }

                var session = await query.FirstOrDefaultAsync();

                if (session == null)
                {
                    return NotFound(new { success = false, error = "الجلسة غير موجودة" });
                }

                // Soft delete session
                session.IsDeleted = true;
                session.DeletedAt = DateTime.UtcNow;
                session.DeletedBy = userId;
                session.Status = "cancelled";
                session.LastUpdated = DateTime.UtcNow;

                // Soft delete all messages in this session
                await _db.Messages
                    .Where(m => m.SessionId == sessionId.ToString() && !m.IsDeleted)
                    .ExecuteUpdateAsync(m => m
                        .SetProperty(x => x.IsDeleted, true)
                        .SetProperty(x => x.DeletedAt, DateTime.UtcNow)
                        .SetProperty(x => x.DeletedBy, userId)
                        .SetProperty(x => x.Status, "cancelled"));

                await _db.SaveChangesAsync();

                _logger.LogInformation("[SessionsController] Deleted session {SessionId}", sessionId);
                _logger.LogBusinessInformation("تم حذف الجلسة {SessionId} بواسطة {UserId}", sessionId, userId);

                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "[SessionsController] Error deleting session {SessionId}", sessionId);
                return StatusCode(500, new { success = false, error = "حدث خطأ أثناء حذف الجلسة" });
            }
        }

        /// <summary>
        /// Get human-readable message for pause reason code.
        /// </summary>
        private static string GetPauseReasonMessage(string? pauseReason)
        {
            return pauseReason switch
            {
                "USER_INITIATED" => "تم الإيقاف بواسطة المستخدم",
                "SESSION_PAUSED" => "تم إيقاف الجلسة",
                "PendingQR" => "في انتظار مسح رمز QR",
                "PendingNET" => "مشكلة في الاتصال بالإنترنت",
                "BrowserClosure" => "تم إغلاق المتصفح",
                "AUTO_PAUSED_ON_ERROR" => "تم الإيقاف تلقائياً بسبب خطأ",
                "RATE_LIMIT" => "تم تجاوز الحد الأقصى للرسائل",
                _ => pauseReason ?? "غير محدد"
            };
        }
    }
}
