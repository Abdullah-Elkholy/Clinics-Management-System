using System;
using System.Linq;
using System.Threading.Tasks;
using Clinics.Domain;
using Clinics.Infrastructure.Repositories;

namespace Clinics.Infrastructure.Services
{
    /// <summary>
    /// Service for managing MessageTemplate soft-delete operations with cascading.
    /// Handles bidirectional Template ↔ Condition cascade:
    /// - When template is deleted, all conditions are soft-deleted
    /// - When condition is deleted, template remains if other conditions exist
    /// Enforces default template protection rules and 30-day restore TTL.
    /// </summary>
    public interface ITemplateCascadeService
    {
        /// <summary>
        /// Soft-delete a template and cascade to all related conditions.
        /// Blocks deletion if template is marked as default (must replace first).
        /// </summary>
        Task<(bool Success, string? Error)> SoftDeleteTemplateAsync(MessageTemplate template, int? deletedBy = null, int? replacementTemplateId = null);

        /// <summary>
        /// Soft-delete a condition. Does not affect template even if it was the last condition.
        /// </summary>
        Task<bool> SoftDeleteConditionAsync(MessageCondition condition, int? deletedBy = null);

        /// <summary>
        /// Restore a template and its soft-deleted conditions.
        /// Enforces 30-day restore TTL; returns RestoreResult with error details if TTL expired.
        /// </summary>
        Task<RestoreResult> RestoreTemplateAsync(MessageTemplate template, int? restoredBy = null, int ttlDays = 30);
    }

    /// <summary>
    /// Default implementation of TemplateCascadeService.
    /// </summary>
    public class TemplateCascadeService : ITemplateCascadeService
    {
        private readonly IGenericUnitOfWork _unitOfWork;
        private readonly IAuditService _auditService;

        public TemplateCascadeService(IGenericUnitOfWork unitOfWork, IAuditService auditService)
        {
            _unitOfWork = unitOfWork ?? throw new ArgumentNullException(nameof(unitOfWork));
            _auditService = auditService ?? throw new ArgumentNullException(nameof(auditService));
        }

        public async Task<(bool Success, string? Error)> SoftDeleteTemplateAsync(
            MessageTemplate template, 
            int? deletedBy = null, 
            int? replacementTemplateId = null)
        {
            return await _unitOfWork.ExecuteInTransactionAsync(async () =>
            {
                var templateRepo = _unitOfWork.Repository<MessageTemplate>();
                var conditionRepo = _unitOfWork.Repository<MessageCondition>();

                // Block deletion if template has DEFAULT condition and no replacement provided
                var templateCondition = await conditionRepo.GetByPredicateAsync(c => c.TemplateId == template.Id && !c.IsDeleted);
                if (templateCondition.Any(c => c.Operator == "DEFAULT") && !replacementTemplateId.HasValue)
                {
                    return (false, "Cannot delete the default template without specifying a replacement template.");
                }

                // If replacement specified, update replacement's condition to DEFAULT
                if (replacementTemplateId.HasValue && replacementTemplateId.Value != template.Id)
                {
                    var replacementTemplate = await templateRepo.GetAsync(replacementTemplateId.Value);
                    if (replacementTemplate != null && replacementTemplate.QueueId == template.QueueId)
                    {
                        var replacementCondition = await conditionRepo.GetByPredicateAsync(c => c.TemplateId == replacementTemplate.Id && !c.IsDeleted);
                        if (replacementCondition.Any())
                        {
                            var cond = replacementCondition.First();
                            cond.Operator = "DEFAULT";
                            cond.Value = null;
                            cond.MinValue = null;
                            cond.MaxValue = null;
                            await conditionRepo.UpdateAsync(cond);
                        }
                        else
                        {
                            var newCond = new MessageCondition
                            {
                                TemplateId = replacementTemplate.Id,
                                QueueId = template.QueueId,
                                Operator = "DEFAULT",
                                CreatedAt = DateTime.UtcNow,
                                UpdatedAt = DateTime.UtcNow
                            };
                            await conditionRepo.AddAsync(newCond);
                        }

                        // Audit log for toggle default
                        await _auditService.LogAsync(
                            AuditAction.ToggleDefault,
                            nameof(MessageTemplate),
                            replacementTemplate.Id,
                            deletedBy,
                            new { Operator = "DEFAULT" },
                            $"Template promoted to default (replacing {template.Id})");
                    }
                }

                // Soft-delete all conditions for this template
                var conditions = await conditionRepo.GetByPredicateAsync(c => c.TemplateId == template.Id, includeDeleted: false);
                foreach (var condition in conditions)
                {
                    await conditionRepo.SoftDeleteAsync(condition, deletedBy);
                }

                // Soft-delete the template itself
                await templateRepo.SoftDeleteAsync(template, deletedBy);

                // Save changes
                await _unitOfWork.SaveChangesAsync();

                // Audit log
                await _auditService.LogAsync(
                    AuditAction.SoftDelete,
                    nameof(MessageTemplate),
                    template.Id,
                    deletedBy,
                    new { template.Id, template.QueueId, HasDefaultCondition = templateCondition.Any(c => c.Operator == "DEFAULT") },
                    $"Template soft-deleted with {conditions.Count} conditions",
                    new { ConditionsCascaded = conditions.Count, ReplacementTemplateId = replacementTemplateId });

                return (true, null);
            });
        }

