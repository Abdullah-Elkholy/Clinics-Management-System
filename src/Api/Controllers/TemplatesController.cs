using Microsoft.AspNetCore.Mvc;
using Clinics.Infrastructure;
using Clinics.Domain;
using Clinics.Api.DTOs;
using Clinics.Api.Services;
using Clinics.Infrastructure.Services;
using Clinics.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Clinics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin,moderator")]
    public class TemplatesController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly ILogger<TemplatesController> _logger;
        private readonly IUserContext _userContext;
        private readonly Clinics.Api.Services.ITemplateCascadeService _templateCascadeService;
        private readonly ISoftDeleteTTLQueries<MessageTemplate> _ttlQueries;

        public TemplatesController(
            ApplicationDbContext db,
            ILogger<TemplatesController> logger,
            IUserContext userContext,
            Clinics.Api.Services.ITemplateCascadeService templateCascadeService,
            IGenericUnitOfWork unitOfWork)
        {
            _db = db;
            _logger = logger;
            _userContext = userContext;
            _templateCascadeService = templateCascadeService;
            _ttlQueries = unitOfWork.TTLQueries<MessageTemplate>();
        }

        /// <summary>
        /// GET /api/templates?queueId=1
        /// Get templates for a specific queue.
        /// If queueId not provided, return templates for moderator's queues (or all if admin).
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<ListResponse<TemplateDto>>> Get([FromQuery] int? queueId)
        {
            try
            {
                var moderatorId = _userContext.GetModeratorId();
                var isAdmin = _userContext.IsAdmin();

                IQueryable<MessageTemplate> query = _db.MessageTemplates.AsQueryable();

                // Filter by queue if specified
                if (queueId.HasValue)
                {
                    // Verify moderator owns this queue
                    var queue = await _db.Queues.FindAsync(queueId.Value);
                    if (queue == null)
                        return NotFound(new { message = "Queue not found" });

                    // Check ownership
                    if (!isAdmin && queue.ModeratorId != moderatorId)
                        return Forbid();

                    query = query.Where(t => t.QueueId == queueId.Value);
                }
                else
                {
                    // Filter by moderator's queues (if not admin)
                    if (!isAdmin && moderatorId.HasValue)
                    {
                        query = query.Where(t => t.ModeratorId == moderatorId.Value);
                    }
                    // Admins can see all templates
                }

                var templates = await query.OrderBy(t => t.CreatedAt).ToListAsync();
                
                var dtos = templates.Select(t => new TemplateDto
                {
                    Id = t.Id,
                    Title = t.Title,
                    Content = t.Content,
                    ModeratorId = t.ModeratorId,
                    QueueId = t.QueueId,
                    IsActive = t.IsActive,
                    IsDefault = t.IsDefault,
                    HasCondition = t.HasCondition,
                    CreatedAt = t.CreatedAt,
                    UpdatedAt = t.UpdatedAt
                }).ToList();

                return Ok(new ListResponse<TemplateDto>
                {
                    Items = dtos,
                    TotalCount = dtos.Count,
                    PageNumber = 1,
                    PageSize = dtos.Count
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching templates");
                return StatusCode(500, new { message = "Error fetching templates" });
            }
        }

        /// <summary>
        /// POST /api/templates
        /// Create a new template for a specific queue.
        /// </summary>
        [HttpPost]
        public async Task<ActionResult<TemplateDto>> Create([FromBody] CreateTemplateRequest req)
        {
            try
            {
                if (!ModelState.IsValid)
                    return BadRequest(ModelState);

                // Verify queue exists and belongs to moderator
                var queue = await _db.Queues.FindAsync(req.QueueId);
                if (queue == null)
                    return NotFound(new { message = "Queue not found" });

                var moderatorId = _userContext.GetModeratorId();
                var isAdmin = _userContext.IsAdmin();

                // Check ownership
                if (!isAdmin && queue.ModeratorId != moderatorId)
                    return Forbid();

                var userId = _userContext.GetUserId();
                var template = new MessageTemplate
                {
                    Title = req.Title,
                    Content = req.Content,
                    IsActive = req.IsActive,
                    CreatedBy = userId,
                    ModeratorId = queue.ModeratorId,
                    QueueId = req.QueueId,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _db.MessageTemplates.Add(template);
                await _db.SaveChangesAsync();

                var dto = new TemplateDto
                {
                    Id = template.Id,
                    Title = template.Title,
                    Content = template.Content,
                    ModeratorId = template.ModeratorId,
                    QueueId = template.QueueId,
                    IsActive = template.IsActive,
                    IsDefault = template.IsDefault,
                    HasCondition = template.HasCondition,
                    CreatedAt = template.CreatedAt,
                    UpdatedAt = template.UpdatedAt
                };

                return CreatedAtAction(nameof(Get), new { id = template.Id }, dto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating template");
                return StatusCode(500, new { message = "Error creating template" });
            }
        }

        [HttpPut("{id}")]
        public async Task<ActionResult<TemplateDto>> Update(int id, [FromBody] UpdateTemplateRequest req)
        {
            try
            {
                var existing = await _db.MessageTemplates.FindAsync(id);
                if (existing == null)
                    return NotFound(new { message = "Template not found" });

                var moderatorId = _userContext.GetModeratorId();
                var isAdmin = _userContext.IsAdmin();

                // Verify ownership (moderator owns the template's queue)
                if (!isAdmin && existing.ModeratorId != moderatorId)
                    return Forbid();

                if (!string.IsNullOrEmpty(req.Title))
                    existing.Title = req.Title;

                if (!string.IsNullOrEmpty(req.Content))
                    existing.Content = req.Content;

                if (req.IsActive.HasValue)
                    existing.IsActive = req.IsActive.Value;

                existing.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();

                var dto = new TemplateDto
                {
                    Id = existing.Id,
                    Title = existing.Title,
                    Content = existing.Content,
                    ModeratorId = existing.ModeratorId,
                    QueueId = existing.QueueId,
                    IsActive = existing.IsActive,
                    IsDefault = existing.IsDefault,
                    HasCondition = existing.HasCondition,
                    CreatedAt = existing.CreatedAt,
                    UpdatedAt = existing.UpdatedAt
                };

                return Ok(dto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating template");
                return StatusCode(500, new { message = "Error updating template" });
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var existing = await _db.MessageTemplates.FindAsync(id);
                if (existing == null)
                    return NotFound(new { message = "Template not found" });

                var moderatorId = _userContext.GetModeratorId();
                var isAdmin = _userContext.IsAdmin();

                // Verify ownership
                if (!isAdmin && existing.ModeratorId != moderatorId)
                    return Forbid();

                // Get current user ID for audit
                var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");
                
                // Soft-delete template and cascade to related entities
                var (success, errorMessage) = await _templateCascadeService.SoftDeleteTemplateAsync(id, userId);
                
                if (!success)
                {
                    return BadRequest(new { success = false, error = errorMessage });
                }

                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting template");
                return StatusCode(500, new { message = "Error deleting template" });
            }
        }

        /// <summary>
        /// PUT /api/templates/{id}/default
        /// Set this template as the default for its queue.
        /// - Atomically unsets IsDefault on all other templates in the same queue.
        /// - Removes any condition attached to this template (default templates have no conditions).
        /// </summary>
        [HttpPut("{id}/default")]
        public async Task<ActionResult<TemplateDto>> SetAsDefault(int id)
        {
            try
            {
                var template = await _db.MessageTemplates.FindAsync(id);
                if (template == null)
                    return NotFound(new { message = "Template not found" });

                if (template.QueueId <= 0)
                    return BadRequest(new { message = "Template must belong to a queue to be set as default" });

                var moderatorId = _userContext.GetModeratorId();
                var isAdmin = _userContext.IsAdmin();

                // Verify ownership
                if (!isAdmin && template.ModeratorId != moderatorId)
                    return Forbid();

                using (var transaction = await _db.Database.BeginTransactionAsync())
                {
                    try
                    {
                        // Unset all other templates in the same queue
                        var others = await _db.MessageTemplates
                            .Where(t => t.QueueId == template.QueueId && t.Id != id && t.IsDefault)
                            .ToListAsync();
                        foreach (var other in others)
                        {
                            other.IsDefault = false;
                            other.UpdatedAt = DateTime.UtcNow;
                        }

                        // Remove any condition on this template
                        var condition = await _db.Set<MessageCondition>()
                            .FirstOrDefaultAsync(c => c.TemplateId == id);
                        if (condition != null)
                        {
                            // Convert to placeholder condition (hasCondition=false semantics)
                            condition.Operator = "DEFAULT";
                            condition.Value = null;
                            condition.MinValue = null;
                            condition.MaxValue = null;
                            condition.UpdatedAt = DateTime.UtcNow;
                        }

                        // Set this template as default (must have hasCondition=false)
                        template.IsDefault = true;
                        template.HasCondition = false;
                        template.UpdatedAt = DateTime.UtcNow;

                        await _db.SaveChangesAsync();
                        await transaction.CommitAsync();

                        var dto = new TemplateDto
                        {
                            Id = template.Id,
                            Title = template.Title,
                            Content = template.Content,
                            ModeratorId = template.ModeratorId,
                            QueueId = template.QueueId,
                            IsActive = template.IsActive,
                            IsDefault = template.IsDefault,
                            HasCondition = template.HasCondition,
                            CreatedAt = template.CreatedAt,
                            UpdatedAt = template.UpdatedAt
                        };

                        return Ok(dto);
                    }
                    catch
                    {
                        await transaction.RollbackAsync();
                        throw;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error setting template as default");
                return StatusCode(500, new { message = "Error setting template as default" });
            }
        }

        /// <summary>
        /// GET /api/templates/trash?page=1&pageSize=10
        /// Get soft-deleted templates (trash) for moderator's queues or all if admin.
        /// </summary>
        [HttpGet("trash")]
        public async Task<IActionResult> GetTrash([FromQuery] int page = 1, [FromQuery] int pageSize = 10)
        {
            try
            {
                var moderatorId = _userContext.GetModeratorId();
                var isAdmin = _userContext.IsAdmin();

                var query = _ttlQueries.QueryTrash(30).AsQueryable();

                if (!isAdmin && moderatorId.HasValue)
                {
                    query = query.Where(t => t.ModeratorId == moderatorId.Value);
                }

                var total = await query.CountAsync();
                var templates = await query
                    .OrderByDescending(t => t.DeletedAt)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(t => new
                    {
                        t.Id,
                        t.Title,
                        t.Content,
                        t.ModeratorId,
                        t.QueueId,
                        t.IsActive,
                        t.IsDefault,
                        t.DeletedAt,
                        DaysRemainingInTrash = _ttlQueries.GetDaysRemainingInTrash(t, 30),
                        t.DeletedBy
                    })
                    .ToListAsync();

                return Ok(new { success = true, data = templates, total, page, pageSize });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching trash templates");
                return StatusCode(500, new { message = "Error fetching trash templates" });
            }
        }

        /// <summary>
        /// GET /api/templates/archived?page=1&pageSize=10
        /// Admin-only endpoint to view archived templates (soft-deleted 30+ days ago).
        /// </summary>
        [HttpGet("archived")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin")]
        public async Task<IActionResult> GetArchived([FromQuery] int page = 1, [FromQuery] int pageSize = 10)
        {
            try
            {
                var query = _ttlQueries.QueryArchived(30).AsQueryable();

                var total = await query.CountAsync();
                var templates = await query
                    .OrderByDescending(t => t.DeletedAt)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(t => new
                    {
                        t.Id,
                        t.Title,
                        t.Content,
                        t.ModeratorId,
                        t.QueueId,
                        t.IsActive,
                        t.IsDefault,
                        t.DeletedAt,
                        DaysDeleted = t.DeletedAt.HasValue ? (int)(DateTime.UtcNow - t.DeletedAt.Value).TotalDays : 0,
                        t.DeletedBy,
                        Note = "Read-only: Restore window expired"
                    })
                    .ToListAsync();

                return Ok(new { success = true, data = templates, total, page, pageSize });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching archived templates");
                return StatusCode(500, new { message = "Error fetching archived templates" });
            }
        }

        /// <summary>
        /// POST /api/templates/{id}/restore
        /// Restore a soft-deleted template from trash.
        /// </summary>
        [HttpPost("{id}/restore")]
        public async Task<IActionResult> Restore(int id)
        {
            try
            {
                var moderatorId = _userContext.GetModeratorId();
                var isAdmin = _userContext.IsAdmin();
                var userId = _userContext.GetUserId();

                var template = await _db.MessageTemplates.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Id == id);
                if (template == null)
                    return NotFound(new { success = false, error = "Template not found", statusCode = 404 });

                // Non-admins can only restore their own templates
                if (!isAdmin && template.ModeratorId != moderatorId)
                    return Forbid();

                // Check if template is not deleted
                if (!template.IsDeleted)
                    return BadRequest(new { success = false, error = "Template is not in trash", statusCode = 400 });

                // Attempt restore
                var (success, errorMessage) = await _templateCascadeService.RestoreTemplateAsync(id);

                if (!success)
                {
                    if (errorMessage == "restore_window_expired")
                    {
                        return Conflict(new
                        {
                            success = false,
                            error = errorMessage,
                            message = "لا يمكن استعادة القالب بعد 30 يومًا من الحذف",
                            statusCode = 409
                        });
                    }
                    return BadRequest(new { success = false, error = errorMessage, statusCode = 400 });
                }

                return Ok(new { success = true, data = template, statusCode = 200 });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error restoring template {TemplateId}", id);
                return StatusCode(500, new { message = "Error restoring template" });
            }
        }
    }

    public class CreateTemplateRequest
    {
        public string Title { get; set; } = null!;
        public string Content { get; set; } = null!;
        public int QueueId { get; set; }
        public bool IsShared { get; set; } = true;
        public bool IsActive { get; set; } = true;
    }

    public class UpdateTemplateRequest
    {
        public string? Title { get; set; }
        public string? Content { get; set; }
        public bool? IsShared { get; set; }
        public bool? IsActive { get; set; }
    }
}
