using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Clinics.Domain;
using Clinics.Infrastructure.Repositories;

namespace Clinics.Infrastructure.Services
{
    /// <summary>
    /// Service for managing Queue soft-delete operations with cascading.
    /// Handles:
    /// - Cascading soft-delete to Patients, Templates, Conditions, and Messages
    /// - Freeing consumed quota slots
    /// - Audit logging all operations
    /// - Enforcing 30-day restore TTL
    /// </summary>
    public interface IQueueCascadeService
    {
        /// <summary>
        /// Soft-delete a queue and cascade to all related entities.
        /// Frees ConsumedQueues quota slots for the moderator.
        /// </summary>
        Task<bool> SoftDeleteQueueAsync(Queue queue, int? deletedBy = null, string? reason = null);

        /// <summary>
        /// Restore a queue and cascade restore to related entities (templates, messages).
        /// Checks if moderator has available quota before restoring.
        /// Enforces 30-day restore TTL; returns RestoreResult with error details if TTL expired.
        /// </summary>
        Task<RestoreResult> RestoreQueueAsync(Queue queue, int? restoredBy = null, int ttlDays = 30);
    }

    /// <summary>
    /// Default implementation of QueueCascadeService.
    /// </summary>
    public class QueueCascadeService : IQueueCascadeService
    {
        private readonly IGenericUnitOfWork _unitOfWork;
        private readonly IAuditService _auditService;

        public QueueCascadeService(IGenericUnitOfWork unitOfWork, IAuditService auditService)
        {
            _unitOfWork = unitOfWork ?? throw new ArgumentNullException(nameof(unitOfWork));
            _auditService = auditService ?? throw new ArgumentNullException(nameof(auditService));
        }

        public async Task<bool> SoftDeleteQueueAsync(Queue queue, int? deletedBy = null, string? reason = null)
        {
            return await _unitOfWork.ExecuteInTransactionAsync(async () =>
            {
                // Unify datetime for this bulk operation
                var deletionTimestamp = DateTime.UtcNow;

                // Soft-delete all patients in the queue
                var patientRepo = _unitOfWork.Repository<Patient>();
                var patients = await patientRepo.GetByPredicateAsync(p => p.QueueId == queue.Id, includeDeleted: false);
                foreach (var patient in patients)
                {
                    await patientRepo.SoftDeleteAsync(patient, deletedBy);
                }

                // Soft-delete all templates for this queue
                var templateRepo = _unitOfWork.Repository<MessageTemplate>();
                var templates = await templateRepo.GetByPredicateAsync(t => t.QueueId == queue.Id, includeDeleted: false);
                foreach (var template in templates)
                {
                    await templateRepo.SoftDeleteAsync(template, deletedBy);

                    // Soft-delete condition for this template (one-to-one relationship)
                    var condition = template.Condition;
                    if (condition != null && !condition.IsDeleted)
                    {
                        var conditionRepo = _unitOfWork.Repository<MessageCondition>();
                        await conditionRepo.SoftDeleteAsync(condition, deletedBy);
                    }
                }

                // Soft-delete all messages for this queue
                var messageRepo = _unitOfWork.Repository<Message>();
                var messages = await messageRepo.GetByPredicateAsync(m => m.QueueId == queue.Id, includeDeleted: false);
                foreach (var message in messages)
                {
                    await messageRepo.SoftDeleteAsync(message, deletedBy);
                }

                // Soft-delete the queue itself
                var queueRepo = _unitOfWork.Repository<Queue>();
                await queueRepo.SoftDeleteAsync(queue, deletedBy);

                // Free consumed quota for the moderator
                var quotaRepo = _unitOfWork.Repository<Quota>();
                var quotas = await quotaRepo.GetByPredicateAsync(q => q.ModeratorUserId == queue.ModeratorId);
                if (quotas.FirstOrDefault() != null)
                {
                    var quota = quotas.First();
                    quota.ConsumedQueues--;
                    if (quota.ConsumedQueues < 0) quota.ConsumedQueues = 0;
                    await quotaRepo.UpdateAsync(quota);
                }

                // Save changes
                await _unitOfWork.SaveChangesAsync();

                // Audit log
                await _auditService.LogAsync(
                    AuditAction.SoftDelete,
                    nameof(Queue),
                    queue.Id,
                    deletedBy,
                    new { queue.Id, queue.DoctorName, queue.ModeratorId },
                    reason ?? "Queue soft-deleted with cascading",
                    new { CascadedEntities = new { Patients = patients.Count, Templates = templates.Count, Messages = messages.Count } });

                return true;
            });
        }

