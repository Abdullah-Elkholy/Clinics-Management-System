using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Clinics.Domain;
using Clinics.Infrastructure.Repositories;

namespace Clinics.Infrastructure.Services
{
    /// <summary>
    /// Service for managing User soft-delete operations for moderators.
    /// Handles:
    /// - Cascading soft-delete of moderator to managed users
    /// - Freeing all quotas associated with moderator and managed users
    /// - Audit logging all operations
    /// - Enforcing 30-day restore TTL
    /// Enforces that primary/secondary admins cannot be soft-deleted.
    /// </summary>
    public interface IModeratorCascadeService
    {
        /// <summary>
        /// Soft-delete a moderator and cascade to all managed users.
        /// Frees quota for the moderator and all managed users.
        /// Blocks deletion of primary/secondary admins.
        /// </summary>
        Task<(bool Success, string? Error)> SoftDeleteModeratorAsync(User moderator, int? deletedBy = null, string? reason = null);

        /// <summary>
        /// Restore a moderator and managed users.
        /// Restores quotas for the moderator and all managed users.
        /// Enforces 30-day restore TTL; returns RestoreResult with error details if TTL expired.
        /// </summary>
        Task<RestoreResult> RestoreModeratorAsync(User moderator, int? restoredBy = null, int ttlDays = 30);
    }

    /// <summary>
    /// Default implementation of ModeratorCascadeService.
    /// </summary>
    public class ModeratorCascadeService : IModeratorCascadeService
    {
        private readonly IGenericUnitOfWork _unitOfWork;
        private readonly IAuditService _auditService;

        public ModeratorCascadeService(IGenericUnitOfWork unitOfWork, IAuditService auditService)
        {
            _unitOfWork = unitOfWork ?? throw new ArgumentNullException(nameof(unitOfWork));
            _auditService = auditService ?? throw new ArgumentNullException(nameof(auditService));
        }

        public async Task<(bool Success, string? Error)> SoftDeleteModeratorAsync(
            User moderator, 
            int? deletedBy = null, 
            string? reason = null)
        {
            return await _unitOfWork.ExecuteInTransactionAsync(async () =>
            {
                // Block deletion of admins
                if (moderator.Role == "primary_admin" || moderator.Role == "secondary_admin")
                {
                    return (false, $"Cannot soft-delete {moderator.Role}. Admins must be permanently retained for audit trail integrity.");
                }

                if (moderator.Role != "moderator")
                {
                    return (false, "Only moderators can be soft-deleted by this service.");
                }

                var userRepo = _unitOfWork.Repository<User>();
                var quotaRepo = _unitOfWork.Repository<Quota>();

                // Find all users managed by this moderator
                var managedUsers = await userRepo.GetByPredicateAsync(u => u.ModeratorId == moderator.Id, includeDeleted: false);

                // Soft-delete all managed users
                foreach (var managedUser in managedUsers)
                {
                    await userRepo.SoftDeleteAsync(managedUser, deletedBy);
                }

                // Free quota for all managed users
                foreach (var managedUser in managedUsers)
                {
                    var managedUserQuota = await quotaRepo.GetByPredicateAsync(q => q.ModeratorUserId == managedUser.Id);
                    if (managedUserQuota.FirstOrDefault() != null)
                    {
                        await quotaRepo.SoftDeleteAsync(managedUserQuota.First(), deletedBy);
                    }
                }

                // Free quota for the moderator
                var moderatorQuota = await quotaRepo.GetByPredicateAsync(q => q.ModeratorUserId == moderator.Id);
                if (moderatorQuota.FirstOrDefault() != null)
                {
                    await quotaRepo.SoftDeleteAsync(moderatorQuota.First(), deletedBy);
                }

                // Soft-delete the moderator
                await userRepo.SoftDeleteAsync(moderator, deletedBy);

                // Save changes
                await _unitOfWork.SaveChangesAsync();

                // Audit log
                await _auditService.LogAsync(
                    AuditAction.SoftDelete,
                    nameof(User),
                    moderator.Id,
                    deletedBy,
                    new { moderator.Id, moderator.Username, moderator.Role },
                    reason ?? "Moderator soft-deleted with cascading",
                    new { 
                        CascadedUsers = managedUsers.Count,
                        QuotasFreed = managedUsers.Count + 1 // +1 for moderator's quota
                    });

                return (true, null);
            });
        }

        public async Task<RestoreResult> RestoreModeratorAsync(User moderator, int? restoredBy = null, int ttlDays = 30)
        {
            // Check TTL first (no need for transaction here)
            var ttlQueries = _unitOfWork.TTLQueries<User>();
            if (!ttlQueries.IsRestoreAllowed(moderator, ttlDays))
            {
                var daysElapsed = (int)Math.Ceiling((DateTime.UtcNow - moderator.DeletedAt!.Value).TotalDays);
                
                // Log restore attempt blocked
                await _auditService.LogAsync(
                    AuditAction.RestoreBlocked,
                    nameof(User),
                    moderator.Id,
                    restoredBy,
                    new { moderator.Id, moderator.DeletedAt, daysElapsed },
                    "Restore attempt blocked: TTL expired");

                return RestoreResult.RestoreWindowExpired(daysElapsed, ttlDays);
            }

            return await _unitOfWork.ExecuteInTransactionAsync(async () =>
            {
                var userRepo = _unitOfWork.Repository<User>();
                var quotaRepo = _unitOfWork.Repository<Quota>();

                // Restore the moderator
                await userRepo.RestoreAsync(moderator);

                // Restore moderator's quota
                var moderatorQuota = await quotaRepo.GetByPredicateAsync(
                    q => q.ModeratorUserId == moderator.Id, 
                    includeDeleted: true);
                foreach (var quota in moderatorQuota.Where(q => q.IsDeleted))
                {
                    await quotaRepo.RestoreAsync(quota);
                }

                // Restore managed users
                var managedUsers = await userRepo.GetByPredicateAsync(
                    u => u.ModeratorId == moderator.Id, 
                    includeDeleted: true);
                foreach (var managedUser in managedUsers.Where(u => u.IsDeleted))
                {
                    await userRepo.RestoreAsync(managedUser);

                    // Restore managed user's quota
                    var managedUserQuota = await quotaRepo.GetByPredicateAsync(
                        q => q.ModeratorUserId == managedUser.Id,
                        includeDeleted: true);
                    foreach (var quota in managedUserQuota.Where(q => q.IsDeleted))
                    {
                        await quotaRepo.RestoreAsync(quota);
                    }
                }

                // Save changes
                await _unitOfWork.SaveChangesAsync();

                // Audit log
                await _auditService.LogAsync(
                    AuditAction.Restore,
                    nameof(User),
                    moderator.Id,
                    restoredBy,
                    new { moderator.Id, moderator.Username, moderator.Role },
                    $"Moderator and {managedUsers.Count(u => u.IsDeleted)} managed users restored");

                return RestoreResult.SuccessResult();
            });
        }
    }
}
