using System;
using System.Text.Json;
using System.Threading.Tasks;
using Clinics.Domain;
using Microsoft.EntityFrameworkCore;

namespace Clinics.Infrastructure.Services
{
    /// <summary>
    /// Service for logging audit trail entries for compliance and debugging.
    /// Logs all significant operations: Create, Update, SoftDelete, Restore, Purge, etc.
    /// </summary>
    public interface IAuditService
    {
        /// <summary>
        /// Log an action to the audit trail.
        /// </summary>
        /// <param name="action">The action type (Create, Update, SoftDelete, etc.)</param>
        /// <param name="entityType">The type of entity being modified (e.g., "Queue", "Patient")</param>
        /// <param name="entityId">The primary key of the entity</param>
        /// <param name="actorUserId">The user performing the action (null for system operations)</param>
        /// <param name="changes">JSON representation of changes or new values</param>
        /// <param name="notes">Optional notes or reason for the operation</param>
        /// <param name="metadata">Optional JSON metadata (e.g., cascade impact, quota freed)</param>
        Task LogAsync(
            AuditAction action,
            string entityType,
            int entityId,
            int? actorUserId,
            object? changes = null,
            string? notes = null,
            object? metadata = null);
    }

    /// <summary>
    /// Default implementation of AuditService using Entity Framework.
    /// </summary>
    public class AuditService : IAuditService
    {
        private readonly ApplicationDbContext _context;

        public AuditService(ApplicationDbContext context)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
        }

        public async Task LogAsync(
            AuditAction action,
            string entityType,
            int entityId,
            int? actorUserId,
            object? changes = null,
            string? notes = null,
            object? metadata = null)
        {
            try
            {
                var auditLog = new AuditLog
                {
                    Action = action,
                    EntityType = entityType,
                    EntityId = entityId,
                    ActorUserId = actorUserId,
                    CreatedAt = DateTime.UtcNow,
                    Changes = changes != null ? JsonSerializer.Serialize(changes) : null,
                    Notes = notes,
                    Metadata = metadata != null ? JsonSerializer.Serialize(metadata) : null
                };

                await _context.AuditLogs.AddAsync(auditLog);
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                // Log audit errors to console but don't throw - audit failures shouldn't break the app
                Console.WriteLine($"Audit logging failed: {ex.Message}");
            }
        }
    }
}
