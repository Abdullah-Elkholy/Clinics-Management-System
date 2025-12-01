using Clinics.Application.Interfaces;
using Clinics.Api.Services;
using Clinics.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace Clinics.Api.Interceptors
{
    /// <summary>
    /// EF Core SaveChanges interceptor that automatically populates audit fields.
    /// Sets CreatedBy/UpdatedBy and CreatedAt/UpdatedAt for all entities.
    /// </summary>
    public class AuditFieldsInterceptor : SaveChangesInterceptor
    {
        private readonly IUserContext _userContext;

        public AuditFieldsInterceptor(IUserContext userContext)
        {
            _userContext = userContext;
        }

        public override InterceptionResult<int> SavingChanges(
            DbContextEventData eventData,
            InterceptionResult<int> result)
        {
            UpdateAuditFields(eventData.Context);
            return base.SavingChanges(eventData, result);
        }

        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            UpdateAuditFields(eventData.Context);
            return base.SavingChangesAsync(eventData, result, cancellationToken);
        }

        private void UpdateAuditFields(DbContext? context)
        {
            if (context == null) return;

            // Try to get current user ID (may be null for unauthenticated operations like migrations)
            int? currentUserId = null;
            try
            {
                currentUserId = _userContext.GetUserId();
            }
            catch (InvalidOperationException)
            {
                // No authenticated user (migrations, background jobs, etc.)
                // Leave currentUserId as null
            }

            var now = DateTime.UtcNow;

            var entries = context.ChangeTracker.Entries()
                .Where(e => e.State == EntityState.Added || e.State == EntityState.Modified);

            foreach (var entry in entries)
            {
                // Handle Added entities
                if (entry.State == EntityState.Added)
                {
                    // Set CreatedBy if property exists
                    if (HasProperty(entry.Entity, "CreatedBy"))
                    {
                        var createdByProperty = entry.Property("CreatedBy");
                        // Only set if not already set (allow manual override)
                        if (createdByProperty.CurrentValue == null || 
                            (createdByProperty.CurrentValue is int val && val == 0))
                        {
                            createdByProperty.CurrentValue = currentUserId;
                        }
                    }

                    // Set CreatedAt if property exists
                    if (HasProperty(entry.Entity, "CreatedAt"))
                    {
                        var createdAtProperty = entry.Property("CreatedAt");
                        // Only set if not already set (allow manual override)
                        if (createdAtProperty.CurrentValue is DateTime dt && dt == default)
                        {
                            createdAtProperty.CurrentValue = now;
                        }
                    }

                    // Set UpdatedBy for new entities too (same as CreatedBy)
                    if (HasProperty(entry.Entity, "UpdatedBy"))
                    {
                        var updatedByProperty = entry.Property("UpdatedBy");
                        if (updatedByProperty.CurrentValue == null || 
                            (updatedByProperty.CurrentValue is int val && val == 0))
                        {
                            updatedByProperty.CurrentValue = currentUserId;
                        }
                    }

                    // Set UpdatedAt for new entities
                    if (HasProperty(entry.Entity, "UpdatedAt"))
                    {
                        entry.Property("UpdatedAt").CurrentValue = now;
                    }
                }
                // Handle Modified entities
                else if (entry.State == EntityState.Modified)
                {
                    // Set UpdatedBy
                    if (HasProperty(entry.Entity, "UpdatedBy"))
                    {
                        entry.Property("UpdatedBy").CurrentValue = currentUserId;
                    }

                    // Set UpdatedAt
                    if (HasProperty(entry.Entity, "UpdatedAt"))
                    {
                        entry.Property("UpdatedAt").CurrentValue = now;
                    }

                    // Don't modify CreatedBy/CreatedAt on updates
                }

                // Handle soft-delete audit (DeletedBy)
                if (entry.State == EntityState.Modified && HasProperty(entry.Entity, "IsDeleted"))
                {
                    var isDeletedProperty = entry.Property("IsDeleted");
                    if (isDeletedProperty.CurrentValue is bool isDeleted && isDeleted)
                    {
                        // Check if IsDeleted was just changed to true
                        if (isDeletedProperty.OriginalValue is bool originalDeleted && !originalDeleted)
                        {
                            // Set DeletedBy
                            if (HasProperty(entry.Entity, "DeletedBy"))
                            {
                                entry.Property("DeletedBy").CurrentValue = currentUserId;
                            }

                            // Set DeletedAt
                            if (HasProperty(entry.Entity, "DeletedAt"))
                            {
                                entry.Property("DeletedAt").CurrentValue = now;
                            }
                        }
                    }
                }

                // Handle pause audit (PausedBy)
                if (entry.State == EntityState.Modified && HasProperty(entry.Entity, "IsPaused"))
                {
                    var isPausedProperty = entry.Property("IsPaused");
                    if (isPausedProperty.CurrentValue is bool isPaused && isPaused)
                    {
                        // Check if IsPaused was just changed to true
                        if (isPausedProperty.OriginalValue is bool originalPaused && !originalPaused)
                        {
                            // Set PausedBy
                            if (HasProperty(entry.Entity, "PausedBy"))
                            {
                                var pausedByProperty = entry.Property("PausedBy");
                                // Only set if not already set
                                if (pausedByProperty.CurrentValue == null || 
                                    (pausedByProperty.CurrentValue is int val && val == 0))
                                {
                                    pausedByProperty.CurrentValue = currentUserId;
                                }
                            }

                            // Set PausedAt
                            if (HasProperty(entry.Entity, "PausedAt"))
                            {
                                var pausedAtProperty = entry.Property("PausedAt");
                                if (pausedAtProperty.CurrentValue == null)
                                {
                                    pausedAtProperty.CurrentValue = now;
                                }
                            }
                        }
                    }
                }
            }
        }

        private bool HasProperty(object entity, string propertyName)
        {
            return entity.GetType().GetProperty(propertyName) != null;
        }
    }
}
