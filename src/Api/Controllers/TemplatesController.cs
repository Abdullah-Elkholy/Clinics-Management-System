using Microsoft.AspNetCore.Mvc;
using Clinics.Infrastructure;
using Clinics.Domain;
using Clinics.Api.DTOs;
using Clinics.Api.Services;
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

        public TemplatesController(ApplicationDbContext db, ILogger<TemplatesController> logger, IUserContext userContext)
        {
            _db = db;
            _logger = logger;
            _userContext = userContext;
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
                    ModeratorId = t.ModeratorId ?? 0,
                    QueueId = t.QueueId ?? 0,
                    IsShared = t.IsShared,
                    IsActive = t.IsActive,
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
                    IsShared = req.IsShared,
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
                    ModeratorId = template.ModeratorId ?? 0,
                    QueueId = template.QueueId ?? 0,
                    IsShared = template.IsShared,
                    IsActive = template.IsActive,
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

                if (req.IsShared.HasValue)
                    existing.IsShared = req.IsShared.Value;

                if (req.IsActive.HasValue)
                    existing.IsActive = req.IsActive.Value;

                existing.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();

                var dto = new TemplateDto
                {
                    Id = existing.Id,
                    Title = existing.Title,
                    Content = existing.Content,
                    ModeratorId = existing.ModeratorId ?? 0,
                    QueueId = existing.QueueId ?? 0,
                    IsShared = existing.IsShared,
                    IsActive = existing.IsActive,
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

                _db.MessageTemplates.Remove(existing);
                await _db.SaveChangesAsync();
                return NoContent();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting template");
                return StatusCode(500, new { message = "Error deleting template" });
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
