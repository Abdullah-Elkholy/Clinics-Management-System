using Microsoft.AspNetCore.Mvc;
using Clinics.Infrastructure;
using Clinics.Domain;
using Clinics.Api.DTOs;
using Clinics.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Clinics.Api.Controllers
{
    /// <summary>
    /// API endpoints for managing failed tasks that require retry
    /// Failed tasks are messages that couldn't be sent and need user intervention
    /// </summary>
    [ApiController]
    [Route("api/failed-tasks")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public class FailedTasksController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly IUserContext _userContext;
        private readonly ILogger<FailedTasksController> _logger;

        public FailedTasksController(
            ApplicationDbContext db,
            IUserContext userContext,
            ILogger<FailedTasksController> logger)
        {
            _db = db;
            _userContext = userContext;
            _logger = logger;
        }

        /// <summary>
        /// Get failed tasks with pagination
        /// Optional: filter by queueId or moderatorUserId (if not provided, returns all failed tasks accessible to user)
        /// </summary>
        /// <param name="queueId">Optional queue ID to filter by</param>
        /// <param name="moderatorUserId">Optional moderator user ID to filter by</param>
        /// <param name="pageNumber">Page number (1-indexed), default 1</param>
        /// <param name="pageSize">Items per page, default 10, max 100</param>
        /// <returns>Paginated list of failed tasks</returns>
        [HttpGet]
        public async Task<ActionResult<PaginatedFailedTasksResponse>> GetFailedTasks(
            [FromQuery] int? queueId,
            [FromQuery] int? moderatorUserId,
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 10)
        {
            try
            {
                // Validate pagination parameters
                if (pageNumber < 1) pageNumber = 1;
                if (pageSize < 1 || pageSize > 100) pageSize = 10;

                // Query failed messages from Message table (Status != "Sent" and Status != null)
                var query = _db.Messages
                    .AsNoTracking()
                    .AsQueryable();

                // Filter by status - failed tasks are those not successfully sent
                query = query.Where(m => m.Status != "Sent" && m.Status != null);

                // Filter by queue if provided
                if (queueId.HasValue)
                {
                    query = query.Where(m => m.QueueId == queueId.Value);
                }

                // Filter by moderator if provided
                if (moderatorUserId.HasValue)
                {
                    query = query.Where(m => m.ModeratorId == moderatorUserId.Value);
                }

                // Authorization: Check if user can access these tasks
                // - Admins can see all failed tasks
                // - Moderators can see failed tasks from their queues
                var role = _userContext.GetRole();
                if (role == "moderator" || role == "user")
                {
                    var moderatorId = _userContext.GetModeratorId();
                    
                    // Moderators see their own queues' failed tasks
                    if (role == "moderator" && moderatorId.HasValue)
                    {
                        query = query.Where(m => m.Queue != null && m.Queue.ModeratorId == moderatorId.Value);
                    }
                }

                // Get total count before pagination
                var totalCount = await query.CountAsync();

                // Apply pagination and load related data
                var failedTasks = await query
                    .Include(m => m.Queue)
                    .Include(m => m.Template)
                    .Include(m => m.Moderator)
                    .OrderByDescending(m => m.CreatedAt)
                    .ThenByDescending(m => m.LastAttemptAt)
                    .Skip((pageNumber - 1) * pageSize)
                    .Take(pageSize)
                    .ToListAsync();

                // Map to DTOs
                var dtos = failedTasks.Select(m => new FailedTaskDto
                {
                    Id = (int)m.Id,
                    QueueId = m.QueueId ?? 0,
                    QueueName = m.Queue?.DoctorName ?? "Unknown",
                    ModeratorId = m.ModeratorId ?? 0,
                    ModeratorName = m.Moderator != null ? $"{m.Moderator.FirstName} {m.Moderator.LastName}".Trim() : "Unknown",
                    PatientPhone = m.PatientPhone ?? "",
                    MessageContent = m.Template?.Content ?? m.Content ?? "",
                    Attempts = m.Attempts,
                    ErrorMessage = m.ErrorMessage,
                    Status = m.Status ?? "Unknown",
                    CreatedAt = m.CreatedAt,
                    LastAttemptAt = m.LastAttemptAt
                }).ToList();

                return Ok(new PaginatedFailedTasksResponse
                {
                    Items = dtos,
                    TotalCount = totalCount,
                    PageNumber = pageNumber,
                    PageSize = pageSize
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching failed tasks");
                return StatusCode(500, new { message = "Error fetching failed tasks" });
            }
        }

        /// <summary>
        /// Get a single failed task by ID
        /// </summary>
        /// <param name="id">Message/task ID</param>
        /// <returns>Failed task details</returns>
        [HttpGet("{id}")]
        public async Task<ActionResult<FailedTaskDto>> GetFailedTask(int id)
        {
            try
            {
                var message = await _db.Messages
                    .Include(m => m.Queue)
                    .Include(m => m.Template)
                    .Include(m => m.Moderator)
                    .FirstOrDefaultAsync(m => m.Id == id);

                if (message == null)
                    return NotFound(new { message = "Task not found" });

                // Check authorization
                var role = _userContext.GetRole();
                if (role == "moderator" || role == "user")
                {
                    var moderatorId = _userContext.GetModeratorId();
                    if (role == "moderator" && message.Queue?.ModeratorId != moderatorId)
                        return Forbid();
                }

                var dto = new FailedTaskDto
                {
                    Id = (int)message.Id,
                    QueueId = message.QueueId ?? 0,
                    QueueName = message.Queue?.DoctorName ?? "Unknown",
                    ModeratorId = message.ModeratorId ?? 0,
                    ModeratorName = message.Moderator != null ? $"{message.Moderator.FirstName} {message.Moderator.LastName}".Trim() : "Unknown",
                    PatientPhone = message.PatientPhone ?? "",
                    MessageContent = message.Template?.Content ?? message.Content ?? "",
                    Attempts = message.Attempts,
                    ErrorMessage = message.ErrorMessage,
                    Status = message.Status ?? "Unknown",
                    CreatedAt = message.CreatedAt,
                    LastAttemptAt = message.LastAttemptAt
                };

                return Ok(dto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching failed task {Id}", id);
                return StatusCode(500, new { message = "Error fetching task" });
            }
        }

        /// <summary>
        /// Retry a failed task (attempt to send it again)
        /// IMPORTANT: Validates WhatsApp number before retrying
        /// </summary>
        /// <param name="id">Message/task ID to retry</param>
        /// <returns>Updated task details</returns>
        [HttpPost("{id}/retry")]
        public async Task<ActionResult<FailedTaskDto>> RetryFailedTask(int id)
        {
            try
            {
                var message = await _db.Messages
                    .Include(m => m.Queue)
                    .Include(m => m.Template)
                    .Include(m => m.Moderator)
                    .FirstOrDefaultAsync(m => m.Id == id);

                if (message == null)
                    return NotFound(new { message = "Task not found" });

                // Check authorization
                var role = _userContext.GetRole();
                if (role == "moderator" || role == "user")
                {
                    var moderatorId = _userContext.GetModeratorId();
                    if (role == "moderator" && message.Queue?.ModeratorId != moderatorId)
                        return Forbid();
                }

                // CRITICAL: Validate WhatsApp number before retrying
                // Get patient to check IsValidWhatsAppNumber
                if (message.PatientId.HasValue)
                {
                    var patient = await _db.Patients.FindAsync(message.PatientId.Value);
                    
                    if (patient != null)
                    {
                        // If IsValidWhatsAppNumber is null or false, reject retry
                        if (!patient.IsValidWhatsAppNumber.HasValue || patient.IsValidWhatsAppNumber.Value == false)
                        {
                            _logger.LogWarning("Retry rejected for message {MessageId} - Patient {PatientId} has unvalidated WhatsApp number (IsValidWhatsAppNumber: {IsValid})", 
                                id, patient.Id, patient.IsValidWhatsAppNumber);
                            
                            return BadRequest(new 
                            { 
                                success = false,
                                error = "WhatsAppValidationRequired",
                                message = $"رقم الواتساب للمريض غير محقق. يجب التحقق من رقم الواتساب أولاً باستخدام زر 'التحقق من الرقم' قبل إعادة المحاولة.",
                                patientId = patient.Id,
                                patientName = patient.FullName,
                                phoneNumber = patient.PhoneNumber,
                                isValidWhatsAppNumber = patient.IsValidWhatsAppNumber
                            });
                        }
                    }
                }

                // Update message for retry
                // Status "queued" will be picked up by MessageProcessor
                message.LastAttemptAt = DateTime.UtcNow;
                message.Status = "queued"; // Reset to queued for retry
                message.IsPaused = false; // Unpause if it was paused
                message.PausedAt = null;
                message.PauseReason = null;
                
                await _db.SaveChangesAsync();

                var dto = new FailedTaskDto
                {
                    Id = (int)message.Id,
                    QueueId = message.QueueId ?? 0,
                    QueueName = message.Queue?.DoctorName ?? "Unknown",
                    ModeratorId = message.ModeratorId ?? 0,
                    ModeratorName = message.Moderator != null ? $"{message.Moderator.FirstName} {message.Moderator.LastName}".Trim() : "Unknown",
                    PatientPhone = message.PatientPhone ?? "",
                    MessageContent = message.Template?.Content ?? message.Content ?? "",
                    Attempts = message.Attempts,
                    ErrorMessage = message.ErrorMessage,
                    Status = message.Status ?? "Unknown",
                    CreatedAt = message.CreatedAt,
                    LastAttemptAt = message.LastAttemptAt
                };

                return Ok(dto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error retrying failed task {Id}", id);
                return StatusCode(500, new { message = "Error retrying task" });
            }
        }

        /// <summary>
        /// Mark a failed task as dismissed/acknowledged
        /// </summary>
        /// <param name="id">Message/task ID to dismiss</param>
        /// <returns>No content</returns>
        [HttpPost("{id}/dismiss")]
        public async Task<IActionResult> DismissFailedTask(int id)
        {
            try
            {
                var message = await _db.Messages
                    .Include(m => m.Queue)
                    .FirstOrDefaultAsync(m => m.Id == id);

                if (message == null)
                    return NotFound(new { message = "Task not found" });

                // Check authorization
                var role = _userContext.GetRole();
                if (role == "moderator" || role == "user")
                {
                    var moderatorId = _userContext.GetModeratorId();
                    if (role == "moderator" && message.Queue?.ModeratorId != moderatorId)
                        return Forbid();
                }

                // Mark as dismissed
                message.Status = "Dismissed";
                message.UpdatedAt = DateTime.UtcNow;
                
                await _db.SaveChangesAsync();

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error dismissing failed task {Id}", id);
                return StatusCode(500, new { message = "Error dismissing task" });
            }
        }
    }
}
