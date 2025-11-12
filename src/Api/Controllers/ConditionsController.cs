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

            // Get all conditions for this queue
            var conditions = await _context.Set<MessageCondition>()
                .Where(c => c.QueueId == queueId)
                .OrderBy(c => c.CreatedAt)
                .ToListAsync();

            var dtos = conditions.Select(c => new ConditionDto
            {
                Id = c.Id,
                TemplateId = c.TemplateId,
                QueueId = c.QueueId,
                Operator = c.Operator,
                Value = c.Value,
                MinValue = c.MinValue,
                MaxValue = c.MaxValue,
                CreatedAt = c.CreatedAt,
                UpdatedAt = c.UpdatedAt
            }).ToList();

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
                TemplateId = condition.TemplateId,
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
        /// Create a new condition for a template in a queue.
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

            // Check for overlaps with existing conditions
            if (await _conditionValidationService.HasOverlapAsync(
                request.QueueId, request.Operator, request.Value, request.MinValue, request.MaxValue))
                return BadRequest(new { message = "This condition overlaps with an existing condition in the queue." });

            // Create condition
            var condition = new MessageCondition
            {
                TemplateId = request.TemplateId,
                QueueId = request.QueueId,
                Operator = request.Operator.ToUpper(),
                Value = request.Value,
                MinValue = request.MinValue,
                MaxValue = request.MaxValue,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            _context.Set<MessageCondition>().Add(condition);
            await _context.SaveChangesAsync();

            var dto = new ConditionDto
            {
                Id = condition.Id,
                TemplateId = condition.TemplateId,
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

        /// <summary>
        /// PUT /api/conditions/{id}
        /// Update an existing condition.
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

            // Update fields if provided
            if (request.Operator != null)
            {
                var validationResult = await _conditionValidationService.ValidateSingleConditionAsync(
                    request.Operator, request.Value ?? condition.Value, request.MinValue ?? condition.MinValue, request.MaxValue ?? condition.MaxValue);

                if (!validationResult.IsValid)
                    return BadRequest(new { message = validationResult.ErrorMessage });

                condition.Operator = request.Operator.ToUpper();
            }

            if (request.Value.HasValue)
                condition.Value = request.Value;

            if (request.MinValue.HasValue)
                condition.MinValue = request.MinValue;

            if (request.MaxValue.HasValue)
                condition.MaxValue = request.MaxValue;

            condition.UpdatedAt = DateTime.UtcNow;

            _context.Set<MessageCondition>().Update(condition);
            await _context.SaveChangesAsync();

            var dto = new ConditionDto
            {
                Id = condition.Id,
                TemplateId = condition.TemplateId,
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
        /// Delete a condition (template reverts to default).
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

            _context.Set<MessageCondition>().Remove(condition);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}