        public async Task<bool> SoftDeleteConditionAsync(MessageCondition condition, int? deletedBy = null)
        {
            return await _unitOfWork.ExecuteInTransactionAsync(async () =>
            {
                var conditionRepo = _unitOfWork.Repository<MessageCondition>();

                // Soft-delete the condition
                await conditionRepo.SoftDeleteAsync(condition, deletedBy);

                // Save changes
                await _unitOfWork.SaveChangesAsync();

                // Audit log
                await _auditService.LogAsync(
                    AuditAction.SoftDelete,
                    nameof(MessageCondition),
                    condition.Id,
                    deletedBy,
                    new { condition.Id, condition.TemplateId },
                    "Condition soft-deleted");

                return true;
            });
        }

        public async Task<RestoreResult> RestoreTemplateAsync(MessageTemplate template, int? restoredBy = null, int ttlDays = 30)
        {
            // Check TTL first (no need for transaction here)
            var ttlQueries = _unitOfWork.TTLQueries<MessageTemplate>();
            if (!ttlQueries.IsRestoreAllowed(template, ttlDays))
            {
                var daysElapsed = (int)Math.Ceiling((DateTime.UtcNow - template.DeletedAt!.Value).TotalDays);
                
                // Log restore attempt blocked
                await _auditService.LogAsync(
                    AuditAction.RestoreBlocked,
                    nameof(MessageTemplate),
                    template.Id,
                    restoredBy,
                    new { template.Id, template.DeletedAt, daysElapsed },
                    "Restore attempt blocked: TTL expired");

                return RestoreResult.RestoreWindowExpired(daysElapsed, ttlDays);
            }

            return await _unitOfWork.ExecuteInTransactionAsync(async () =>
            {
                var templateRepo = _unitOfWork.Repository<MessageTemplate>();

                // Restore the template
                await templateRepo.RestoreAsync(template);

                // Restore soft-deleted conditions for this template
                var conditionRepo = _unitOfWork.Repository<MessageCondition>();
                var conditions = await conditionRepo.GetByPredicateAsync(c => c.TemplateId == template.Id, includeDeleted: true);
                foreach (var condition in conditions.Where(c => c.IsDeleted))
                {
                    await conditionRepo.RestoreAsync(condition);
                }

                // Save changes
                await _unitOfWork.SaveChangesAsync();

                // Audit log
                await _auditService.LogAsync(
                    AuditAction.Restore,
                    nameof(MessageTemplate),
                    template.Id,
                    restoredBy,
                    new { template.Id, template.QueueId },
                    $"Template and {conditions.Count(c => c.IsDeleted)} conditions restored");

                return RestoreResult.SuccessResult();
            });
        }
    }
}
