using Microsoft.AspNetCore.Mvc;
using Clinics.Infrastructure;
using Clinics.Domain;
using Clinics.Api.DTOs;
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
        private readonly IUserContext _userContext;
        private readonly ILogger<QuotasController> _logger;

        public QuotasController(ApplicationDbContext db, QuotaService quotaService, IUserContext userContext, ILogger<QuotasController> logger)
        {
            _db = db;
            _quotaService = quotaService;
            _userContext = userContext;
            _logger = logger;
        }

        /// <summary>
        /// Get all quotas (admin only)
        /// Returns DTOs with renamed fields: limit, used, remaining, percentage
        /// </summary>
        [HttpGet]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin")]
        public async Task<ActionResult<ListResponse<QuotaDto>>> GetAll()
        {
            try
            {
                var quotas = await _db.Quotas
                    .Include(q => q.Moderator)
                    .OrderBy(q => q.ModeratorUserId)
                    .ToListAsync();

                var dtos = quotas.Select(q => new QuotaDto
                {
                    Id = q.Id,
                    Limit = q.MessagesQuota,
                    Used = q.ConsumedMessages,
                    QueuesLimit = q.QueuesQuota,
                    QueuesUsed = q.ConsumedQueues,
                    UpdatedAt = q.UpdatedAt
                }).ToList();

                return Ok(new ListResponse<QuotaDto>
                {
                    Items = dtos,
                    TotalCount = dtos.Count,
                    PageNumber = 1,
                    PageSize = dtos.Count
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching quotas");
                return StatusCode(500, new { message = "Error fetching quotas" });
            }
        }

        /// <summary>
        /// Get quota for current user (their moderator's quota)
        /// Returns renamed fields: limit (messagesQuota), used (consumedMessages)
        /// </summary>
        [HttpGet("me")]
        public async Task<ActionResult<MyQuotaDto>> GetMyQuota()
        {
            try
            {
                var userId = _userContext.GetUserId();
                var quota = await _quotaService.GetQuotaForUserAsync(userId);
                
                if (quota == null)
                {
                    return Ok(new MyQuotaDto
                    {
                        Limit = 0,
                        Used = 0,
                        QueuesLimit = 0,
                        QueuesUsed = 0
                    });
                }

                return Ok(new MyQuotaDto
                {
                    Limit = quota.MessagesQuota,
                    Used = quota.ConsumedMessages,
                    QueuesLimit = quota.QueuesQuota,
                    QueuesUsed = quota.ConsumedQueues
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching user quota");
                return StatusCode(500, new { message = "Error fetching quota" });
            }
        }

        /// <summary>
        /// Add quota to moderator (admin only)
        /// </summary>
        [HttpPost("{moderatorId}/add")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin")]
        public async Task<ActionResult<MyQuotaDto>> AddQuota(int moderatorId, [FromBody] AddQuotaRequest request)
        {
            try
            {
                if (request.Limit <= 0 || request.QueuesLimit <= 0)
                    return BadRequest(new { message = "Limit and QueuesLimit must be greater than 0" });

                var existing = await _db.Quotas.FirstOrDefaultAsync(q => q.ModeratorUserId == moderatorId);
                
                if (existing != null)
                    return BadRequest(new { message = "Quota already exists for this moderator" });

                var quota = new Quota
                {
                    ModeratorUserId = moderatorId,
                    MessagesQuota = request.Limit,
                    ConsumedMessages = 0,
                    QueuesQuota = request.QueuesLimit,
                    ConsumedQueues = 0,
                    UpdatedAt = DateTime.UtcNow
                };

                _db.Quotas.Add(quota);
                await _db.SaveChangesAsync();

                return Ok(new MyQuotaDto
                {
                    Limit = quota.MessagesQuota,
                    Used = quota.ConsumedMessages,
                    QueuesLimit = quota.QueuesQuota,
                    QueuesUsed = quota.ConsumedQueues
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding quota");
                return StatusCode(500, new { message = "Error adding quota" });
            }
        }

        /// <summary>
        /// Update moderator quota (admin only)
        /// </summary>
        [HttpPut("{moderatorId}")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin")]
        public async Task<ActionResult<MyQuotaDto>> Update(int moderatorId, [FromBody] UpdateQuotaRequest request)
        {
            try
            {
                var existing = await _db.Quotas.FirstOrDefaultAsync(q => q.ModeratorUserId == moderatorId);
                
                if (existing == null)
                    return NotFound(new { message = "Quota not found for this moderator" });

                // Update only provided fields
                if (request.Limit.HasValue && request.Limit.Value > 0)
                    existing.MessagesQuota = request.Limit.Value;
                
                if (request.QueuesLimit.HasValue && request.QueuesLimit.Value > 0)
                    existing.QueuesQuota = request.QueuesLimit.Value;
                
                existing.UpdatedAt = DateTime.UtcNow;
                
                await _db.SaveChangesAsync();
                
                return Ok(new MyQuotaDto
                {
                    Limit = existing.MessagesQuota,
                    Used = existing.ConsumedMessages,
                    QueuesLimit = existing.QueuesQuota,
                    QueuesUsed = existing.ConsumedQueues
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating quota");
                return StatusCode(500, new { message = "Error updating quota" });
            }
        }
    }
}
