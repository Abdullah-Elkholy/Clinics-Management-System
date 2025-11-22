using Microsoft.AspNetCore.Mvc;
using Clinics.Infrastructure;
using Clinics.Domain;
using Clinics.Api.DTOs;
using Clinics.Api.Services;
using Clinics.Api.Helpers;
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
                    Limit = QuotaHelper.ToApiMessagesQuota(q.MessagesQuota),
                    Used = (int)q.ConsumedMessages, // Convert long to int for API
                    QueuesLimit = QuotaHelper.ToApiQueuesQuota(q.QueuesQuota),
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
                        Limit = -1, // Unlimited
                        Used = 0,
                        QueuesLimit = -1, // Unlimited
                        QueuesUsed = 0
                    });
                }

                return Ok(new MyQuotaDto
                {
                    Limit = QuotaHelper.ToApiMessagesQuota(quota.MessagesQuota),
                    Used = (int)quota.ConsumedMessages, // Convert long to int for API
                    QueuesLimit = QuotaHelper.ToApiQueuesQuota(quota.QueuesQuota),
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
        /// Get quota for a specific moderator
        /// All authenticated users can read quota data, but only see their own moderator's quota
        /// Admins can see any moderator's quota
        /// </summary>
        [HttpGet("{moderatorId:int}")]
        public async Task<ActionResult<QuotaDto>> GetQuota(int moderatorId)
        {
            try
            {
                var currentUserId = _userContext.GetUserId();
                var isAdmin = _userContext.IsAdmin();
                
                // If not admin, verify user is requesting their own moderator's quota
                if (!isAdmin)
                {
                    var effectiveModeratorId = await _quotaService.GetEffectiveModeratorIdAsync(currentUserId);
                    if (effectiveModeratorId != moderatorId)
                    {
                        return Forbid(); // Can only view own moderator's quota
                    }
                }
                
                var quota = await _db.Quotas
                    .FirstOrDefaultAsync(q => q.ModeratorUserId == moderatorId);

                if (quota == null)
                {
                    // Return default quota if not found
                    return Ok(new QuotaDto
                    {
                        Id = 0,
                        Limit = -1, // Unlimited
                        Used = 0,
                        QueuesLimit = -1, // Unlimited
                        QueuesUsed = 0,
                        UpdatedAt = DateTime.UtcNow
                    });
                }

                return Ok(new QuotaDto
                {
                    Id = quota.Id,
                    Limit = QuotaHelper.ToApiMessagesQuota(quota.MessagesQuota),
                    Used = (int)quota.ConsumedMessages, // Convert long to int for API
                    QueuesLimit = QuotaHelper.ToApiQueuesQuota(quota.QueuesQuota),
                    QueuesUsed = quota.ConsumedQueues,
                    UpdatedAt = quota.UpdatedAt
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching quota for moderator {ModeratorId}", moderatorId);
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
                if ((request.Limit <= 0 && request.Limit != -1) || (request.QueuesLimit <= 0 && request.QueuesLimit != -1))
                    return BadRequest(new { message = "Limit and QueuesLimit must be greater than 0 or -1 for unlimited" });

                var existing = await _db.Quotas.FirstOrDefaultAsync(q => q.ModeratorUserId == moderatorId);
                
                if (existing != null)
                    return BadRequest(new { message = "Quota already exists for this moderator" });

                var quota = new Quota
                {
                    ModeratorUserId = moderatorId,
                    MessagesQuota = QuotaHelper.ToDbMessagesQuota(request.Limit),
                    ConsumedMessages = 0,
                    QueuesQuota = QuotaHelper.ToDbQueuesQuota(request.QueuesLimit),
                    ConsumedQueues = 0,
                    UpdatedAt = DateTime.UtcNow
                };

                _db.Quotas.Add(quota);
                await _db.SaveChangesAsync();

                return Ok(new MyQuotaDto
                {
                    Limit = QuotaHelper.ToApiMessagesQuota(quota.MessagesQuota),
                    Used = (int)quota.ConsumedMessages, // Convert long to int for API
                    QueuesLimit = QuotaHelper.ToApiQueuesQuota(quota.QueuesQuota),
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
                if (request.Limit.HasValue)
                {
                    if (request.Limit.Value == -1 || request.Limit.Value > 0)
                        existing.MessagesQuota = QuotaHelper.ToDbMessagesQuota(request.Limit.Value);
                }
                
                if (request.QueuesLimit.HasValue)
                {
                    if (request.QueuesLimit.Value == -1 || request.QueuesLimit.Value > 0)
                        existing.QueuesQuota = QuotaHelper.ToDbQueuesQuota(request.QueuesLimit.Value);
                }
                
                existing.UpdatedAt = DateTime.UtcNow;
                
                await _db.SaveChangesAsync();
                
                return Ok(new MyQuotaDto
                {
                    Limit = QuotaHelper.ToApiMessagesQuota(existing.MessagesQuota),
                    Used = (int)existing.ConsumedMessages, // Convert long to int for API
                    QueuesLimit = QuotaHelper.ToApiQueuesQuota(existing.QueuesQuota),
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
