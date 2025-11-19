using Microsoft.AspNetCore.Mvc;
using Clinics.Infrastructure;
using Clinics.Domain;
using Clinics.Api.DTOs;
using Clinics.Api.Services;
using Clinics.Infrastructure.Services;
using Clinics.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Linq;

namespace Clinics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin,moderator,user")]
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
                var userId = _userContext.GetUserId();
                var currentUser = await _db.Users
                    .Where(u => u.Id == userId && !u.IsDeleted)
                    .FirstOrDefaultAsync();

                if (currentUser == null)
                    return Unauthorized(new { message = "User not found" });

                var isAdmin = currentUser.Role == "primary_admin" || currentUser.Role == "secondary_admin";
                
                // Get effective moderator ID: moderators use their own ID, users use their ModeratorId
                int? moderatorId = null;
                if (currentUser.Role == "moderator")
                {
                    moderatorId = currentUser.Id;
                }
                else if (currentUser.Role == "user" && currentUser.ModeratorId.HasValue)
                {
                    moderatorId = currentUser.ModeratorId.Value;
                }

                IQueryable<MessageTemplate> query = _db.MessageTemplates
                    .Where(t => !t.IsDeleted) // Only show non-deleted templates (active = !IsDeleted)
                    .AsQueryable();

                // Filter by queue if specified
                if (queueId.HasValue)
                {
                    // Verify moderator owns this queue
                    var queue = await _db.Queues.FindAsync(queueId.Value);
                    if (queue == null || queue.IsDeleted)
                        return NotFound(new { message = "Queue not found" });

                    // Check ownership
                    if (!isAdmin)
                    {
                        if (currentUser.Role == "moderator" && queue.ModeratorId != userId)
                            return Forbid();
                        if (currentUser.Role == "user" && queue.ModeratorId != moderatorId)
                            return Forbid();
                    }

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
                    CreatedAt = t.CreatedAt,
                    UpdatedAt = t.UpdatedAt,
                    CreatedBy = t.CreatedBy,
                    UpdatedBy = t.UpdatedBy,
                    IsDeleted = t.IsDeleted, // Single source of truth: active = !IsDeleted
                    Condition = t.Condition != null ? new ConditionDto
                    {
                        Id = t.Condition.Id,
                        TemplateId = t.Id, // Template ID from the template entity
                        QueueId = t.Condition.QueueId,
                        Operator = t.Condition.Operator,
                        Value = t.Condition.Value,
                        MinValue = t.Condition.MinValue,
                        MaxValue = t.Condition.MaxValue,
                        CreatedAt = t.Condition.CreatedAt,
                        UpdatedAt = t.Condition.UpdatedAt
                    } : null
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
        /// GET /api/templates/{id}
        /// Get a single template by ID.
        /// </summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<TemplateDto>> Get(int id)
        {
            try
            {
                var template = await _db.MessageTemplates
                    .FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);
                
                if (template == null)
                    return NotFound(new { message = "Template not found" });

                var userId = _userContext.GetUserId();
                var currentUser = await _db.Users
                    .Where(u => u.Id == userId && !u.IsDeleted)
                    .FirstOrDefaultAsync();

                if (currentUser == null)
                    return Unauthorized(new { message = "User not found" });

                var isAdmin = currentUser.Role == "primary_admin" || currentUser.Role == "secondary_admin";

                // Get effective moderator ID: moderators use their own ID, users use their ModeratorId
                int? moderatorId = null;
                if (currentUser.Role == "moderator")
                {
                    moderatorId = currentUser.Id;
                }
                else if (currentUser.Role == "user" && currentUser.ModeratorId.HasValue)
                {
                    moderatorId = currentUser.ModeratorId.Value;
                }

                // Verify ownership
                if (!isAdmin)
                {
                    if (currentUser.Role == "moderator" && template.ModeratorId != userId)
                        return Forbid();
                    if (currentUser.Role == "user" && template.ModeratorId != moderatorId)
                        return Forbid();
                }

                // Load condition
                await _db.Entry(template).Reference(t => t.Condition).LoadAsync();

                var dto = new TemplateDto
                {
                    Id = template.Id,
                    Title = template.Title,
                    Content = template.Content,
                    ModeratorId = template.ModeratorId,
                    QueueId = template.QueueId,
                    CreatedAt = template.CreatedAt,
                    UpdatedAt = template.UpdatedAt,
                    CreatedBy = template.CreatedBy,
                    UpdatedBy = template.UpdatedBy,
                    IsDeleted = template.IsDeleted,
                    Condition = template.Condition != null ? new ConditionDto
                    {
                        Id = template.Condition.Id,
                        TemplateId = template.Id, // Template ID from the template entity
                        QueueId = template.Condition.QueueId,
                        Operator = template.Condition.Operator,
                        Value = template.Condition.Value,
                        MinValue = template.Condition.MinValue,
                        MaxValue = template.Condition.MaxValue,
                        CreatedAt = template.Condition.CreatedAt,
                        UpdatedAt = template.Condition.UpdatedAt
                    } : null
                };

                return Ok(dto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching template {TemplateId}", id);
                return StatusCode(500, new { message = "Error fetching template" });
            }
        }

        /// <summary>
        /// POST /api/templates
        /// Create a new template for a specific queue.
        /// </summary>
        [HttpPost]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin,moderator")]
        public async Task<ActionResult<TemplateDto>> Create([FromBody] CreateTemplateRequest req)
        {
            // Use transaction to ensure template and condition are created atomically
            using var transaction = await _db.Database.BeginTransactionAsync();
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
                
                // Step 1: Validate and prepare condition data first
                // Determine operator: default to UNCONDITIONED if not provided
                var conditionOperator = string.IsNullOrWhiteSpace(req.ConditionOperator) 
                    ? "UNCONDITIONED" 
                    : req.ConditionOperator.ToUpper();

                // Validate operator
                var validOperators = new[] { "UNCONDITIONED", "DEFAULT", "EQUAL", "GREATER", "LESS", "RANGE" };
                if (!validOperators.Contains(conditionOperator))
                {
                    await transaction.RollbackAsync();
                    return BadRequest(new { message = $"Invalid operator: {conditionOperator}. Must be one of: {string.Join(", ", validOperators)}" });
                }

                // Validate condition values based on operator
                if (conditionOperator == "RANGE")
                {
                    if (!req.ConditionMinValue.HasValue || !req.ConditionMaxValue.HasValue)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { message = "MinValue and MaxValue are required for RANGE operator" });
                    }
                    if (req.ConditionMinValue.Value <= 0 || req.ConditionMaxValue.Value <= 0)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { message = "MinValue and MaxValue must be greater than 0" });
                    }
                    if (req.ConditionMinValue.Value >= req.ConditionMaxValue.Value)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { message = "MinValue must be less than MaxValue" });
                    }
                }
                else if (conditionOperator == "EQUAL" || conditionOperator == "GREATER" || conditionOperator == "LESS")
                {
                    if (!req.ConditionValue.HasValue)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { message = $"Value is required for {conditionOperator} operator" });
                    }
                    if (req.ConditionValue.Value <= 0)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { message = "Value must be greater than 0" });
                    }
                }

                // Check for DEFAULT operator uniqueness (only one DEFAULT per queue)
                if (conditionOperator == "DEFAULT")
                {
                    var existingDefault = await _db.Set<MessageCondition>()
                        .FirstOrDefaultAsync(c => c.QueueId == req.QueueId && c.Operator == "DEFAULT");
                    if (existingDefault != null)
                    {
                        await transaction.RollbackAsync();
                        return BadRequest(new { message = "A default template already exists for this queue. Please set the existing default template to a different operator first." });
                    }
                }

                // Step 2: Create the template first (need template ID for condition.TemplateId)
                var template = new MessageTemplate
                {
                    Title = req.Title,
                    Content = req.Content,
                    CreatedBy = userId,
                    UpdatedBy = userId, // Set UpdatedBy on creation as well
                    ModeratorId = queue.ModeratorId,
                    QueueId = req.QueueId,
                    MessageConditionId = 0, // Temporary, will be updated after condition creation
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _db.MessageTemplates.Add(template);
                await _db.SaveChangesAsync(); // Save to get the template ID

                // Step 3: Create the condition with TemplateId foreign key (one-to-one required relationship)
                var condition = new MessageCondition
                {
                    TemplateId = template.Id, // Set foreign key to template
                    QueueId = req.QueueId,
                    Operator = conditionOperator,
                    Value = conditionOperator == "EQUAL" || conditionOperator == "GREATER" || conditionOperator == "LESS" 
                        ? req.ConditionValue 
                        : null,
                    MinValue = conditionOperator == "RANGE" ? req.ConditionMinValue : null,
                    MaxValue = conditionOperator == "RANGE" ? req.ConditionMaxValue : null,
                    CreatedBy = userId,
                    UpdatedBy = userId,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _db.Set<MessageCondition>().Add(condition);
                await _db.SaveChangesAsync(); // Save to get the condition ID

                // Step 4: Update template with MessageConditionId (maintain bidirectional relationship)
                template.MessageConditionId = condition.Id;
                template.UpdatedAt = DateTime.UtcNow;
                _db.MessageTemplates.Update(template);
                await _db.SaveChangesAsync();

                // Commit transaction
                await transaction.CommitAsync();

                // Reload template with condition for DTO
                await _db.Entry(template).Reference(t => t.Condition).LoadAsync();

                var dto = new TemplateDto
                {
                    Id = template.Id,
                    Title = template.Title,
                    Content = template.Content,
                    ModeratorId = template.ModeratorId,
                    QueueId = template.QueueId,
                    CreatedAt = template.CreatedAt,
                    UpdatedAt = template.UpdatedAt,
                    CreatedBy = template.CreatedBy,
                    UpdatedBy = template.UpdatedBy,
                    IsDeleted = template.IsDeleted, // Single source of truth: active = !IsDeleted
                    Condition = template.Condition != null ? new ConditionDto
                    {
                        Id = template.Condition.Id,
                        TemplateId = template.Id, // Template ID from the template entity
                        QueueId = template.Condition.QueueId,
                        Operator = template.Condition.Operator,
                        Value = template.Condition.Value,
                        MinValue = template.Condition.MinValue,
                        MaxValue = template.Condition.MaxValue,
                        CreatedAt = template.Condition.CreatedAt,
                        UpdatedAt = template.Condition.UpdatedAt
                    } : null
                };

                return CreatedAtAction(nameof(Get), new { id = template.Id }, dto);
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Error creating template");
                return StatusCode(500, new { message = "Error creating template" });
            }
        }

        [HttpPut("{id}")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin,moderator")]
        public async Task<ActionResult<TemplateDto>> Update(int id, [FromBody] UpdateTemplateRequest req)
        {
            try
            {
                var existing = await _db.MessageTemplates
                    .FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);
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

                // Get current user ID for audit
                var userId = _userContext.GetUserId();

                // Set UpdatedBy and UpdatedAt for audit trail
                existing.UpdatedBy = userId;
                existing.UpdatedAt = DateTime.UtcNow;
                await _db.SaveChangesAsync();

                var dto = new TemplateDto
                {
                    Id = existing.Id,
                    Title = existing.Title,
                    Content = existing.Content,
                    ModeratorId = existing.ModeratorId,
                    QueueId = existing.QueueId,
                    CreatedAt = existing.CreatedAt,
                    UpdatedAt = existing.UpdatedAt,
                    CreatedBy = existing.CreatedBy,
                    UpdatedBy = existing.UpdatedBy,
                    IsDeleted = existing.IsDeleted, // Single source of truth: active = !IsDeleted
                    Condition = existing.Condition != null ? new ConditionDto
                    {
                        Id = existing.Condition.Id,
                        TemplateId = existing.Id, // Template ID from the template entity
                        QueueId = existing.Condition.QueueId,
                        Operator = existing.Condition.Operator,
                        Value = existing.Condition.Value,
                        MinValue = existing.Condition.MinValue,
                        MaxValue = existing.Condition.MaxValue,
                        CreatedAt = existing.Condition.CreatedAt,
                        UpdatedAt = existing.Condition.UpdatedAt
                    } : null
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
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin,moderator")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var existing = await _db.MessageTemplates
                    .FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);
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
        /// - Creates or updates a condition with Operator='DEFAULT' for this template.
        /// - Atomically removes DEFAULT operator from all other templates in the same queue.
        /// </summary>
        [HttpPut("{id}/default")]
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin,moderator")]
        public async Task<ActionResult<TemplateDto>> SetAsDefault(int id)
        {
            try
            {
                var template = await _db.MessageTemplates
                    .FirstOrDefaultAsync(t => t.Id == id && !t.IsDeleted);
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
                        // Unify datetime for this bulk operation
                        var operationTimestamp = DateTime.UtcNow;

                        // Set all other conditions in the same queue to UNCONDITIONED
                        // Find other templates in the same queue and get their conditions
                        var otherTemplates = await _db.MessageTemplates
                            .Where(t => t.QueueId == template.QueueId && t.Id != id && !t.IsDeleted)
                            .Include(t => t.Condition)
                            .ToListAsync();
                        var otherConditions = otherTemplates
                            .Where(t => t.Condition != null)
                            .Select(t => t.Condition!)
                            .ToList();
                        // Get current user ID for audit
                        var userId = _userContext.GetUserId();

                        foreach (var other in otherConditions)
                        {
                            other.Operator = "UNCONDITIONED";
                            other.Value = null;
                            other.MinValue = null;
                            other.MaxValue = null;
                            other.UpdatedAt = operationTimestamp;
                            other.UpdatedBy = userId;
                        }

                        // Get or create condition for this template with DEFAULT operator
                        // Load the template with its condition
                        await _db.Entry(template).Reference(t => t.Condition).LoadAsync();
                        var condition = template.Condition;
                        if (condition != null)
                        {
                            condition.Operator = "DEFAULT";
                            condition.Value = null;
                            condition.MinValue = null;
                            condition.MaxValue = null;
                            condition.UpdatedAt = operationTimestamp;
                            condition.UpdatedBy = userId;
                        }
                        else
                        {
                            // Create new condition with TemplateId foreign key
                            condition = new MessageCondition
                            {
                                TemplateId = template.Id, // Set foreign key to template
                                QueueId = template.QueueId,
                                Operator = "DEFAULT",
                                CreatedAt = operationTimestamp,
                                UpdatedAt = operationTimestamp,
                                CreatedBy = userId,
                                UpdatedBy = userId
                            };
                            _db.Set<MessageCondition>().Add(condition);
                            await _db.SaveChangesAsync(); // Save to get condition ID
                            
                            // Update template with MessageConditionId (maintain bidirectional relationship)
                            template.MessageConditionId = condition.Id;
                        }

                        template.UpdatedAt = operationTimestamp;
                        template.UpdatedBy = userId;

                        await _db.SaveChangesAsync();
                        await transaction.CommitAsync();

                        var dto = new TemplateDto
                        {
                            Id = template.Id,
                            Title = template.Title,
                            Content = template.Content,
                            ModeratorId = template.ModeratorId,
                            QueueId = template.QueueId,
                            CreatedAt = template.CreatedAt,
                            UpdatedAt = template.UpdatedAt,
                            Condition = condition != null ? new ConditionDto
                            {
                                Id = condition.Id,
                                TemplateId = id, // Template ID from the template entity
                                QueueId = condition.QueueId,
                                Operator = condition.Operator,
                                Value = condition.Value,
                                MinValue = condition.MinValue,
                                MaxValue = condition.MaxValue,
                                CreatedAt = condition.CreatedAt,
                                UpdatedAt = condition.UpdatedAt
                            } : null
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

                var query = _ttlQueries.QueryTrash(30)
                    .Include(t => t.Queue) // Include Queue to check if it's deleted
                    .AsQueryable();

                if (!isAdmin && moderatorId.HasValue)
                {
                    query = query.Where(t => t.ModeratorId == moderatorId.Value);
                }

                // Filter out templates that belong to deleted queues
                query = query.Where(t => t.Queue == null || !t.Queue.IsDeleted);

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
                        DefaultOperator = t.Condition != null && t.Condition.Operator == "DEFAULT" ? "DEFAULT" : null,
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
                        DefaultOperator = t.Condition != null && t.Condition.Operator == "DEFAULT" ? "DEFAULT" : null,
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
                var (success, errorMessage) = await _templateCascadeService.RestoreTemplateAsync(id, userId);

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

    // Note: CreateTemplateRequest and UpdateTemplateRequest are defined in Clinics.Api.DTOs.TemplateConditionDtos
    // This duplicate definition has been removed to use the DTOs version which includes condition fields.

    // Note: UpdateTemplateRequest is defined in Clinics.Api.DTOs.TemplateConditionDtos
    // This duplicate definition has been removed.
}
