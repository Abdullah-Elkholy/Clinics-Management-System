using Microsoft.AspNetCore.Mvc;
using Clinics.Domain;
using Clinics.Infrastructure;
using Clinics.Api.DTOs;
using Clinics.Api.Services;
using Clinics.Infrastructure.Repositories;
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
        private readonly IWebHostEnvironment _env;
        private readonly ISoftDeleteTTLQueries<Queue> _ttlQueries;

        public QueuesController(
            ApplicationDbContext db, 
            QuotaService quotaService,
            ILogger<QueuesController> logger,
            Clinics.Api.Services.IQueueCascadeService queueCascadeService,
            IWebHostEnvironment env,
            IGenericUnitOfWork unitOfWork)
        {
            _db = db;
            _quotaService = quotaService;
            _logger = logger;
            _queueCascadeService = queueCascadeService;
            _env = env;
            _ttlQueries = unitOfWork.TTLQueries<Queue>();
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
                // Log DB target for diagnostics
                try
                {
                    var conn = _db.Database.GetDbConnection();
                    _logger.LogInformation("DB Target: Provider={Provider}, DataSource={DataSource}, Database={Database}", _db.Database.ProviderName, conn.DataSource, conn.Database);
                }
                catch { }

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
                    ?? User.FindFirst("nameid")?.Value
                    ?? User.FindFirst("sub")?.Value
                    ?? User.FindFirst("userId")?.Value
                    ?? User.FindFirst("id")?.Value
                    ?? User.FindFirst("Id")?.Value;
                    
                if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
                {
                    return Unauthorized(new { success = false, error = "المستخدم غير مصرح له" });
                }

                // Determine if caller is admin
                var isAdmin = User.IsInRole("primary_admin") || User.IsInRole("secondary_admin");

                int moderatorId;
                if (isAdmin && req.ModeratorId.HasValue)
                {
                    _logger.LogInformation("CreateQueue(Admin): userId={UserId}, targetModeratorId={TargetModeratorId}, doctorName={DoctorName}", userId, req.ModeratorId, req.DoctorName);
                    // Admin can specify the target moderator
                    moderatorId = req.ModeratorId.Value;

                    // Validate target moderator exists and is a moderator
                    var targetModerator = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == moderatorId && u.Role == "moderator" && !u.IsDeleted);
                    if (targetModerator == null)
                    {
                        return BadRequest(new
                        {
                            success = false,
                            error = "المشرف المحدد غير موجود"
                        });
                    }

                    // Ensure quota exists for this moderator (create if missing with unlimited values)
                    var quota = await _quotaService.GetOrCreateQuotaForModeratorAsync(moderatorId);

                    // Check if moderator has sufficient queue quota (unlimited (-1) always has enough)
                    var hasQuota = quota.QueuesQuota == -1 || quota.RemainingQueues >= 1;
                    if (!hasQuota)
                    {
                        _logger.LogWarning("Admin {UserId} attempted to create queue for moderator {ModeratorId} but insufficient quota", userId, moderatorId);
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
                        CreatedBy = userId, // audit who performed the action
                        ModeratorId = moderatorId,
                        CurrentPosition = 1,
                        EstimatedWaitMinutes = req.EstimatedWaitMinutes ?? 15
                    };

                    _db.Queues.Add(q);
                    await _db.SaveChangesAsync();

                    // Consume quota for the specified moderator
                    await _quotaService.ConsumeQueueQuotaForModeratorAsync(moderatorId);

                    _logger.LogInformation("Admin {UserId} created queue {QueueId} for moderator {ModeratorId}, consumed quota", userId, q.Id, moderatorId);

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
                else
                {
                    // Non-admin flow: moderators and users can create queues under their moderator's quota
                    // Users create queues related to their assigned moderator (ModeratorId)
                    moderatorId = await _quotaService.GetEffectiveModeratorIdAsync(userId);

                    _logger.LogInformation("CreateQueue(User/mod): userId={UserId}, effectiveModeratorId={ModeratorId}, doctorName={DoctorName}", userId, moderatorId, req.DoctorName);

                    // Validate moderator exists (defensive; GetEffectiveModeratorIdAsync should ensure mapping)
                    var targetModerator = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == moderatorId && u.Role == "moderator" && !u.IsDeleted);
                    if (targetModerator == null)
                    {
                        // Check if moderator exists but is deleted or has wrong role
                        var moderatorCheck = await _db.Users.AsNoTracking().FirstOrDefaultAsync(u => u.Id == moderatorId);
                        if (moderatorCheck == null)
                        {
                            _logger.LogError("Effective moderator {ModeratorId} for user {UserId} does not exist in database", moderatorId, userId);
                            return BadRequest(new { success = false, error = "المشرف المرتبط غير موجود في قاعدة البيانات" });
                        }
                        else if (moderatorCheck.IsDeleted)
                        {
                            _logger.LogWarning("Effective moderator {ModeratorId} for user {UserId} is soft-deleted", moderatorId, userId);
                            return BadRequest(new { success = false, error = "المشرف المرتبط تم حذفه" });
                        }
                        else if (moderatorCheck.Role != "moderator")
                        {
                            _logger.LogWarning("Effective moderator {ModeratorId} for user {UserId} has role {Role} instead of 'moderator'", moderatorId, userId, moderatorCheck.Role);
                            return BadRequest(new { success = false, error = "المستخدم المرتبط ليس مشرفاً" });
                        }
                        
                        _logger.LogWarning("Effective moderator {ModeratorId} for user {UserId} not found (unknown reason)", moderatorId, userId);
                        return BadRequest(new { success = false, error = "لا يمكن تحديد المشرف المرتبط بالمستخدم" });
                    }

                    // Ensure quota exists for this moderator (create if missing with unlimited values)
                    var quota = await _quotaService.GetOrCreateQuotaForModeratorAsync(moderatorId);

                    // Check if user has sufficient queue quota (unlimited (-1) always has enough)
                    var hasQuota = quota.QueuesQuota == -1 || quota.RemainingQueues >= 1;

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

                    // Consume queue quota after successful creation (user-based method)
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
            }
            catch (InvalidOperationException ex)
            {
                _logger.LogError(ex, "Quota operation failed for user");
                return BadRequest(new { success = false, error = ex.Message });
            }
            catch (DbUpdateException dbEx)
            {
                _logger.LogError(dbEx, "DB error creating queue");
                var msg = dbEx.InnerException?.Message ?? dbEx.Message;
                if (msg.Contains("FOREIGN KEY", StringComparison.OrdinalIgnoreCase) || msg.Contains("constraint", StringComparison.OrdinalIgnoreCase))
                {
                    return BadRequest(new { success = false, error = "تعذر إنشاء الطابور بسبب مرجع غير صالح (المشرف غير موجود)" });
                }
                if (_env.IsDevelopment())
                {
                    try
                    {
                        var conn = _db.Database.GetDbConnection();
                        return StatusCode(500, new { success = false, error = "حدث خطأ أثناء إنشاء الطابور", details = msg, db = new { provider = _db.Database.ProviderName, dataSource = conn.DataSource, database = conn.Database } });
                    }
                    catch
                    {
                        return StatusCode(500, new { success = false, error = "حدث خطأ أثناء إنشاء الطابور", details = msg });
                    }
                }
                return StatusCode(500, new { success = false, error = "حدث خطأ أثناء إنشاء الطابور" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating queue");
                if (_env.IsDevelopment())
                {
                    try
                    {
                        var conn = _db.Database.GetDbConnection();
                        return StatusCode(500, new { success = false, error = "حدث خطأ أثناء إنشاء الطابور", details = ex.Message, stackTrace = ex.StackTrace, db = new { provider = _db.Database.ProviderName, dataSource = conn.DataSource, database = conn.Database } });
                    }
                    catch
                    {
                        return StatusCode(500, new { success = false, error = "حدث خطأ أثناء إنشاء الطابور", details = ex.Message, stackTrace = ex.StackTrace });
                    }
                }
                return StatusCode(500, new { success = false, error = "حدث خطأ أثناء إنشاء الطابور" });
            }
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "primary_admin,secondary_admin")]
        public async Task<IActionResult> Update(int id, [FromBody] QueueUpdateRequest req)
        {
            // Get current user ID for audit
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                ?? User.FindFirst("nameid")?.Value
                ?? User.FindFirst("sub")?.Value
                ?? User.FindFirst("userId")?.Value
                ?? User.FindFirst("id")?.Value
                ?? User.FindFirst("Id")?.Value;
            
            if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
            {
                return Unauthorized(new { success = false, error = "المستخدم غير مصرح له" });
            }

            var q = await _db.Queues.FirstOrDefaultAsync(x => x.Id == id);
            if (q == null) return NotFound(new { success = false });
            q.DoctorName = req.DoctorName;
            if (req.EstimatedWaitMinutes.HasValue) q.EstimatedWaitMinutes = req.EstimatedWaitMinutes.Value;
            if (req.CurrentPosition.HasValue) q.CurrentPosition = req.CurrentPosition.Value;
            
            // Set UpdatedAt and UpdatedBy for audit trail
            q.UpdatedAt = DateTime.UtcNow;
            q.UpdatedBy = userId;
            
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
                return StatusCode(500, new { success = false, error = "حدث خطأ أثناء حذف الطابور", message = "حدث خطأ أثناء حذف الطابور." });
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

                var query = _ttlQueries.QueryTrash(30).AsQueryable();

                // Exclude queues whose moderator is deleted (cascade delete scenario)
                // Queues deleted as part of moderator deletion should not appear in trash
                // This ensures only the moderator appears in trash, not its queues
                query = query.Where(q => 
                    !_db.Users.IgnoreQueryFilters().Any(m => 
                        m.Id == q.ModeratorId && 
                        m.Role == "moderator" &&
                        m.IsDeleted));

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
                        DaysRemainingInTrash = _ttlQueries.GetDaysRemainingInTrash(q, 30),
                        DeletedBy = q.DeletedBy
                    })
                    .ToListAsync();

                return Ok(new { success = true, data = trashQueues, total, page, pageSize });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching trash queues");
                return StatusCode(500, new { success = false, error = "حدث خطأ أثناء جلب الطوابير المحذوفة", message = "حدث خطأ أثناء جلب الطوابير المحذوفة." });
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
                var query = _ttlQueries.QueryArchived(30).AsQueryable();

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
                return StatusCode(500, new { success = false, error = "حدث خطأ أثناء جلب الطوابير المؤرشفة", message = "حدث خطأ أثناء جلب الطوابير المؤرشفة." });
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
                var queue = await _db.Queues.IgnoreQueryFilters().FirstOrDefaultAsync(q => q.Id == id);
                if (queue == null) 
                    return NotFound(new { success = false, error = "الطابور غير موجود", message = "الطابور غير موجود.", statusCode = 404 });

                // Check if queue is deleted
                if (!queue.IsDeleted)
                    return BadRequest(new { success = false, error = "الطابور غير موجود في سلة المحذوفات", message = "الطابور غير موجود في سلة المحذوفات.", statusCode = 400 });

                // Check TTL - only allow restore for items in trash (within 30 days)
                if (!_ttlQueries.IsRestoreAllowed(queue, 30))
                {
                    var daysElapsed = queue.DeletedAt.HasValue
                        ? (int)(DateTime.UtcNow - queue.DeletedAt.Value).TotalDays
                        : 0;
                    return Conflict(new
                    {
                        success = false,
                        error = "restore_window_expired",
                        message = "لا يمكن استعادة الطابور بعد 30 يومًا من الحذف",
                        statusCode = 409,
                        metadata = new { daysElapsed, ttlDays = 30 }
                    });
                }

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
                return StatusCode(500, new { success = false, error = "حدث خطأ أثناء استعادة الطابور", message = "حدث خطأ أثناء استعادة الطابور." });
                return StatusCode(500, new { success = false, error = "حدث خطأ أثناء استعادة الطابور" });
            }
        }
    }
}

