using Microsoft.AspNetCore.Mvc;
using Clinics.Domain;
using Clinics.Infrastructure;
using Clinics.Api.DTOs;
using Clinics.Api.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace Clinics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class QueuesController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly QuotaService _quotaService;
        private readonly ILogger<QueuesController> _logger;
        private readonly Clinics.Api.Services.IQueueCascadeService _queueCascadeService;

        public QueuesController(
            ApplicationDbContext db, 
            QuotaService quotaService,
            ILogger<QueuesController> logger,
            Clinics.Api.Services.IQueueCascadeService queueCascadeService)
        {
            _db = db;
            _quotaService = quotaService;
            _logger = logger;
            _queueCascadeService = queueCascadeService;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            // Return basic queue list with patient counts for UI
            var qs = await _db.Queues
                .AsNoTracking()
                .Where(q => !q.IsDeleted)
                .Select(q => new QueueDto {
                    Id = q.Id,
                    DoctorName = q.DoctorName,
                    CreatedBy = q.CreatedBy,
                    ModeratorId = q.ModeratorId,
                    CurrentPosition = q.CurrentPosition,
                    EstimatedWaitMinutes = q.EstimatedWaitMinutes,
                    PatientCount = _db.Patients.Count(p => p.QueueId == q.Id)
                }).ToListAsync();
            return Ok(new { success = true, data = qs });
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> Get(int id)
        {
            var q = await _db.Queues.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id && !x.IsDeleted);
            if (q == null) return NotFound(new { success = false });
            var dto = new QueueDto {
                Id = q.Id,
                DoctorName = q.DoctorName,
                CreatedBy = q.CreatedBy,
                ModeratorId = q.ModeratorId,
                CurrentPosition = q.CurrentPosition,
                EstimatedWaitMinutes = q.EstimatedWaitMinutes,
                PatientCount = await _db.Patients.CountAsync(p => p.QueueId == q.Id)
            };
            return Ok(new { success = true, data = dto });
        }

        [HttpPost]
        [Authorize(Roles = "primary_admin,secondary_admin,moderator,user")]
        public async Task<IActionResult> Create([FromBody] QueueCreateRequest req)
        {
            try
            {
                if (!ModelState.IsValid)
                {
                    return BadRequest(new 
                    { 
                        success = false, 
                        errors = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage) 
                    });
                }

                // Get current user ID
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                    ?? User.FindFirst("sub")?.Value
                    ?? User.FindFirst("userId")?.Value;
                    
                if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
                {
                    return Unauthorized(new { success = false, error = "المستخدم غير مصرح له" });
                }

                // Get moderator ID for this user
                var moderatorId = await _quotaService.GetEffectiveModeratorIdAsync(userId);

                // Ensure quota exists for this moderator (create if missing with unlimited values)
                var quota = await _quotaService.GetOrCreateQuotaForModeratorAsync(moderatorId);

                // Check if user has sufficient queue quota
                var hasQuota = quota.RemainingQueues >= 1;
                
                if (!hasQuota)
                {
                    _logger.LogWarning("User {UserId} attempted to create queue but has insufficient quota", userId);
                    return BadRequest(new 
                    { 
                        success = false, 
                        error = "حصة الطوابير غير كافية",
                        code = "QUOTA_EXCEEDED"
                    });
                }

                var q = new Queue 
                { 
                    DoctorName = req.DoctorName, 
                    CreatedBy = userId,
                    ModeratorId = moderatorId,
                    CurrentPosition = 1, 
                    EstimatedWaitMinutes = req.EstimatedWaitMinutes ?? 15
                };
                
                _db.Queues.Add(q);
                await _db.SaveChangesAsync();

                // Consume queue quota after successful creation
                await _quotaService.ConsumeQueueQuotaAsync(userId);
                
                _logger.LogInformation("User {UserId} created queue {QueueId}, consumed quota", userId, q.Id);

                var dto = new QueueDto 
                { 
                    Id = q.Id, 
                    DoctorName = q.DoctorName, 
                    CreatedBy = q.CreatedBy,
                    ModeratorId = q.ModeratorId,
                    CurrentPosition = q.CurrentPosition, 
                    EstimatedWaitMinutes = q.EstimatedWaitMinutes, 
                    PatientCount = 0 
                };
                
                return CreatedAtAction(nameof(Get), new { id = q.Id }, new { success = true, data = dto, queue = dto });
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogError(ex, "Quota operation failed for user");
                return BadRequest(new { success = false, error = ex.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating queue");
                return StatusCode(500, new { success = false, error = "حدث خطأ أثناء إنشاء الطابور" });
            }
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "primary_admin,secondary_admin")]
        public async Task<IActionResult> Update(int id, [FromBody] QueueUpdateRequest req)
        {
            var q = await _db.Queues.FirstOrDefaultAsync(x => x.Id == id);
            if (q == null) return NotFound(new { success = false });
            q.DoctorName = req.DoctorName;
            if (req.EstimatedWaitMinutes.HasValue) q.EstimatedWaitMinutes = req.EstimatedWaitMinutes.Value;
            if (req.CurrentPosition.HasValue) q.CurrentPosition = req.CurrentPosition.Value;
            await _db.SaveChangesAsync();
            
            var dto = new QueueDto
            {
                Id = q.Id,
                DoctorName = q.DoctorName,
                CreatedBy = q.CreatedBy,
                ModeratorId = q.ModeratorId,
                CurrentPosition = q.CurrentPosition,
                EstimatedWaitMinutes = q.EstimatedWaitMinutes,
                PatientCount = _db.Patients.Count(p => p.QueueId == q.Id && !p.IsDeleted)
            };
            
            return Ok(new { success = true, data = dto, queue = dto });
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "primary_admin,secondary_admin,moderator,user")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var q = await _db.Queues.FirstOrDefaultAsync(x => x.Id == id);
                if (q == null) return NotFound(new { success = false });

                // If already deleted, return OK (idempotent)
                if (q.IsDeleted)
                    return Ok(new { success = true });

                // Get current user ID for audit
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
                
                // Soft-delete queue and cascade to related entities
                var (success, errorMessage) = await _queueCascadeService.SoftDeleteQueueAsync(id, userId);
                
                if (!success)
                {
                    return BadRequest(new { success = false, error = errorMessage });
                }

                // Release queue quota back to the user's moderator
                if (q.CreatedBy > 0)
                {
                    await _quotaService.ReleaseQueueQuotaAsync(q.CreatedBy);
                    _logger.LogInformation("Released queue quota for user {UserId} after soft-deleting queue {QueueId}", 
                        q.CreatedBy, id);
                }

                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting queue {QueueId}", id);
                return StatusCode(500, new { success = false, error = "حدث خطأ أثناء حذف الطابور" });
            }
        }

        // Reorder patients in a queue. Expects { positions: [ { id, position }, ... ] }
        [HttpPost("{id}/reorder")]
        [Authorize(Roles = "primary_admin,secondary_admin,moderator")]
        public async Task<IActionResult> Reorder(int id, [FromBody] ReorderRequest req)
        {
            if (req?.Positions == null || req.Positions.Length == 0) return BadRequest(new { success = false });
            var patientIds = req.Positions.Select(p => p.Id).ToArray();
            var patients = await _db.Patients.Where(p => p.QueueId == id && patientIds.Contains(p.Id)).ToListAsync();
            var posMap = req.Positions.ToDictionary(p => p.Id, p => p.Position);
            foreach(var p in patients)
            {
                if (posMap.TryGetValue(p.Id, out var newPos)) p.Position = newPos;
            }
            await _db.SaveChangesAsync();
            return Ok(new { success = true });
        }

        /// <summary>
        /// Get soft-deleted queues within the 30-day trash window.
        /// Moderators see only their queues; admins see all.
        /// </summary>
        [HttpGet("trash")]
        [Authorize(Roles = "primary_admin,secondary_admin,moderator")]
        public async Task<IActionResult> GetTrash([FromQuery] int page = 1, [FromQuery] int pageSize = 10)
        {
            try
            {
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
                var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
                if (user == null) return Unauthorized();

                var query = _db.Queues
                    .AsNoTracking()
                    .Where(q => q.IsDeleted && q.DeletedAt >= DateTime.UtcNow.AddDays(-30));

                // Non-admin users see only their own queues
                if (user.Role != "primary_admin" && user.Role != "secondary_admin")
                {
                    query = query.Where(q => q.ModeratorId == userId);
                }

                var total = await query.CountAsync();
                var trashQueues = await query
                    .OrderByDescending(q => q.DeletedAt)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(q => new
                    {
                        q.Id,
                        q.DoctorName,
                        q.ModeratorId,
                        DeletedAt = q.DeletedAt!.Value,
                        DaysRemainingInTrash = (int)Math.Ceiling((q.DeletedAt!.Value.AddDays(30) - DateTime.UtcNow).TotalDays),
                        DeletedBy = q.DeletedBy
                    })
                    .ToListAsync();

                return Ok(new { success = true, data = trashQueues, total, page, pageSize });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching trash queues");
                return StatusCode(500, new { success = false, error = "حدث خطأ أثناء جلب الطوابير المحذوفة" });
            }
        }

        /// <summary>
        /// Get soft-deleted queues older than 30 days (archived, read-only).
        /// Admin-only endpoint.
        /// </summary>
        [HttpGet("archived")]
        [Authorize(Roles = "primary_admin,secondary_admin")]
        public async Task<IActionResult> GetArchived([FromQuery] int page = 1, [FromQuery] int pageSize = 10)
        {
            try
            {
                var query = _db.Queues
                    .AsNoTracking()
                    .Where(q => q.IsDeleted && q.DeletedAt < DateTime.UtcNow.AddDays(-30));

                var total = await query.CountAsync();
                var archivedQueues = await query
                    .OrderByDescending(q => q.DeletedAt)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(q => new
                    {
                        q.Id,
                        q.DoctorName,
                        q.ModeratorId,
                        DeletedAt = q.DeletedAt!.Value,
                        DaysDeleted = (int)Math.Ceiling((DateTime.UtcNow - q.DeletedAt!.Value).TotalDays),
                        DeletedBy = q.DeletedBy,
                        Note = "Read-only: Restore window expired"
                    })
                    .ToListAsync();

                return Ok(new { success = true, data = archivedQueues, total, page, pageSize });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching archived queues");
                return StatusCode(500, new { success = false, error = "حدث خطأ أثناء جلب الطوابير المؤرشفة" });
            }
        }

        /// <summary>
        /// Restore a soft-deleted queue.
        /// Enforces 30-day restore TTL and quota checks.
        /// </summary>
        [HttpPost("{id}/restore")]
        [Authorize(Roles = "primary_admin,secondary_admin,moderator")]
        public async Task<IActionResult> Restore(int id)
        {
            try
            {
                var queue = await _db.Queues.FirstOrDefaultAsync(q => q.Id == id && q.IsDeleted);
                if (queue == null) 
                    return NotFound(new { success = false, error = "Queue not found or not deleted" });

                // Check if moderator owns this queue (non-admins only)
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
                var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
                if (user != null && user.Role != "primary_admin" && user.Role != "secondary_admin")
                {
                    if (queue.ModeratorId != userId)
                        return Forbid();
                }

                // Ensure quota exists for the queue's moderator before attempting restore
                await _quotaService.GetOrCreateQuotaForModeratorAsync(queue.ModeratorId);

                // Detach queue from DbContext before passing to UnitOfWork-based restore
                _db.Entry(queue).State = EntityState.Detached;

                // Attempt restore via cascade service
                var restoreResult = await _quotaService.RestoreQueueAsync(queue, userId);
                
                if (!restoreResult.Success)
                {
                    return StatusCode(restoreResult.StatusCode, new 
                    { 
                        success = false, 
                        error = restoreResult.Message,
                        errorCode = restoreResult.ErrorCode,
                        metadata = restoreResult.Metadata
                    });
                }

                await _db.SaveChangesAsync();
                return Ok(new { success = true, data = queue });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error restoring queue {QueueId}", id);
                return StatusCode(500, new { success = false, error = "حدث خطأ أثناء استعادة الطابور" });
            }
        }
    }
}

