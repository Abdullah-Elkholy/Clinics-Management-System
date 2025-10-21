using Microsoft.AspNetCore.Mvc;
using Clinics.Infrastructure;
using Clinics.Domain;
using Clinics.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Clinics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Microsoft.AspNetCore.Authorization.Authorize]
    public class QuotasController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly QuotaService _quotaService;
        private readonly ILogger<QuotasController> _logger;

        public QuotasController(ApplicationDbContext db, QuotaService quotaService, ILogger<QuotasController> logger)
        {
            _db = db;
            _quotaService = quotaService;
            _logger = logger;
        }

        /// <summary>
        /// Get all quotas (admin only)
        /// </summary>
        [HttpGet]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin")]
        public async Task<IActionResult> GetAll()
        {
            try
            {
                var quotas = await _db.Quotas
                    .Include(q => q.Moderator)
                    .Select(q => new
                    {
                        q.Id,
                        q.ModeratorUserId,
                        ModeratorName = q.Moderator != null ? q.Moderator.FullName : "Unknown",
                        ModeratorUsername = q.Moderator != null ? q.Moderator.Username : "",
                        q.MessagesQuota,
                        q.ConsumedMessages,
                        RemainingMessages = q.MessagesQuota - q.ConsumedMessages,
                        q.QueuesQuota,
                        q.ConsumedQueues,
                        RemainingQueues = q.QueuesQuota - q.ConsumedQueues,
                        q.UpdatedAt,
                        IsMessagesQuotaLow = q.MessagesQuota > 0 && ((q.MessagesQuota - q.ConsumedMessages) * 100.0 / q.MessagesQuota) < 10,
                        IsQueuesQuotaLow = q.QueuesQuota > 0 && ((q.QueuesQuota - q.ConsumedQueues) * 100.0 / q.QueuesQuota) < 10
                    })
                    .ToListAsync();

                return Ok(new { success = true, data = quotas });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching quotas");
                return StatusCode(500, new { success = false, error = "حدث خطأ أثناء جلب بيانات الحصص" });
            }
        }

        /// <summary>
        /// Get quota for current user (their moderator's quota)
        /// </summary>
        [HttpGet("me")]
        public async Task<IActionResult> GetMyQuota()
        {
            try
            {
                var userIdClaim = User.FindFirst("userId")?.Value;
                if (userIdClaim == null || !int.TryParse(userIdClaim, out int userId))
                    return Unauthorized(new { success = false, error = "غير مصرح" });

                var quota = await _quotaService.GetQuotaForUserAsync(userId);
                
                if (quota == null)
                {
                    return Ok(new
                    {
                        success = true,
                        data = new
                        {
                            messagesQuota = 0,
                            consumedMessages = 0,
                            remainingMessages = 0,
                            queuesQuota = 0,
                            consumedQueues = 0,
                            remainingQueues = 0,
                            isMessagesQuotaLow = false,
                            isQueuesQuotaLow = false,
                            hasUnlimitedQuota = true
                        }
                    });
                }

                return Ok(new
                {
                    success = true,
                    data = new
                    {
                        messagesQuota = quota.MessagesQuota,
                        consumedMessages = quota.ConsumedMessages,
                        remainingMessages = quota.RemainingMessages,
                        queuesQuota = quota.QueuesQuota,
                        consumedQueues = quota.ConsumedQueues,
                        remainingQueues = quota.RemainingQueues,
                        isMessagesQuotaLow = quota.IsMessagesQuotaLow,
                        isQueuesQuotaLow = quota.IsQueuesQuotaLow,
                        hasUnlimitedQuota = false
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching user quota");
                return StatusCode(500, new { success = false, error = "حدث خطأ أثناء جلب بيانات الحصة" });
            }
        }

        /// <summary>
        /// Add quota to moderator (admin only)
        /// </summary>
        [HttpPost("{moderatorId}/add")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin")]
        public async Task<IActionResult> AddQuota(int moderatorId, [FromBody] AddQuotaRequest request)
        {
            try
            {
                if (request.AddMessages < 0 || request.AddQueues < 0)
                    return BadRequest(new { success = false, error = "القيم يجب أن تكون موجبة" });

                await _quotaService.AddQuotaAsync(moderatorId, request.AddMessages, request.AddQueues);

                return Ok(new { success = true, message = "تم إضافة الحصة بنجاح" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding quota");
                return StatusCode(500, new { success = false, error = "حدث خطأ أثناء إضافة الحصة" });
            }
        }

        /// <summary>
        /// Update moderator quota (admin only)
        /// </summary>
        [HttpPut("{moderatorId}")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin")]
        public async Task<IActionResult> Update(int moderatorId, [FromBody] UpdateQuotaRequest request)
        {
            try
            {
                var existing = await _db.Quotas.FirstOrDefaultAsync(q => q.ModeratorUserId == moderatorId);
                
                if (existing == null)
                {
                    existing = new Quota
                    {
                        ModeratorUserId = moderatorId,
                        MessagesQuota = request.MessagesQuota,
                        ConsumedMessages = 0,
                        QueuesQuota = request.QueuesQuota,
                        ConsumedQueues = 0,
                        UpdatedAt = DateTime.UtcNow
                    };
                    _db.Quotas.Add(existing);
                }
                else
                {
                    existing.MessagesQuota = request.MessagesQuota;
                    existing.QueuesQuota = request.QueuesQuota;
                    existing.UpdatedAt = DateTime.UtcNow;
                }
                
                await _db.SaveChangesAsync();
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating quota");
                return StatusCode(500, new { success = false, error = "حدث خطأ أثناء تحديث الحصة" });
            }
        }
    }

    public class AddQuotaRequest
    {
        public int AddMessages { get; set; }
        public int AddQueues { get; set; }
    }

    public class UpdateQuotaRequest
    {
        public int MessagesQuota { get; set; }
        public int QueuesQuota { get; set; }
    }
}
