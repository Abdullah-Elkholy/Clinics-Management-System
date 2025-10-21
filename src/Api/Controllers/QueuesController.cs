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

        public QueuesController(
            ApplicationDbContext db, 
            QuotaService quotaService,
            ILogger<QueuesController> logger)
        {
            _db = db;
            _quotaService = quotaService;
            _logger = logger;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            // Return basic queue list with patient counts for UI
            var qs = await _db.Queues
                .AsNoTracking()
                .Select(q => new QueueDto {
                    Id = q.Id,
                    DoctorName = q.DoctorName,
                    Description = q.Description,
                    CreatedBy = q.CreatedBy,
                    CurrentPosition = q.CurrentPosition,
                    EstimatedWaitMinutes = q.EstimatedWaitMinutes,
                    PatientCount = _db.Patients.Count(p => p.QueueId == q.Id)
                }).ToListAsync();
            return Ok(new { success = true, data = qs });
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> Get(int id)
        {
            var q = await _db.Queues.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id);
            if (q == null) return NotFound(new { success = false });
            var dto = new QueueDto {
                Id = q.Id,
                DoctorName = q.DoctorName,
                Description = q.Description,
                CreatedBy = q.CreatedBy,
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
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
                if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
                {
                    return Unauthorized(new { success = false, error = "المستخدم غير مصرح له" });
                }

                // Check if user has sufficient queue quota
                var hasQuota = await _quotaService.HasQueuesQuotaAsync(userId);
                
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
                    Description = req.Description, 
                    CreatedBy = userId,
                    CurrentPosition = 1, 
                    EstimatedWaitMinutes = req.EstimatedWaitMinutes 
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
                    Description = q.Description, 
                    CreatedBy = q.CreatedBy, 
                    CurrentPosition = q.CurrentPosition, 
                    EstimatedWaitMinutes = q.EstimatedWaitMinutes, 
                    PatientCount = 0 
                };
                
                return CreatedAtAction(nameof(Get), new { id = q.Id }, new { success = true, queue = dto });
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
            q.Description = req.Description;
            if (req.EstimatedWaitMinutes.HasValue) q.EstimatedWaitMinutes = req.EstimatedWaitMinutes;
            if (req.CurrentPosition.HasValue) q.CurrentPosition = req.CurrentPosition.Value;
            await _db.SaveChangesAsync();
            return Ok(new { success = true, queue = q });
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "primary_admin,secondary_admin,moderator,user")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var q = await _db.Queues.FirstOrDefaultAsync(x => x.Id == id);
                if (q == null) return NotFound(new { success = false });

                // Get the user who created this queue to release their quota
                var createdByUserId = q.CreatedBy;

                // Remove related patients (simple cascade)
                var patients = await _db.Patients.Where(p => p.QueueId == id).ToListAsync();
                if (patients.Any()) _db.Patients.RemoveRange(patients);
                
                _db.Queues.Remove(q);
                await _db.SaveChangesAsync();

                // Release queue quota back to the user's moderator
                if (createdByUserId > 0)
                {
                    await _quotaService.ReleaseQueueQuotaAsync(createdByUserId);
                    _logger.LogInformation("Released queue quota for user {UserId} after deleting queue {QueueId}", 
                        createdByUserId, id);
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
    }
}
