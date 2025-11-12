using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Clinics.Domain;
using Clinics.Infrastructure;

namespace Clinics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuditController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public AuditController(ApplicationDbContext context)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
        }

        /// <summary>
        /// Get audit logs with optional filtering.
        /// Supports filtering by entity type, entity ID, action, actor, and date range.
        /// </summary>
        [HttpGet]
        public async Task<IActionResult> GetAuditLogs(
            [FromQuery] string? entityType = null,
            [FromQuery] int? entityId = null,
            [FromQuery] int? action = null,
            [FromQuery] int? actorUserId = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null,
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 50)
        {
            try
            {
                if (pageNumber < 1) pageNumber = 1;
                if (pageSize < 1) pageSize = 10;
                if (pageSize > 500) pageSize = 500; // Cap max page size

                var query = _context.AuditLogs.AsQueryable();

                // Apply filters
                if (!string.IsNullOrEmpty(entityType))
                    query = query.Where(a => a.EntityType == entityType);

                if (entityId.HasValue)
                    query = query.Where(a => a.EntityId == entityId.Value);

                if (action.HasValue)
                    query = query.Where(a => a.Action == (AuditAction)action.Value);

                if (actorUserId.HasValue)
                    query = query.Where(a => a.ActorUserId == actorUserId.Value);

                // Set default date range to last 30 days
                if (startDate == null)
                    startDate = DateTime.UtcNow.AddDays(-30);

                query = query.Where(a => a.CreatedAt >= startDate);

                if (endDate.HasValue)
                    query = query.Where(a => a.CreatedAt <= endDate);

                // Get total count
                var total = await query.CountAsync();

                // Apply pagination and include actor info
                var auditLogs = await query
                    .Include(a => a.Actor)
                    .OrderByDescending(a => a.CreatedAt)
                    .Skip((pageNumber - 1) * pageSize)
                    .Take(pageSize)
                    .Select(a => new
                    {
                        a.Id,
                        a.Action,
                        a.EntityType,
                        a.EntityId,
                        ActorUsername = a.Actor != null ? a.Actor.Username : "System",
                        a.CreatedAt,
                        a.Changes,
                        a.Notes,
                        a.Metadata
                    })
                    .ToListAsync();

                return Ok(new
                {
                    data = auditLogs,
                    pagination = new
                    {
                        pageNumber,
                        pageSize,
                        total,
                        totalPages = (int)Math.Ceiling(total / (double)pageSize)
                    }
                });
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error retrieving audit logs", error = ex.Message });
            }
        }

        /// <summary>
        /// Get audit logs for a specific entity type (e.g., all queue deletions).
        /// </summary>
        [HttpGet("by-entity/{entityType}")]
        public async Task<IActionResult> GetAuditLogsByEntity(
            string entityType,
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 50)
        {
            return await GetAuditLogs(
                entityType: entityType,
                pageNumber: pageNumber,
                pageSize: pageSize);
        }

        /// <summary>
        /// Get audit logs for a specific entity instance.
        /// </summary>
        [HttpGet("{entityType}/{entityId}")]
        public async Task<IActionResult> GetAuditLogsForEntity(
            string entityType,
            int entityId,
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 50)
        {
            return await GetAuditLogs(
                entityType: entityType,
                entityId: entityId,
                pageNumber: pageNumber,
                pageSize: pageSize);
        }

        /// <summary>
        /// Get audit logs for actions by a specific user (actor).
        /// </summary>
        [HttpGet("by-user/{actorUserId}")]
        public async Task<IActionResult> GetAuditLogsByUser(
            int actorUserId,
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 50)
        {
            return await GetAuditLogs(
                actorUserId: actorUserId,
                pageNumber: pageNumber,
                pageSize: pageSize);
        }

        /// <summary>
        /// Get audit logs for a specific action type.
        /// </summary>
        [HttpGet("by-action/{action}")]
        public async Task<IActionResult> GetAuditLogsByAction(
            int action,
            [FromQuery] int pageNumber = 1,
            [FromQuery] int pageSize = 50)
        {
            if (!Enum.IsDefined(typeof(AuditAction), action))
                return BadRequest(new { message = "Invalid action value" });

            return await GetAuditLogs(
                action: action,
                pageNumber: pageNumber,
                pageSize: pageSize);
        }

        /// <summary>
        /// Export audit logs as CSV (limited to 10,000 rows).
        /// </summary>
        [HttpGet("export")]
        public async Task<IActionResult> ExportAuditLogs(
            [FromQuery] string? entityType = null,
            [FromQuery] int? entityId = null,
            [FromQuery] int? action = null,
            [FromQuery] DateTime? startDate = null,
            [FromQuery] DateTime? endDate = null)
        {
            try
            {
                var query = _context.AuditLogs.AsQueryable();

                if (!string.IsNullOrEmpty(entityType))
                    query = query.Where(a => a.EntityType == entityType);

                if (entityId.HasValue)
                    query = query.Where(a => a.EntityId == entityId.Value);

                if (action.HasValue)
                    query = query.Where(a => a.Action == (AuditAction)action.Value);

                if (startDate == null)
                    startDate = DateTime.UtcNow.AddDays(-90);

                query = query.Where(a => a.CreatedAt >= startDate);

                if (endDate.HasValue)
                    query = query.Where(a => a.CreatedAt <= endDate);

                var logs = await query
                    .Include(a => a.Actor)
                    .OrderByDescending(a => a.CreatedAt)
                    .Take(10000)
                    .ToListAsync();

                // Generate CSV
                var csv = GenerateAuditLogsCsv(logs);
                var fileName = $"AuditLogs_{DateTime.UtcNow:yyyyMMdd_HHmmss}.csv";

                return File(System.Text.Encoding.UTF8.GetBytes(csv), "text/csv", fileName);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { message = "Error exporting audit logs", error = ex.Message });
            }
        }

        private string GenerateAuditLogsCsv(List<AuditLog> logs)
        {
            var lines = new List<string>
            {
                "Id,Action,EntityType,EntityId,ActorUsername,CreatedAt,Notes"
            };

            foreach (var log in logs)
            {
                var actorUsername = log.Actor?.Username ?? "System";
                var notes = log.Notes?.Replace(",", ";") ?? "";
                lines.Add($"{log.Id},\"{log.Action}\",\"{log.EntityType}\",{log.EntityId},\"{actorUsername}\",\"{log.CreatedAt:O}\",\"{notes}\"");
            }

            return string.Join("\n", lines);
        }
    }
}
