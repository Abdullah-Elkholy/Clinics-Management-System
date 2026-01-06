using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Clinics.Api.DTOs;
using Clinics.Infrastructure;
using Clinics.Api.Services;
using System.Security.Claims;
using Clinics.Domain;
using Microsoft.AspNetCore.SignalR;
using Clinics.Api.Hubs;

namespace Clinics.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class SessionsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<SessionsController> _logger;
    private readonly QuotaService _quotaService;
    private readonly IMessageSessionCascadeService _messageSessionCascadeService;
    private readonly IHubContext<DataUpdateHub> _hubContext;

    public SessionsController(
        ApplicationDbContext context, 
        ILogger<SessionsController> logger, 
        QuotaService quotaService,
        IMessageSessionCascadeService messageSessionCascadeService,
        IHubContext<DataUpdateHub> hubContext)
    {
        _context = context;
        _logger = logger;
        _quotaService = quotaService;
        _messageSessionCascadeService = messageSessionCascadeService;
        _hubContext = hubContext;
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

            // Get current user to check role
            var currentUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (currentUser == null)
                return Unauthorized(new { success = false, error = "المستخدم غير موجود" });

            var isAdmin = currentUser.Role == "primary_admin" || currentUser.Role == "secondary_admin";

            // Get sessions based on role (unified per moderator, not per queue):
            // - Admins: See ALL sessions from ALL moderators
            // - Moderators/Users: See only their own/assigned moderator's sessions
            // Filter by OngoingMessages > 0 (sessions with at least 1 message in queued/sending status)
            int? moderatorId;
            if (isAdmin)
            {
                moderatorId = null; // Admins see all sessions
            }
            else if (currentUser.Role == "moderator")
            {
                moderatorId = userId; // Moderators see their own sessions
            }
            else
            {
                // Regular users must have a ModeratorId assigned
                if (!currentUser.ModeratorId.HasValue)
                {
                    // User has no moderator assigned, return empty list
                    return Ok(new { success = true, data = new List<OngoingSessionDto>() });
                }
                moderatorId = currentUser.ModeratorId.Value;
            }
            
            // Get all sessions for the moderator first
            // Use AsNoTracking for read-only query to reduce memory usage
            var allSessions = await _context.MessageSessions
                .AsNoTracking()
                .Include(s => s.Queue)
                .Where(s => !s.IsDeleted 
                    && (moderatorId == null || s.ModeratorId == moderatorId))
                .ToListAsync();

            // Get session IDs that actually have ongoing messages (check actual Messages table, not counter)
            // Use AsNoTracking for read-only query
            var sessionIdsWithOngoingMessages = await _context.Messages
                .AsNoTracking()
                .Where(m => (m.Status == "queued" || m.Status == "sending") && !m.IsDeleted && !string.IsNullOrEmpty(m.SessionId))
                .Select(m => m.SessionId!)
                .Distinct()
                .ToListAsync();

            // Convert to Guid set for efficient lookup
            var sessionGuidSet = new HashSet<Guid>();
            foreach (var sessionIdStr in sessionIdsWithOngoingMessages)
            {
                if (Guid.TryParse(sessionIdStr, out var guid))
                {
                    sessionGuidSet.Add(guid);
                }
            }

            // Filter sessions that have ongoing messages
            var sessions = allSessions
                .Where(s => sessionGuidSet.Contains(s.Id))
                .OrderBy(s => s.StartTime)
                .ToList();

            var sessionDtos = new List<OngoingSessionDto>();

            // OPTIMIZATION: Batch fetch all messages and patients in one query instead of N+1
            // Get all session IDs first
            var sessionIdStrings = sessions.Select(s => s.Id.ToString()).ToList();
            
            // Fetch all messages for all sessions in one query
            // Only select fields we actually need (Patient data comes from Patient entity)
            var allSessionMessages = await _context.Messages
                .AsNoTracking() // Read-only, no need to track
                .Where(m => sessionIdStrings.Contains(m.SessionId!) 
                    && !m.IsDeleted 
                    && (m.Status == "queued" || m.Status == "sending"))
                .Select(m => new
                {
                    SessionId = m.SessionId,
                    PatientId = m.PatientId,
                    MessageId = m.Id,
                    Status = m.Status,
                    CreatedAt = m.CreatedAt,
                    IsPaused = m.IsPaused,
                    Attempts = m.Attempts,
                    PauseReason = m.PauseReason,
                    ErrorMessage = m.ErrorMessage,
                    Content = m.Content // Include message content for display
                })
                .ToListAsync();

            // Get all unique patient IDs from all messages
            var allPatientIds = allSessionMessages
                .Where(m => m.PatientId.HasValue)
                .Select(m => m.PatientId!.Value)
                .Distinct()
                .ToList();

            // Fetch all patients in one query
            var allPatientsList = await _context.Patients
                .AsNoTracking() // Read-only, no need to track
                .Where(p => allPatientIds.Contains(p.Id))
                .Select(p => new
                {
                    Id = p.Id,
                    FullName = p.FullName,
                    PhoneNumber = p.PhoneNumber,
                    CountryCode = p.CountryCode
                })
                .ToListAsync();

            // Convert to dictionary for fast lookup
            var patientsDict = allPatientsList.ToDictionary(p => p.Id, p => p);

            foreach (var session in sessions)
            {
                // Filter messages for this session from pre-fetched data
                var sessionMessages = allSessionMessages
                    .Where(m => m.SessionId == session.Id.ToString())
                    .ToList();

                // Get unique patient IDs from messages for this session
                var patientIds = sessionMessages
                    .Where(m => m.PatientId.HasValue)
                    .Select(m => m.PatientId!.Value)
                    .Distinct()
                    .ToList();

                // Get patients from pre-fetched dictionary
                var patients = patientIds
                    .Where(id => patientsDict.ContainsKey(id))
                    .Select(id => patientsDict[id])
                    .ToList();

                // Match messages to patients in memory (after materialization)
                var patientDtos = patients.Select(p =>
                {
                    var message = sessionMessages
                        .Where(m => m.PatientId == p.Id)
                        .OrderByDescending(m => m.CreatedAt)
                        .FirstOrDefault();
                    
                    return new SessionPatientDto
                    {
                        PatientId = p.Id,
                        MessageId = message?.MessageId,
                        Name = p.FullName ?? "غير محدد",
                        Phone = p.PhoneNumber ?? "",
                        CountryCode = p.CountryCode ?? "+966",
                        Status = MapMessageStatus(message?.Status),
                        IsPaused = message?.IsPaused ?? false,
                        Attempts = message?.Attempts ?? 0,
                        AttemptNumber = (message?.Attempts ?? 0) + 1,
                        FailedReason = message?.ErrorMessage,
                        MessageContent = message?.Content // Include resolved message content
                    };
                }).ToList();

                sessionDtos.Add(new OngoingSessionDto
                {
                    SessionId = session.Id,
                    QueueId = session.QueueId,
                    QueueName = session.Queue?.DoctorName ?? "غير محدد",
                    StartTime = session.StartTime,
                    Total = session.TotalMessages,
                    Sent = session.SentMessages,
                    Status = session.IsPaused ? "paused" : session.Status,
                    CorrelationId = session.CorrelationId,
                    PauseDetails = session.IsPaused ? new PauseReasonDetails
                    {
                        ReasonCode = session.PauseReason?.Contains("PendingQR") == true ? "AUTO_PAUSED_ON_ERROR" 
                                   : session.PauseReason?.Contains("PendingNET") == true ? "AUTO_PAUSED_ON_ERROR"
                                   : session.PauseReason?.Contains("BrowserClosure") == true ? "AUTO_PAUSED_ON_ERROR"
                                   : session.PauseReason?.Contains("User") == true ? "USER_INITIATED" 
                                   : "UNKNOWN",
                        Message = session.PauseReason ?? "غير محدد",
                        PausedAt = session.PausedAt ?? DateTime.UtcNow,
                        PausedBy = session.PausedBy,
                        ErrorDetails = session.PauseReason?.Contains("PendingQR") == true 
                            ? "جلسة الواتساب تحتاج إلى المصادقة" 
                            : session.PauseReason?.Contains("PendingNET") == true
                            ? "فشل الاتصال بالإنترنت"
                            : session.PauseReason?.Contains("BrowserClosure") == true
                            ? "تم إغلاق المتصفح"
                            : null
                    } : null,
                    Patients = patientDtos
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
    /// Pause an ongoing session (uses hierarchical pause system - session level only)
    /// Per the 3-tier hierarchy: WhatsAppSession > MessageSession > Message
    /// This only sets MessageSession.IsPaused = true, NOT individual message pauses.
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

            // Pause the session itself (hierarchical pause - no cascade to messages)
            var session = await _context.MessageSessions.FindAsync(id);
            
            if (session == null)
            {
                return NotFound(new { success = false, error = "الجلسة غير موجودة" });
            }
            
            // Set session-level pause (MessageProcessor will check this at query time)
            session.IsPaused = true;
            session.Status = "paused";
            session.PausedAt = DateTime.UtcNow;
            session.PausedBy = userId;
            session.PauseReason = "UserPaused";
            session.LastUpdated = DateTime.UtcNow;
            
            // Count affected messages (for UI feedback only - no database changes to messages)
            var affectedMessageCount = await _context.Messages
                .Where(m => m.SessionId == id.ToString() 
                    && (m.Status == "queued" || m.Status == "sending") 
                    && !m.IsPaused
                    && !m.IsDeleted)
                .CountAsync();
            
            // Update OngoingMessages counter (these will be effectively paused via hierarchy)
            session.OngoingMessages = 0; // All messages in this session are now paused
            
            _logger.LogInformation("Session {SessionId} paused via hierarchy. {AffectedCount} messages will be paused at query time.", 
                id, affectedMessageCount);

            await _context.SaveChangesAsync();
            
            // Broadcast SessionUpdated event via SignalR (single event for session pause)
            var moderatorId = session.ModeratorId;
            if (moderatorId > 0)
            {
                await _hubContext.Clients
                    .Group($"moderator-{moderatorId}")
                    .SendAsync("SessionUpdated", new { sessionId = id, isPaused = true, status = "paused" });
            }
            
            return Ok(new { success = true, pausedCount = affectedMessageCount });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error pausing session {SessionId}", id);
            return StatusCode(500, new { success = false, error = "حدث خطأ أثناء إيقاف الجلسة" });
        }
    }

    /// <summary>
    /// Resume a paused session (uses hierarchical pause system - session level only)
    /// Per the 3-tier hierarchy: WhatsAppSession > MessageSession > Message
    /// This only sets MessageSession.IsPaused = false.
    /// Messages will automatically become processable unless they have individual Message.IsPaused = true.
    /// </summary>
    [HttpPost("{id}/resume")]
    public async Task<IActionResult> ResumeSession(Guid id)
    {
        try
        {
            // Resume the session itself (hierarchical resume - no cascade to messages)
            var session = await _context.MessageSessions.FindAsync(id);
            
            if (session == null)
            {
                return NotFound(new { success = false, error = "الجلسة غير موجودة" });
            }
            
            // Clear session-level pause
            session.IsPaused = false;
            session.Status = "active";
            session.PausedAt = null;
            session.PausedBy = null;
            session.PauseReason = null;
            session.LastUpdated = DateTime.UtcNow;
            
            // Count messages that will become processable (those not individually paused)
            var resumedMessageCount = await _context.Messages
                .Where(m => m.SessionId == id.ToString() 
                    && (m.Status == "queued" || m.Status == "sending") 
                    && !m.IsPaused  // Only count messages that aren't individually paused
                    && !m.IsDeleted)
                .CountAsync();
            
            // Update OngoingMessages counter
            session.OngoingMessages = resumedMessageCount;
            
            _logger.LogInformation("Session {SessionId} resumed via hierarchy. {ResumedCount} messages now processable.", 
                id, resumedMessageCount);

            await _context.SaveChangesAsync();
            
            // Broadcast SessionUpdated event via SignalR
            var moderatorId = session.ModeratorId;
            if (moderatorId > 0)
            {
                await _hubContext.Clients
                    .Group($"moderator-{moderatorId}")
                    .SendAsync("SessionUpdated", new { sessionId = id, isPaused = false, status = "active" });
            }
            
            return Ok(new { success = true, resumedCount = resumedMessageCount });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error resuming session {SessionId}", id);
            return StatusCode(500, new { success = false, error = "حدث خطأ أثناء استئناف الجلسة" });
        }
    }

    /// <summary>
    /// Retry all failed messages in a session
    /// IMPORTANT: Validates WhatsApp numbers before retrying
    /// </summary>
    [HttpPost("{id}/retry")]
    public async Task<IActionResult> RetrySession(Guid id)
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

            // Get current user to check role and authorization
            var currentUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (currentUser == null)
                return Unauthorized(new { success = false, error = "المستخدم غير موجود" });

            // Get session to verify it exists and check authorization
            var session = await _context.MessageSessions
                .Include(s => s.Queue)
                .FirstOrDefaultAsync(s => s.Id == id && !s.IsDeleted);

            if (session == null)
                return NotFound(new { success = false, error = "الجلسة غير موجودة" });

            // Check authorization: users can only retry sessions from their assigned moderator
            var isAdmin = currentUser.Role == "primary_admin" || currentUser.Role == "secondary_admin";
            if (!isAdmin)
            {
                if (currentUser.Role == "moderator" && session.ModeratorId != userId)
                {
                    return Forbid();
                }
                else if (currentUser.Role == "user" && (!currentUser.ModeratorId.HasValue || currentUser.ModeratorId.Value != session.ModeratorId))
                {
                    return Forbid();
                }
            }

            // Get all failed messages in this session
            // Failed messages are those with status "failed" or in FailedTasks table
            var failedMessages = await _context.Messages
                .Include(m => m.Queue)
                .Where(m => m.SessionId == id.ToString() 
                    && (m.Status == "failed" || _context.FailedTasks.Any(ft => ft.MessageId == m.Id))
                    && !m.IsDeleted)
                .ToListAsync();

            if (failedMessages.Count == 0)
            {
                return Ok(new 
                { 
                    success = true, 
                    requeued = 0, 
                    skipped = 0,
                    message = "لا توجد رسائل فاشلة في هذه الجلسة" 
                });
            }

            // GAP FIX 2.2: Remove orphaned FailedTask records before retrying
            // This handles cases where FailedTask exists but the Message no longer does or is in inconsistent state
            var failedMessageIds = failedMessages.Select(m => m.Id).ToList();
            var orphanedFailedTasks = await _context.FailedTasks
                .Where(ft => ft.MessageId.HasValue && !failedMessageIds.Contains(ft.MessageId.Value))
                .ToListAsync();
            
            if (orphanedFailedTasks.Any())
            {
                _context.FailedTasks.RemoveRange(orphanedFailedTasks);
                _logger.LogWarning("Removed {OrphanedCount} orphaned FailedTask records before retrying session {SessionId}", 
                    orphanedFailedTasks.Count, id);
            }

            // GAP FIX 2.3: Prevent retrying messages to moderator's own WhatsApp number
            var moderatorSettings = await _context.Set<ModeratorSettings>()
                .FirstOrDefaultAsync(m => m.ModeratorUserId == session.ModeratorId);
            
            if (moderatorSettings != null && !string.IsNullOrEmpty(moderatorSettings.WhatsAppPhoneNumber))
            {
                var normalizePhone = (string? phone) => 
                {
                    if (string.IsNullOrEmpty(phone)) return null;
                    return new string(phone.Where(char.IsDigit).ToArray());
                };
                
                var moderatorPhoneNormalized = normalizePhone(moderatorSettings.WhatsAppPhoneNumber);
                
                // Filter out messages to moderator's own number
                var selfNumberMessages = failedMessages.Where(msg => 
                {
                    if (string.IsNullOrEmpty(moderatorPhoneNormalized)) return false;
                    
                    var patientPhoneNormalized = normalizePhone(msg.PatientPhone);
                    var patientPhoneWithCountry = normalizePhone($"{msg.CountryCode}{msg.PatientPhone}");
                    
                    return patientPhoneNormalized == moderatorPhoneNormalized ||
                           patientPhoneWithCountry == moderatorPhoneNormalized ||
                           (moderatorPhoneNormalized.EndsWith(patientPhoneNormalized ?? "") && 
                            patientPhoneNormalized?.Length >= 7) ||
                           (patientPhoneNormalized?.EndsWith(moderatorPhoneNormalized) == true &&
                            moderatorPhoneNormalized.Length >= 7);
                }).ToList();
                
                if (selfNumberMessages.Any())
                {
                    _logger.LogWarning("Skipped {SelfNumberCount} messages to moderator's own WhatsApp number in session {SessionId} retry", 
                        selfNumberMessages.Count, id);
                    
                    // Remove self-number messages from retry list
                    failedMessages = failedMessages.Except(selfNumberMessages).ToList();
                }
            }

            if (failedMessages.Count == 0)
            {
                return Ok(new 
                { 
                    success = true, 
                    requeued = 0, 
                    skipped = 0,
                    message = "لا توجد رسائل فاشلة قابلة للمحاولة مرة أخرى في هذه الجلسة" 
                });
            }

            var requeued = 0;
            var skipped = 0;
            var invalidPatients = new List<string>();
            var updatedMessages = new List<(Guid messageId, int moderatorId)>();

            foreach (var msg in failedMessages)
            {
                // CRITICAL: Validate WhatsApp number before retrying
                // Get patient to check IsValidWhatsAppNumber (Message doesn't have Patient navigation property)
                if (msg.PatientId.HasValue)
                {
                    var patient = await _context.Patients.FindAsync(msg.PatientId.Value);
                    
                    if (patient != null)
                    {
                        // Skip if IsValidWhatsAppNumber is null or false
                        if (!patient.IsValidWhatsAppNumber.HasValue || patient.IsValidWhatsAppNumber.Value == false)
                        {
                            skipped++;
                            invalidPatients.Add(patient.FullName ?? $"Patient ID: {patient.Id}");
                            _logger.LogWarning("Skipped retry for message {MessageId} in session {SessionId} - Patient {PatientId} has unvalidated WhatsApp number", 
                                msg.Id, id, patient.Id);
                            continue;
                        }
                    }
                }

                // Requeue the message
                msg.Status = "queued";
                msg.IsPaused = false; // Resume paused messages on retry
                msg.PausedAt = null;
                msg.PauseReason = null;
                msg.LastAttemptAt = DateTime.UtcNow;

                // Remove from FailedTasks if it exists
                var failedTask = await _context.FailedTasks
                    .FirstOrDefaultAsync(ft => ft.MessageId == msg.Id);
                if (failedTask != null)
                {
                    _context.FailedTasks.Remove(failedTask);
                }

                requeued++;
                
                if (msg.ModeratorId.HasValue)
                {
                    updatedMessages.Add((msg.Id, msg.ModeratorId.Value));
                }
            }

            await _context.SaveChangesAsync();
            
            // Broadcast MessageUpdated events via SignalR for each retried message
            foreach (var (messageId, moderatorId) in updatedMessages)
            {
                await _hubContext.Clients
                    .Group($"moderator-{moderatorId}")
                    .SendAsync("MessageUpdated", new { messageId, isPaused = false, status = "queued" });
            }

            _logger.LogInformation("Retried {RequeuedCount} messages from session {SessionId} by user {UserId}. Skipped {SkippedCount} messages with unvalidated WhatsApp numbers.", 
                requeued, id, userId, skipped);

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
            
            return Ok(new 
            { 
                success = true, 
                requeued,
                skipped = 0,
                message = $"تم إعادة إضافة {requeued} رسالة إلى قائمة الانتظار بنجاح"
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrying session {SessionId}", id);
            return StatusCode(500, new { success = false, error = "حدث خطأ أثناء إعادة محاولة الجلسة" });
        }
    }

    /// <summary>
    /// Delete/cancel a session (soft delete) - cascades to Messages
    /// </summary>
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteSession(Guid id)
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

            // Use MessageSessionCascadeService to handle cascade to Messages
            var (success, errorMessage) = await _messageSessionCascadeService.SoftDeleteMessageSessionAsync(id, userId);

            if (!success)
            {
                return BadRequest(new { success = false, error = errorMessage });
            }

            return Ok(new { success = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting session {SessionId}", id);
            return StatusCode(500, new { success = false, error = "حدث خطأ أثناء حذف الجلسة" });
        }
    }

    /// <summary>
    /// Get all failed message sessions for current user's moderator
    /// </summary>
    [HttpGet("failed")]
    public async Task<IActionResult> GetFailedSessions()
    {
        _logger.LogInformation("[GetFailedSessions] ====== ENDPOINT CALLED ======");
        try
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("sub")?.Value
                ?? User.FindFirst("userId")?.Value;
            
            _logger.LogInformation("[GetFailedSessions] Extracted userIdClaim: '{UserIdClaim}'", userIdClaim ?? "NULL");
            
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                _logger.LogWarning("[GetFailedSessions] Invalid userIdClaim, returning Unauthorized");
                return Unauthorized(new { success = false, error = "المستخدم غير مصرح له" });
            }

            _logger.LogInformation("[GetFailedSessions] Parsed userId: {UserId}", userId);

            // Get current user to check role
            var currentUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (currentUser == null)
            {
                _logger.LogWarning("[GetFailedSessions] User {UserId} not found in database", userId);
                return Unauthorized(new { success = false, error = "المستخدم غير موجود" });
            }
            
            _logger.LogInformation("[GetFailedSessions] Found user: Id={UserId}, Username={Username}, Role={Role}, ModeratorId={ModeratorId}",
                currentUser.Id, currentUser.Username, currentUser.Role, currentUser.ModeratorId);

            var isAdmin = currentUser.Role == "primary_admin" || currentUser.Role == "secondary_admin";

            _logger.LogInformation("[GetFailedSessions] User {UserId} with role '{Role}' requesting failed sessions. IsAdmin: {IsAdmin}", 
                userId, currentUser.Role, isAdmin);

            // Get sessions based on role (unified per moderator, not per queue):
            // - Admins: See ALL failed sessions from ALL moderators
            // - Moderators/Users: See only their own/assigned moderator's failed sessions
            // Filter by FailedMessages > 0 (sessions with at least 1 message in failed status)
            int? moderatorId;
            if (isAdmin)
            {
                moderatorId = null; // Admins see all sessions
                _logger.LogInformation("[GetFailedSessions] Admin user - will see all sessions");
            }
            else if (currentUser.Role == "moderator")
            {
                moderatorId = userId; // Moderators see their own sessions
                _logger.LogInformation("[GetFailedSessions] Moderator user - will see sessions for ModeratorId={ModeratorId}", moderatorId);
            }
            else
            {
                // Regular users must have a ModeratorId assigned
                if (!currentUser.ModeratorId.HasValue)
                {
                    // User has no moderator assigned, return empty list
                    _logger.LogWarning("[GetFailedSessions] Regular user {UserId} has no ModeratorId assigned", userId);
                    return Ok(new { success = true, data = new List<FailedSessionDto>() });
                }
                moderatorId = currentUser.ModeratorId.Value;
                _logger.LogInformation("[GetFailedSessions] Regular user - will see sessions for ModeratorId={ModeratorId}", moderatorId);
            }
            
            // Get all sessions for the moderator first
            _logger.LogInformation("[GetFailedSessions] Querying MessageSessions: IsDeleted=false, ModeratorId={ModeratorId}", 
                moderatorId?.ToString() ?? "NULL (all)");
            
            var allSessions = await _context.MessageSessions
                .Include(s => s.Queue)
                .Where(s => !s.IsDeleted 
                    && (moderatorId == null || s.ModeratorId == moderatorId))
                .ToListAsync();

            _logger.LogInformation("[GetFailedSessions] Found {Count} total sessions for moderator {ModeratorId}", 
                allSessions.Count, moderatorId);
            
            // Log all sessions found for debugging
            foreach (var s in allSessions)
            {
                _logger.LogInformation("[GetFailedSessions] Session: Id={SessionId}, ModeratorId={ModeratorId}, FailedMessages={Failed}, IsDeleted={Deleted}, Status={Status}",
                    s.Id, s.ModeratorId, s.FailedMessages, s.IsDeleted, s.Status);
            }

            // Check sessions with FailedMessages counter > 0 (for comparison)
            var sessionsWithFailedCounter = allSessions.Where(s => s.FailedMessages > 0).ToList();
            _logger.LogInformation("[GetFailedSessions] Sessions with FailedMessages counter > 0: {Count}", 
                sessionsWithFailedCounter.Count);
            
            if (sessionsWithFailedCounter.Any())
            {
                _logger.LogInformation("[GetFailedSessions] Sample session IDs with FailedMessages > 0: {SessionIds}", 
                    string.Join(", ", sessionsWithFailedCounter.Take(5).Select(s => s.Id.ToString())));
                foreach (var s in sessionsWithFailedCounter.Take(3))
                {
                    _logger.LogInformation("[GetFailedSessions] Session {SessionId}: ModeratorId={ModeratorId}, FailedMessages={FailedMessages}, Status={Status}", 
                        s.Id, s.ModeratorId, s.FailedMessages, s.Status);
                }
            }
            else
            {
                _logger.LogWarning("[GetFailedSessions] No sessions found with FailedMessages > 0. Checking all sessions...");
                foreach (var s in allSessions.Take(5))
                {
                    _logger.LogInformation("[GetFailedSessions] Session {SessionId}: ModeratorId={ModeratorId}, FailedMessages={FailedMessages}, Status={Status}, IsDeleted={IsDeleted}", 
                        s.Id, s.ModeratorId, s.FailedMessages, s.Status, s.IsDeleted);
                }
            }

            // First, check total failed messages (for debugging)
            var totalFailedMessages = await _context.Messages
                .Where(m => m.Status == "failed" && !m.IsDeleted)
                .CountAsync();
            _logger.LogInformation("[GetFailedSessions] Total failed messages in database: {Count}", totalFailedMessages);

            // Check failed messages with SessionId
            var failedMessagesWithSessionId = await _context.Messages
                .Where(m => m.Status == "failed" && !m.IsDeleted && !string.IsNullOrEmpty(m.SessionId))
                .CountAsync();
            _logger.LogInformation("[GetFailedSessions] Failed messages with SessionId set: {Count}", failedMessagesWithSessionId);

            // Get session IDs that actually have failed messages (check actual Messages table, not counter)
            // Also filter by moderator if not admin
            var failedMessagesQuery = _context.Messages
                .Where(m => m.Status == "failed" && !m.IsDeleted && !string.IsNullOrEmpty(m.SessionId));
            
            // If not admin, also filter by moderator
            if (moderatorId.HasValue)
            {
                failedMessagesQuery = failedMessagesQuery.Where(m => m.ModeratorId == moderatorId.Value);
                var failedMessagesForModerator = await failedMessagesQuery.CountAsync();
                _logger.LogInformation("[GetFailedSessions] Failed messages for moderator {ModeratorId}: {Count}", 
                    moderatorId.Value, failedMessagesForModerator);
            }
            else
            {
                var failedMessagesForAdmin = await failedMessagesQuery.CountAsync();
                _logger.LogInformation("[GetFailedSessions] Failed messages for admin (all moderators): {Count}", 
                    failedMessagesForAdmin);
            }
            
            var sessionIdsWithFailedMessages = await failedMessagesQuery
                .Select(m => m.SessionId!)
                .Distinct()
                .ToListAsync();

            _logger.LogInformation("[GetFailedSessions] Found {Count} unique session IDs with failed messages (moderatorId: {ModeratorId})", 
                sessionIdsWithFailedMessages.Count, moderatorId);
            
            if (sessionIdsWithFailedMessages.Count > 0)
            {
                _logger.LogInformation("[GetFailedSessions] Sample session IDs from messages: {SampleIds}", 
                    string.Join(", ", sessionIdsWithFailedMessages.Take(5)));
                
                // Also log the actual SessionId values from the database to check format
                var sampleMessages = await _context.Messages
                    .Where(m => m.Status == "failed" && !m.IsDeleted && !string.IsNullOrEmpty(m.SessionId))
                    .Select(m => new { m.SessionId, m.ModeratorId })
                    .Take(5)
                    .ToListAsync();
                _logger.LogInformation("[GetFailedSessions] Sample failed messages - SessionId format check: {Samples}", 
                    string.Join("; ", sampleMessages.Select(m => $"SessionId='{m.SessionId}', ModeratorId={m.ModeratorId}")));
            }
            else
            {
                // If no session IDs found, check if there are failed messages without SessionId
                var failedMessagesWithoutSessionId = await _context.Messages
                    .Where(m => m.Status == "failed" && !m.IsDeleted && (string.IsNullOrEmpty(m.SessionId) || m.SessionId == null))
                    .CountAsync();
                _logger.LogWarning("[GetFailedSessions] Found {Count} failed messages WITHOUT SessionId set", 
                    failedMessagesWithoutSessionId);
            }

            // Convert to Guid set for efficient lookup
            var sessionGuidSet = new HashSet<Guid>();
            var parseFailures = new List<string>();
            foreach (var sessionIdStr in sessionIdsWithFailedMessages)
            {
                if (Guid.TryParse(sessionIdStr, out var guid))
                {
                    sessionGuidSet.Add(guid);
                }
                else
                {
                    parseFailures.Add(sessionIdStr);
                }
            }

            if (parseFailures.Any())
            {
                _logger.LogWarning("[GetFailedSessions] Failed to parse {Count} session IDs as Guid: {SessionIds}", 
                    parseFailures.Count, string.Join(", ", parseFailures.Take(5)));
            }

            _logger.LogInformation("[GetFailedSessions] Successfully parsed {Count} session GUIDs", sessionGuidSet.Count);

            if (sessionGuidSet.Any() && allSessions.Any())
            {
                // Log sample session IDs for debugging
                var sampleSessionGuids = allSessions.Take(5).Select(s => s.Id).ToList();
                _logger.LogInformation("[GetFailedSessions] Sample session GUIDs from MessageSessions: {SessionGuids}", 
                    string.Join(", ", sampleSessionGuids));
                
                var matchingCount = allSessions.Count(s => sessionGuidSet.Contains(s.Id));
                _logger.LogInformation("[GetFailedSessions] Sessions that match failed messages GUIDs: {Count}", matchingCount);
            }

            // DIRECT TEST: Query the exact session we know exists
            if (moderatorId.HasValue)
            {
                var directTestSession = await _context.MessageSessions
                    .Include(s => s.Queue)
                    .FirstOrDefaultAsync(s => s.Id == Guid.Parse("D2062CB2-CEE7-4693-BD8B-D73D6D118F04"));
                
                if (directTestSession != null)
                {
                    _logger.LogInformation("[GetFailedSessions] DIRECT TEST: Found session by GUID - ModeratorId={ModeratorId}, FailedMessages={Failed}, IsDeleted={Deleted}, MatchesFilter={Matches}",
                        directTestSession.ModeratorId, directTestSession.FailedMessages, directTestSession.IsDeleted,
                        directTestSession.ModeratorId == moderatorId.Value && !directTestSession.IsDeleted && directTestSession.FailedMessages > 0);
                }
                else
                {
                    _logger.LogWarning("[GetFailedSessions] DIRECT TEST: Session D2062CB2-CEE7-4693-BD8B-D73D6D118F04 NOT FOUND in database!");
                }
            }

            // SIMPLIFIED APPROACH: Just use the counter - it's the most reliable
            // The counter is updated when messages fail, so it's the source of truth
            var sessions = sessionsWithFailedCounter
                .OrderBy(s => s.StartTime)
                .ToList();

            _logger.LogInformation("[GetFailedSessions] Using counter-based approach: Found {Count} sessions with FailedMessages > 0", sessions.Count);
            
            // Also log SessionId matching for comparison
            var sessionsBySessionId = allSessions
                .Where(s => sessionGuidSet.Contains(s.Id))
                .ToList();
            _logger.LogInformation("[GetFailedSessions] SessionId matching found: {Count} sessions", sessionsBySessionId.Count);
            
            // If counter found nothing but SessionId found something, use SessionId results
            if (sessions.Count == 0 && sessionsBySessionId.Count > 0)
            {
                _logger.LogWarning("[GetFailedSessions] Counter found 0 but SessionId found {Count} - using SessionId results", sessionsBySessionId.Count);
                sessions = sessionsBySessionId.OrderBy(s => s.StartTime).ToList();
            }
            
            _logger.LogInformation("[GetFailedSessions] FINAL: Processing {SessionCount} sessions for DTO creation", sessions.Count);
            if (sessions.Count == 0)
            {
                _logger.LogWarning("[GetFailedSessions] CRITICAL: No sessions found! allSessions={AllCount}, sessionsWithFailedCounter={CounterCount}, sessionGuidSet={GuidCount}",
                    allSessions.Count, sessionsWithFailedCounter.Count, sessionGuidSet.Count);
                
                // Debug: Log all session details
                foreach (var s in allSessions.Take(10))
                {
                    _logger.LogWarning("[GetFailedSessions] Session {SessionId}: ModeratorId={ModeratorId}, FailedMessages={Failed}, IsDeleted={Deleted}",
                        s.Id, s.ModeratorId, s.FailedMessages, s.IsDeleted);
                }
            }

            var sessionDtos = new List<FailedSessionDto>();

            _logger.LogInformation("[GetFailedSessions] Starting DTO creation for {Count} sessions", sessions.Count);
            
            foreach (var session in sessions)
            {
                _logger.LogInformation("[GetFailedSessions] ====== Processing Session {SessionId} ======", session.Id);
                try
                {
                    // Get failed messages linked to this session via SessionId
                    // Handle case-insensitive comparison (SessionId in DB might be lowercase while session.Id is uppercase)
                    var sessionIdString = session.Id.ToString();
                    var sessionIdGuid = session.Id;
                    _logger.LogInformation("[GetFailedSessions] Processing session {SessionId}, searching for messages with SessionId='{SessionIdString}'", 
                        session.Id, sessionIdString);
                    
                    // First get all failed messages for this moderator, then filter in memory by Guid comparison
                    // This handles case differences in SessionId storage
                    var allFailedMessages = await _context.Messages
                        .Where(m => m.Status == "failed" 
                            && !m.IsDeleted
                            && !string.IsNullOrEmpty(m.SessionId)
                            && (moderatorId == null || m.ModeratorId == moderatorId))
                        .ToListAsync();
                    
                    var sessionMessages = allFailedMessages
                        .Where(m => Guid.TryParse(m.SessionId, out var msgSessionId) && msgSessionId == sessionIdGuid)
                        .ToList();

                    _logger.LogInformation("[GetFailedSessions] Session {SessionId} has {Count} failed messages", 
                        session.Id, sessionMessages.Count);

                    var patientIds = sessionMessages
                        .Where(m => m.PatientId.HasValue)
                        .Select(m => m.PatientId!.Value)
                        .Distinct()
                        .ToList();

                    List<SessionPatientDto> patientDtos;
                    
                    if (patientIds.Count == 0)
                    {
                        // No patients found, create DTOs from messages directly
                        patientDtos = sessionMessages
                            .Where(m => m.PatientId.HasValue)
                            .Select(m => new SessionPatientDto
                            {
                                PatientId = m.PatientId!.Value,
                                MessageId = m.Id,
                                Name = m.FullName ?? "غير محدد",
                                Phone = m.PatientPhone ?? "",
                                CountryCode = m.CountryCode ?? "+966",
                                Status = "failed",
                                Attempts = m.Attempts,
                                FailedReason = m.ErrorMessage ?? "فشل الإرسال", // Ensure ErrorMessage is always set
                                MessageContent = m.Content // Include resolved message content
                            })
                            .ToList();
                    }
                    else
                    {
                        // Get patients from database (materialize first, then match messages in memory)
                        var patients = await _context.Patients
                            .Where(p => patientIds.Contains(p.Id))
                            .Select(p => new
                            {
                                p.Id,
                                p.FullName,
                                p.PhoneNumber,
                                p.CountryCode
                            })
                            .ToListAsync();

                        // Match messages to patients in memory (after materialization)
                        patientDtos = patients.Select(p =>
                        {
                            var message = sessionMessages
                                .Where(m => m.PatientId == p.Id)
                                .OrderByDescending(m => m.CreatedAt)
                                .FirstOrDefault();
                            
                            return new SessionPatientDto
                            {
                                PatientId = p.Id,
                                MessageId = message?.Id,
                                Name = p.FullName ?? "غير محدد",
                                Phone = p.PhoneNumber ?? "",
                                CountryCode = p.CountryCode ?? "+966",
                                Status = "failed",
                                Attempts = message?.Attempts ?? 0,
                                FailedReason = message?.ErrorMessage ?? "فشل الإرسال", // Ensure ErrorMessage is always set
                                MessageContent = message?.Content // Include resolved message content
                            };
                        }).ToList();
                    }

                    var dto = new FailedSessionDto
                    {
                        SessionId = session.Id,
                        QueueId = session.QueueId,
                        QueueName = session.Queue?.DoctorName ?? "غير محدد",
                        StartTime = session.StartTime,
                        Total = session.TotalMessages,
                        Failed = sessionMessages.Count,
                        Patients = patientDtos
                    };
                    
                    sessionDtos.Add(dto);
                    _logger.LogInformation("[GetFailedSessions] Successfully created DTO for session {SessionId}: QueueId={QueueId}, QueueName={QueueName}, Total={Total}, Failed={Failed}, Patients={Patients}",
                        session.Id, dto.QueueId, dto.QueueName, dto.Total, dto.Failed, dto.Patients.Count);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "[GetFailedSessions] ERROR processing session {SessionId}: {ExceptionType} - {Message}\n{StackTrace}", 
                        session.Id, ex.GetType().Name, ex.Message, ex.StackTrace);
                    // Continue with next session instead of failing completely
                    continue;
                }
            }
            
            _logger.LogInformation("[GetFailedSessions] Completed DTO creation. Created {Count} DTOs from {SessionCount} sessions", 
                sessionDtos.Count, sessions.Count);

            _logger.LogInformation("[GetFailedSessions] Returning {Count} session DTOs", sessionDtos.Count);
            if (sessionDtos.Count == 0 && sessions.Count > 0)
            {
                _logger.LogWarning("[GetFailedSessions] WARNING: Found {SessionCount} sessions but created 0 DTOs. This indicates a problem in DTO creation.", sessions.Count);
            }

            return Ok(new { success = true, data = sessionDtos });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching failed sessions. Exception: {ExceptionType}, Message: {Message}, StackTrace: {StackTrace}", 
                ex.GetType().Name, ex.Message, ex.StackTrace);
            return StatusCode(500, new { success = false, error = "حدث خطأ أثناء جلب الجلسات الفاشلة" });
        }
    }

    /// <summary>
    /// Get all completed message sessions for current user's moderator
    /// </summary>
    [HttpGet("completed")]
    public async Task<IActionResult> GetCompletedSessions()
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

            // Get current user to check role
            var currentUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (currentUser == null)
                return Unauthorized(new { success = false, error = "المستخدم غير موجود" });

            var isAdmin = currentUser.Role == "primary_admin" || currentUser.Role == "secondary_admin";

            // Get sessions based on role (unified per moderator, not per queue):
            // - Admins: See ALL completed sessions from ALL moderators
            // - Moderators/Users: See only their own/assigned moderator's completed sessions
            // Filter by Status = "completed" AND OngoingMessages == 0
            int? moderatorId;
            if (isAdmin)
            {
                moderatorId = null; // Admins see all sessions
            }
            else if (currentUser.Role == "moderator")
            {
                moderatorId = userId; // Moderators see their own sessions
            }
            else
            {
                // Regular users must have a ModeratorId assigned
                if (!currentUser.ModeratorId.HasValue)
                {
                    // User has no moderator assigned, return empty list
                    return Ok(new { success = true, data = new List<CompletedSessionDto>() });
                }
                moderatorId = currentUser.ModeratorId.Value;
            }
            
            var sessions = await _context.MessageSessions
                .Include(s => s.Queue)
                .Where(s => !s.IsDeleted 
                    && s.Status == "completed" 
                    && s.OngoingMessages == 0  // All messages processed
                    && s.SessionType != MessageSessionTypes.CheckWhatsApp  // Exclude check sessions
                    && (moderatorId == null || s.ModeratorId == moderatorId))
                .OrderByDescending(s => s.EndTime ?? s.StartTime)  // Most recent first
                .ToListAsync();

            var sessionDtos = new List<CompletedSessionDto>();

            foreach (var session in sessions)
            {
                try
                {
                    // Get session messages - handle case-insensitive SessionId comparison
                    var sessionIdString = session.Id.ToString();
                    var sessionIdGuid = session.Id;
                    
                    // Materialize all messages for this session first (handle case-insensitive GUID comparison)
                    var allSessionMessages = await _context.Messages
                        .Where(m => !m.IsDeleted && !string.IsNullOrEmpty(m.SessionId))
                        .ToListAsync();
                    
                    var sessionMessages = allSessionMessages
                        .Where(m => Guid.TryParse(m.SessionId, out var msgSessionId) && msgSessionId == sessionIdGuid)
                        .ToList();

                    // Filter to get only successfully sent messages (Status = "sent" AND ErrorMessage IS NULL)
                    var sentMessages = sessionMessages
                        .Where(m => m.Status == "sent" && string.IsNullOrEmpty(m.ErrorMessage))
                        .ToList();

                    // Get failed message count from MessageSession.FailedMessages (accurate, auto-updated)
                    var failedMessageCount = session.FailedMessages;

                    // Create SentMessageDto list
                    var sentMessageDtos = sentMessages
                        .Select(m => new SentMessageDto
                        {
                            MessageId = m.Id,
                            PatientId = m.PatientId ?? 0,
                            PatientName = m.FullName ?? "غير محدد",
                            PatientPhone = m.PatientPhone ?? "",
                            CountryCode = m.CountryCode ?? "+966",
                            Content = m.Content ?? "", // Already resolved content from database
                            SentAt = m.SentAt ?? m.UpdatedAt,
                            CreatedBy = m.CreatedBy,
                            UpdatedBy = m.UpdatedBy
                        })
                        .ToList();

                    sessionDtos.Add(new CompletedSessionDto
                    {
                        SessionId = session.Id,
                        QueueId = session.QueueId,
                        QueueName = session.Queue?.DoctorName ?? "غير محدد",
                        StartTime = session.StartTime,
                        CompletedAt = session.EndTime,
                        Total = session.TotalMessages,
                        Sent = session.SentMessages,
                        Failed = failedMessageCount,
                        HasFailedMessages = failedMessageCount > 0,
                        SentMessages = sentMessageDtos
                    });
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error processing session {SessionId} in GetCompletedSessions", session.Id);
                    continue; // Skip this session and continue with others
                }
            }

            return Ok(new { success = true, data = sessionDtos });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching completed sessions");
            return StatusCode(500, new { success = false, error = "حدث خطأ أثناء جلب الجلسات المكتملة" });
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
            "queued" => "queued",
            "sending" => "sending", // Keep "sending" status distinct for UI indicator
            _ => "queued"
        };
    }
}