        public async Task<RestoreResult> RestoreQueueAsync(Queue queue, int? restoredBy = null, int ttlDays = 30)
        {
            // Check TTL first (no need for transaction here)
            var ttlQueries = _unitOfWork.TTLQueries<Queue>();
            if (!ttlQueries.IsRestoreAllowed(queue, ttlDays))
            {
                var daysElapsed = (int)Math.Ceiling((DateTime.UtcNow - queue.DeletedAt!.Value).TotalDays);
                
                // Log restore attempt blocked
                await _auditService.LogAsync(
                    AuditAction.RestoreBlocked,
                    nameof(Queue),
                    queue.Id,
                    restoredBy,
                    new { queue.Id, queue.DeletedAt, daysElapsed },
                    "Restore attempt blocked: TTL expired");

                return RestoreResult.RestoreWindowExpired(daysElapsed, ttlDays);
            }

            return await _unitOfWork.ExecuteInTransactionAsync(async () =>
            {
                // Capture operation snapshot timestamp to ensure consistency across all transaction operations
                var operationTimestamp = DateTime.UtcNow;

                // Get queue and quota repositories
                var quotaRepo = _unitOfWork.Repository<Quota>();
                var queueRepo = _unitOfWork.Repository<Queue>();
                
                // Query for moderator quota (should exist; created via moderator lifecycle or GetOrCreateQuotaForModeratorAsync)
                var quotas = await quotaRepo.GetByPredicateAsync(q => q.ModeratorUserId == queue.ModeratorId);
                var quota = quotas.FirstOrDefault();
                
                // Count active (non-deleted) queues for this moderator
                var activeQueueCount = await queueRepo.GetByPredicateAsync(q => q.ModeratorId == queue.ModeratorId && !q.IsDeleted);
                
                // If quota exists, check if we have room to restore
                if (quota != null && activeQueueCount.Count >= quota.QueuesQuota)
                {
                    return RestoreResult.QuotaInsufficient("Queues", 
                        quota.QueuesQuota - activeQueueCount.Count, 1);
                }

                // Restore the queue with snapshot timestamp
                await queueRepo.RestoreAsync(queue, restoredBy, operationTimestamp);

                // Restore related patients
                var patientRepo = _unitOfWork.Repository<Patient>();
                var patients = await patientRepo.GetByPredicateAsync(p => p.QueueId == queue.Id, includeDeleted: true);
                foreach (var patient in patients.Where(p => p.IsDeleted && p.DeletedAt.HasValue && p.DeletedAt >= queue.DeletedAt))
                {
                    await patientRepo.RestoreAsync(patient, restoredBy, operationTimestamp);
                }

                // Restore related templates and conditions
                var templateRepo = _unitOfWork.Repository<MessageTemplate>();
                var templates = await templateRepo.GetByPredicateAsync(t => t.QueueId == queue.Id, includeDeleted: true);
                foreach (var template in templates.Where(t => t.IsDeleted && t.DeletedAt.HasValue && t.DeletedAt >= queue.DeletedAt))
                {
                    await templateRepo.RestoreAsync(template, restoredBy, operationTimestamp);

                    // Restore condition for soft-deleted template (one-to-one relationship)
                    var condition = template.Condition;
                    if (condition != null && condition.IsDeleted && condition.DeletedAt.HasValue && condition.DeletedAt >= queue.DeletedAt)
                    {
                        var conditionRepo = _unitOfWork.Repository<MessageCondition>();
                        await conditionRepo.RestoreAsync(condition, restoredBy, operationTimestamp);
                    }
                }

                // Restore related messages
                var messageRepo = _unitOfWork.Repository<Message>();
                var messages = await messageRepo.GetByPredicateAsync(m => m.QueueId == queue.Id, includeDeleted: true);
                foreach (var message in messages.Where(m => m.IsDeleted && m.DeletedAt.HasValue && m.DeletedAt >= queue.DeletedAt))
                {
                    await messageRepo.RestoreAsync(message, restoredBy, operationTimestamp);
                }

                // Update quota consumed count (track current active count) - only if quota exists
                if (quota != null)
                {
                    quota.ConsumedQueues = activeQueueCount.Count + 1;
                    quota.UpdatedAt = operationTimestamp;
                    quota.UpdatedBy = restoredBy;
                    await quotaRepo.UpdateAsync(quota);
                }

                // Save changes
                await _unitOfWork.SaveChangesAsync();

                // Audit log
                await _auditService.LogAsync(
                    AuditAction.Restore,
                    nameof(Queue),
                    queue.Id,
                    restoredBy,
                    new { queue.Id, queue.DoctorName },
                    "Queue and related entities restored");

                return RestoreResult.SuccessResult();
            });
        }
    }
}
