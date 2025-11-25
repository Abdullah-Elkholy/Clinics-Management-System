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
        private readonly ILogger<ConditionsController> _logger;

        public ConditionsController(
            ApplicationDbContext context,
            IUserContext userContext,
            IConditionValidationService conditionValidationService,
            ILogger<ConditionsController> logger)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _userContext = userContext ?? throw new ArgumentNullException(nameof(userContext));
            _conditionValidationService = conditionValidationService ?? throw new ArgumentNullException(nameof(conditionValidationService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>
    /// GET /api/conditions?queueId=1
    /// Get all conditions for a specific queue.
    /// Returns only real conditions from the database (no synthetic items).
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

            // Get all non-deleted conditions for this queue (no need to Include Template - we use TemplateId FK directly)
            // Use AsNoTracking for read-only query to reduce memory usage
            var conditions = await _context.Set<MessageCondition>()
                .AsNoTracking()
                .Where(c => c.QueueId == queueId && !c.IsDeleted) // Filter out deleted conditions
                .OrderBy(c => c.CreatedAt)
                .ToListAsync();

            // Map only real conditions from database (exclude synthetic items)
            // Use TemplateId foreign key directly (faster than loading navigation property)
            var dtos = conditions.Select(c => new ConditionDto
            {
                Id = c.Id,
                TemplateId = c.TemplateId, // Use foreign key directly - no navigation needed
                QueueId = c.QueueId,
                Operator = c.Operator,
                Value = c.Value,
                MinValue = c.MinValue,
                MaxValue = c.MaxValue,
                CreatedAt = c.CreatedAt,
                UpdatedAt = c.UpdatedAt
            }).ToList();
            
            // CRITICAL LOGGING: Log conditions with NULL TemplateId
            var conditionsWithNullTemplateId = dtos.Where(d => !d.TemplateId.HasValue).ToList();
            if (conditionsWithNullTemplateId.Any())
            {
                _logger.LogWarning(
                    "[ConditionsController] Found {Count} conditions with NULL TemplateId for queue {QueueId}. Condition IDs: {ConditionIds}",
                    conditionsWithNullTemplateId.Count,
                    queueId,
                    string.Join(", ", conditionsWithNullTemplateId.Select(c => c.Id))
                );
            }
            
            // CRITICAL LOGGING: Log all conditions being returned
            _logger.LogInformation(
                "[ConditionsController] Returning {Count} conditions for queue {QueueId}. TemplateIds: {TemplateIds}",
                dtos.Count,
                queueId,
                string.Join(", ", dtos.Select(c => $"Id={c.Id}, TemplateId={c.TemplateId?.ToString() ?? "NULL"}, Operator={c.Operator}"))
            );

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
                    TemplateId = condition.TemplateId, // Use foreign key directly
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
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin,moderator")]
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

            // Overlap check removed - frontend handles overlap detection with user confirmation
            // Users can now create overlapping conditions if they confirm the overlap
            // if (await _conditionValidationService.HasOverlapAsync(
            //     request.QueueId, request.Operator, request.Value, request.MinValue, request.MaxValue))
            //     return BadRequest(new { message = "هذا الشرط يتداخل مع شرط موجود في الطابور." });

            // Create condition and update template's state atomically
            // Template state is implicit via condition.Operator (DEFAULT/UNCONDITIONED/active operator)
            using (var transaction = await _context.Database.BeginTransactionAsync())
            {
                try
                {
                    // Get current user ID for audit
                    var userId = _userContext.GetUserId();

                    // Create condition first with TemplateId foreign key
                    var condition = new MessageCondition
                    {
                        TemplateId = template.Id, // Set foreign key to template
                        QueueId = request.QueueId,
                        Operator = request.Operator.ToUpper(),
                        Value = request.Value,
                        MinValue = request.MinValue,
                        MaxValue = request.MaxValue,
                        CreatedBy = userId,
                        UpdatedBy = userId,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
                    };

                    _context.Set<MessageCondition>().Add(condition);
                    await _context.SaveChangesAsync(); // Save to get condition ID
                    
                    // Update template with MessageConditionId (maintain bidirectional relationship)
                    template.MessageConditionId = condition.Id;
                    template.UpdatedAt = DateTime.UtcNow;
                    template.UpdatedBy = userId; // Set UpdatedBy for template
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
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin,moderator")]
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
                // For UNCONDITIONED and DEFAULT operators, use null values for validation
                // (don't fall back to existing condition values)
                int? validationValue = null;
                int? validationMinValue = null;
                int? validationMaxValue = null;
                
                var newOperator = request.Operator.ToUpper();
                if (newOperator == "UNCONDITIONED" || newOperator == "DEFAULT")
                {
                    // For sentinel operators, always use null for validation
                    validationValue = null;
                    validationMinValue = null;
                    validationMaxValue = null;
                }
                else
                {
                    // For active operators, use request values or fall back to existing
                    validationValue = request.Value ?? condition.Value;
                    validationMinValue = request.MinValue ?? condition.MinValue;
                    validationMaxValue = request.MaxValue ?? condition.MaxValue;
                }
                
                var validationResult = await _conditionValidationService.ValidateSingleConditionAsync(
                    request.Operator, validationValue, validationMinValue, validationMaxValue);

                if (!validationResult.IsValid)
                    return BadRequest(new { message = validationResult.ErrorMessage });

                // Check for DEFAULT uniqueness if changing to DEFAULT
                if (request.Operator.ToUpper() == "DEFAULT" && condition.Operator != "DEFAULT")
                {
                    if (await _conditionValidationService.IsDefaultAlreadyUsedAsync(condition.QueueId, condition.Id))
                        return BadRequest(new { message = "This queue already has a default template. Set another template as default first." });
                }

                // Overlap check removed - frontend handles overlap detection with user confirmation
                // Users can now create overlapping conditions if they confirm the overlap
                // if (request.Operator.ToUpper() != "DEFAULT" && request.Operator.ToUpper() != "UNCONDITIONED")
                // {
                //     if (await _conditionValidationService.HasOverlapAsync(
                //         condition.QueueId, request.Operator, request.Value ?? condition.Value, 
                //         request.MinValue ?? condition.MinValue, request.MaxValue ?? condition.MaxValue, condition.Id))
                //         return BadRequest(new { message = "هذا الشرط يتداخل مع شرط موجود في الطابور." });
                // }

                condition.Operator = request.Operator.ToUpper();
            }

            // Update value fields based on operator type
            // When operator changes, we need to clear fields that are not relevant to the new operator
            if (request.Operator != null)
            {
                var newOperator = request.Operator.ToUpper();
                
                // Clear fields based on operator type
                if (newOperator == "RANGE")
                {
                    // For RANGE, clear Value and set MinValue/MaxValue
                    condition.Value = null;
                    if (request.MinValue.HasValue)
                        condition.MinValue = request.MinValue;
                    if (request.MaxValue.HasValue)
                        condition.MaxValue = request.MaxValue;
                }
                else if (newOperator == "EQUAL" || newOperator == "GREATER" || newOperator == "LESS")
                {
                    // For EQUAL/GREATER/LESS, set Value and clear MinValue/MaxValue
                    if (request.Value.HasValue)
                        condition.Value = request.Value;
                    condition.MinValue = null;
                    condition.MaxValue = null;
                }
                else if (newOperator == "UNCONDITIONED" || newOperator == "DEFAULT")
                {
                    // For UNCONDITIONED/DEFAULT, clear all values
                    condition.Value = null;
                    condition.MinValue = null;
                    condition.MaxValue = null;
                }
                else
                {
                    // For other cases, update fields if provided
                    if (request.Value.HasValue)
                        condition.Value = request.Value;
                    if (request.MinValue.HasValue)
                        condition.MinValue = request.MinValue;
                    if (request.MaxValue.HasValue)
                        condition.MaxValue = request.MaxValue;
                }
            }
            else
            {
                // Operator not changed, update fields if provided
                if (request.Value.HasValue)
                    condition.Value = request.Value;

                if (request.MinValue.HasValue)
                    condition.MinValue = request.MinValue;

                if (request.MaxValue.HasValue)
                    condition.MaxValue = request.MaxValue;
            }

            // Get current user ID for audit
            var userId = _userContext.GetUserId();
            condition.UpdatedAt = DateTime.UtcNow;
            condition.UpdatedBy = userId;

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

                        // Get template directly using TemplateId foreign key (no reverse lookup needed)
                        var template = await _context.Set<MessageTemplate>()
                            .FirstOrDefaultAsync(t => t.Id == condition.TemplateId);

                        if (template != null)
                        {
                            template.UpdatedAt = DateTime.UtcNow;
                            template.UpdatedBy = userId; // Set UpdatedBy for template
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

            // Use TemplateId foreign key directly (no need to query template)
            var dto = new ConditionDto
            {
                Id = condition.Id,
                TemplateId = condition.TemplateId, // Use foreign key directly
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
        [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin,moderator")]
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

                    // Get template directly using TemplateId foreign key (no reverse lookup needed)
                    var template = await _context.Set<MessageTemplate>()
                        .FirstOrDefaultAsync(t => t.Id == condition.TemplateId);

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
