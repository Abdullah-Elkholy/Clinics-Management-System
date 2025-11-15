using System;
using System.Threading.Tasks;
using Clinics.Api.DTOs;
using Clinics.Api.Services;
using Clinics.Domain;
using Clinics.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Clinics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ConditionsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly IUserContext _userContext;
        private readonly IConditionValidationService _conditionValidationService;

        public ConditionsController(
            ApplicationDbContext context,
            IUserContext userContext,
            IConditionValidationService conditionValidationService)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
            _conditionValidationService = conditionValidationService ?? throw new ArgumentNullException(nameof(conditionValidationService));
        }

        /// <summary>
    /// GET /api/conditions?queueId=1
    /// Get all conditions for a specific queue.
    /// Response includes synthetic "بدون شرط" (no condition) item (operator = DEFAULT) as the first entry for UI convenience.
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<ListResponse<ConditionDto>>> GetConditionsByQueue([FromQuery] int queueId)
        {
            // Verify moderator owns this queue
            var queue = await _context.Set<Queue>()
                .FirstOrDefaultAsync(q => q.Id == queueId);

            if (queue == null)
                return NotFound(new { message = "Queue not found" });

            var moderatorId = _userContext.GetModeratorId();
            if (queue.ModeratorId != moderatorId && !_userContext.IsAdmin())
                return Forbid();

            // Get all conditions for this queue with their templates
            var conditions = await _context.Set<MessageCondition>()
                .Where(c => c.QueueId == queueId)
                .Include(c => c.Template)
                .OrderBy(c => c.CreatedAt)
                .ToListAsync();

            var dtos = new List<ConditionDto>();
            
            // Add synthetic "بدون شرط" (no condition) item first.
            // Use operator = DEFAULT consistently as the sentinel for "no condition" everywhere.
            dtos.Add(new ConditionDto
            {
                Id = 0, // Sentinel value indicating synthetic item (not persisted)
                TemplateId = null,
                QueueId = queueId,
                Operator = "DEFAULT", // Sentinel operator
                Value = null,
                MinValue = null,
                MaxValue = null,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = null
            });

            // Add actual conditions from database
            dtos.AddRange(conditions.Select(c => new ConditionDto
            {
                Id = c.Id,
                TemplateId = c.Template?.Id, // Get template ID from navigation property
                QueueId = c.QueueId,
                Operator = c.Operator,
                Value = c.Value,
                MinValue = c.MinValue,
                MaxValue = c.MaxValue,
                CreatedAt = c.CreatedAt,
                UpdatedAt = c.UpdatedAt
            }));

            return Ok(new ListResponse<ConditionDto>
            {
                Items = dtos,
                TotalCount = dtos.Count,
                PageNumber = 1,
                PageSize = dtos.Count
            });
        }

        /// <summary>
        /// GET /api/conditions/{id}
        /// Get a specific condition by ID.
        /// </summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<ConditionDto>> GetConditionById(int id)
        {
            var condition = await _context.Set<MessageCondition>()
                .Include(c => c.Template)
                .FirstOrDefaultAsync(c => c.Id == id);

            if (condition == null)
                return NotFound(new { message = "Condition not found" });

            // Verify moderator owns the queue
            var queue = await _context.Set<Queue>()
                .FirstOrDefaultAsync(q => q.Id == condition.QueueId);

            if (queue == null)
                return NotFound(new { message = "Queue not found" });

            var moderatorId = _userContext.GetModeratorId();
            if (queue.ModeratorId != moderatorId && !_userContext.IsAdmin())
                return Forbid();

            var dto = new ConditionDto
            {
                Id = condition.Id,
                TemplateId = condition.Template?.Id, // Get template ID from navigation property
                QueueId = condition.QueueId,
                Operator = condition.Operator,
                Value = condition.Value,
                MinValue = condition.MinValue,
                MaxValue = condition.MaxValue,
                CreatedAt = condition.CreatedAt,
                UpdatedAt = condition.UpdatedAt
            };

            return Ok(dto);
        }

        /// <summary>
    /// POST /api/conditions
    /// Create a new condition for a template.
    /// Template state (DEFAULT/UNCONDITIONED/active operator) is determined by the condition.Operator value.
        /// </summary>
        [HttpPost]
        public async Task<ActionResult<ConditionDto>> CreateCondition([FromBody] CreateConditionRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            // Verify template exists and belongs to the queue
            var template = await _context.Set<MessageTemplate>()
                .FirstOrDefaultAsync(t => t.Id == request.TemplateId && t.QueueId == request.QueueId);

            if (template == null)
                return BadRequest(new { message = "Template not found in this queue" });

            // Reject if template already has an active condition (one-to-one rule enforced below)
            // Load template with its condition
            await _context.Entry(template).Reference(t => t.Condition).LoadAsync();
            var existingCondition = template.Condition;

            if (existingCondition != null && existingCondition.Operator != "UNCONDITIONED" && existingCondition.Operator != "DEFAULT")
                return BadRequest(new { message = "Template already has an active condition. Update or delete the existing condition first." });

            // Verify moderator owns the queue
            var queue = await _context.Set<Queue>()
                .FirstOrDefaultAsync(q => q.Id == request.QueueId);

            if (queue == null)
                return NotFound(new { message = "Queue not found" });

            var moderatorId = _userContext.GetModeratorId();
            if (queue.ModeratorId != moderatorId && !_userContext.IsAdmin())
                return Forbid();

            // Validate operator and values
            var validationResult = await _conditionValidationService.ValidateSingleConditionAsync(
                request.Operator, request.Value, request.MinValue, request.MaxValue);

            if (!validationResult.IsValid)
                return BadRequest(new { message = validationResult.ErrorMessage });

            // Check if template already has a condition (one-to-one enforcement)
            if (await _conditionValidationService.TemplateHasConditionAsync(request.TemplateId))
                return BadRequest(new { message = "Template already has a condition. Update or delete the existing condition first." });

            // Check for DEFAULT uniqueness per queue
            if (request.Operator.ToUpper() == "DEFAULT")
            {
                if (await _conditionValidationService.IsDefaultAlreadyUsedAsync(request.QueueId))
                    return BadRequest(new { message = "This queue already has a default template. Set another template as default first." });
            }

            // Check for overlaps with existing conditions (ignores DEFAULT/UNCONDITIONED)
            if (await _conditionValidationService.HasOverlapAsync(
                request.QueueId, request.Operator, request.Value, request.MinValue, request.MaxValue))
                return BadRequest(new { message = "This condition overlaps with an existing condition in the queue." });

            // Create condition and update template's state atomically
            // Template state is implicit via condition.Operator (DEFAULT/UNCONDITIONED/active operator)
            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    // Create condition first
                    var condition = new MessageCondition
                    {
                        QueueId = request.QueueId,
                        Operator = request.Operator.ToUpper(),
                        Value = request.Value,
                        MinValue = request.MinValue,
                        MaxValue = request.MaxValue,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };

                    _context.Set<MessageCondition>().Add(condition);
                    await _context.SaveChangesAsync(); // Save to get condition ID
                    
                    // Update template with MessageConditionId
                    template.MessageConditionId = condition.Id;
                    template.UpdatedAt = DateTime.UtcNow;
                    _context.Set<MessageTemplate>().Update(template);

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    var dto = new ConditionDto
                    {
                        Id = condition.Id,
                        TemplateId = template.Id, // Template ID from template entity
                        QueueId = condition.QueueId,
                        Operator = condition.Operator,
                        Value = condition.Value,
                        MinValue = condition.MinValue,
                        MaxValue = condition.MaxValue,
                        CreatedAt = condition.CreatedAt,
                        UpdatedAt = condition.UpdatedAt
                    };

                    return CreatedAtAction(nameof(GetConditionById), new { id = condition.Id }, dto);
                }
                catch
                {
                    await transaction.RollbackAsync();
                    throw;
                }
            }
        }

        /// <summary>
    /// PUT /api/conditions/{id}
    /// Update an existing condition.
    /// Template state transitions automatically reflect in the condition.Operator value (DEFAULT/UNCONDITIONED/active operator).
        /// </summary>
        [HttpPut("{id}")]
        public async Task<ActionResult<ConditionDto>> UpdateCondition(int id, [FromBody] UpdateConditionRequest request)
        {
            if (!ModelState.IsValid)
                return BadRequest(ModelState);

            var condition = await _context.Set<MessageCondition>()
                .FirstOrDefaultAsync(c => c.Id == id);

            if (condition == null)
                return NotFound(new { message = "Condition not found" });

            // Verify moderator owns the queue
            var queue = await _context.Set<Queue>()
                .FirstOrDefaultAsync(q => q.Id == condition.QueueId);

            if (queue == null)
                return NotFound(new { message = "Queue not found" });

            var moderatorId = _userContext.GetModeratorId();
            if (queue.ModeratorId != moderatorId && !_userContext.IsAdmin())
                return Forbid();

            // Track original operator to detect state changes (DEFAULT <-> active operator)
            // This is used to update template's UpdatedAt timestamp on state transitions
            var originalOperator = condition.Operator;

            // Helper local function for sentinel detection
            bool IsNoCondition(string op) => string.Equals(op, "DEFAULT", StringComparison.OrdinalIgnoreCase);

            // Update fields if provided
            if (request.Operator != null)
            {
                var validationResult = await _conditionValidationService.ValidateSingleConditionAsync(
                    request.Operator, request.Value ?? condition.Value, request.MinValue ?? condition.MinValue, request.MaxValue ?? condition.MaxValue);

                if (!validationResult.IsValid)
                    return BadRequest(new { message = validationResult.ErrorMessage });

                // Check for DEFAULT uniqueness if changing to DEFAULT
                if (request.Operator.ToUpper() == "DEFAULT" && condition.Operator != "DEFAULT")
                {
                    if (await _conditionValidationService.IsDefaultAlreadyUsedAsync(condition.QueueId, condition.Id))
                        return BadRequest(new { message = "This queue already has a default template. Set another template as default first." });
                }

                // Check for overlaps with existing conditions when changing to active operator
                if (request.Operator.ToUpper() != "DEFAULT" && request.Operator.ToUpper() != "UNCONDITIONED")
                {
                    if (await _conditionValidationService.HasOverlapAsync(
                        condition.QueueId, request.Operator, request.Value ?? condition.Value, 
                        request.MinValue ?? condition.MinValue, request.MaxValue ?? condition.MaxValue, condition.Id))
                        return BadRequest(new { message = "This condition overlaps with an existing condition in the queue." });
                }

                condition.Operator = request.Operator.ToUpper();
            }

            if (request.Value.HasValue)
                condition.Value = request.Value;

            if (request.MinValue.HasValue)
                condition.MinValue = request.MinValue;

            if (request.MaxValue.HasValue)
                condition.MaxValue = request.MaxValue;

            condition.UpdatedAt = DateTime.UtcNow;

            // Detect if state should change: transitioning between sentinel DEFAULT and any active operator
            // Only update template.UpdatedAt if the state transition is meaningful
            bool hasConditionStateChanged = (IsNoCondition(originalOperator) && !IsNoCondition(condition.Operator))
                || (!IsNoCondition(originalOperator) && IsNoCondition(condition.Operator));

            // If state changed, update template's UpdatedAt atomically within transaction
            if (hasConditionStateChanged)
            {
                using (var transaction = await _context.Database.BeginTransactionAsync())
                {
                    try
                    {
                        // Update condition
                        _context.Set<MessageCondition>().Update(condition);

                        // Get template via MessageConditionId
                        var template = await _context.Set<MessageTemplate>()
                            .FirstOrDefaultAsync(t => t.MessageConditionId == condition.Id);

                        if (template != null)
                        {
                            template.UpdatedAt = DateTime.UtcNow;
                            _context.Set<MessageTemplate>().Update(template);
                        }

                        await _context.SaveChangesAsync();
                        await transaction.CommitAsync();
                    }
                    catch
                    {
                        await transaction.RollbackAsync();
                        throw;
                    }
                }
            }
            else
            {
                // No state change, just update condition normally
                _context.Set<MessageCondition>().Update(condition);
                await _context.SaveChangesAsync();
            }

            // Get template via MessageConditionId for DTO
            var templateForDto = await _context.Set<MessageTemplate>()
                .FirstOrDefaultAsync(t => t.MessageConditionId == condition.Id);

            var dto = new ConditionDto
            {
                Id = condition.Id,
                TemplateId = templateForDto?.Id, // Get template ID from template entity
                QueueId = condition.QueueId,
                Operator = condition.Operator,
                Value = condition.Value,
                MinValue = condition.MinValue,
                MaxValue = condition.MaxValue,
                CreatedAt = condition.CreatedAt,
                UpdatedAt = condition.UpdatedAt
            };

            return Ok(dto);
        }

        /// <summary>
    /// DELETE /api/conditions/{id}
    /// Delete a condition (template state reverts to base via condition removal).
    /// Updates template.UpdatedAt atomically within a transaction.
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteCondition(int id)
        {
            var condition = await _context.Set<MessageCondition>()
                .FirstOrDefaultAsync(c => c.Id == id);

            if (condition == null)
                return NotFound(new { message = "Condition not found" });

            // Verify moderator owns the queue
            var queue = await _context.Set<Queue>()
                .FirstOrDefaultAsync(q => q.Id == condition.QueueId);

            if (queue == null)
                return NotFound(new { message = "Queue not found" });

            var moderatorId = _userContext.GetModeratorId();
            if (queue.ModeratorId != moderatorId && !_userContext.IsAdmin())
                return Forbid();

            // Delete condition and update template's UpdatedAt atomically
            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    // Delete condition
                    _context.Set<MessageCondition>().Remove(condition);

                    // Get template via MessageConditionId
                    var template = await _context.Set<MessageTemplate>()
                        .FirstOrDefaultAsync(t => t.MessageConditionId == condition.Id);

                    if (template != null)
                    {
                        template.UpdatedAt = DateTime.UtcNow;
                        _context.Set<MessageTemplate>().Update(template);
                    }

                    await _context.SaveChangesAsync();
                    await transaction.CommitAsync();

                    return NoContent();
                }
                catch
                {
                    await transaction.RollbackAsync();
                    throw;
                }
            }
        }
    }
}
