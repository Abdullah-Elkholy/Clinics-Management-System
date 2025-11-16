/**
 * Template Cascade Service - Soft Delete Handler
 * File: src/Api/Services/TemplateCascadeService.cs
 * 
 * Handles cascading soft-deletes for message templates
 * Enforces business rules:
 * - Cannot delete if it's the only default template for queue
 * - Must provide replacement template if deleting default
 * - Soft-delete related conditions
 * - Audit log the deletion
 */

using Clinics.Domain;
using Clinics.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Clinics.Api.Services;

public interface ITemplateCascadeService
{
    /// <summary>
    /// Soft-delete a template and related conditions
    /// </summary>
    Task<(bool Success, string ErrorMessage)> SoftDeleteTemplateAsync(int templateId, int deletedByUserId, int? replacementTemplateId = null);

    /// <summary>
    /// Restore a previously soft-deleted template
    /// </summary>
    Task<(bool Success, string ErrorMessage)> RestoreTemplateAsync(int templateId, int? restoredBy = null);

    /// <summary>
    /// Get soft-deleted templates for a queue (trash)
    /// </summary>
    Task<(List<MessageTemplate> Items, int TotalCount)> GetTrashTemplatesAsync(int queueId, int pageNumber, int pageSize);

    /// <summary>
    /// Get permanently deleted templates (archived - over 30 days)
    /// </summary>
    Task<(List<MessageTemplate> Items, int TotalCount)> GetArchivedTemplatesAsync(int queueId, int pageNumber, int pageSize);

    /// <summary>
    /// Permanently delete archived templates (cron job)
    /// </summary>
    Task<int> PermanentlyDeleteArchivedTemplatesAsync();
}

public class TemplateCascadeService : ITemplateCascadeService
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<TemplateCascadeService> _logger;
    private const int TTL_DAYS = 30;

    public TemplateCascadeService(ApplicationDbContext db, ILogger<TemplateCascadeService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<(bool Success, string ErrorMessage)> SoftDeleteTemplateAsync(
        int templateId, int deletedByUserId, int? replacementTemplateId = null)
    {
        // Wrap in transaction for atomicity
        await using var transaction = await _db.Database.BeginTransactionAsync();
        try
        {
            // Unify datetime for this bulk operation
            var deletionTimestamp = DateTime.UtcNow;

            var template = await _db.MessageTemplates
                .FirstOrDefaultAsync(t => t.Id == templateId && !t.IsDeleted);

            if (template == null)
            {
                await transaction.RollbackAsync();
                return (false, "Template not found");
            }

            // If this template has a DEFAULT condition, require replacement or ensure there's another default
            // Load template's condition via navigation property
            await _db.Entry(template).Reference(t => t.Condition).LoadAsync();
            var templateCondition = template.Condition != null && !template.Condition.IsDeleted 
                ? template.Condition 
                : null;
            
            if (templateCondition?.Operator == "DEFAULT")
            {
                var otherActiveTemplates = await _db.MessageTemplates
                    .Where(t => t.QueueId == template.QueueId && t.Id != templateId && !t.IsDeleted)
                    .ToListAsync();

                if (otherActiveTemplates.Count == 0 && !replacementTemplateId.HasValue)
                {
                    await transaction.RollbackAsync();
                    return (false, "default_template_replacement_required");
                }

                // If replacement provided, make it the new default
                if (replacementTemplateId.HasValue)
                {
                    var replacement = otherActiveTemplates.FirstOrDefault(t => t.Id == replacementTemplateId.Value);
                    if (replacement == null)
                    {
                        await transaction.RollbackAsync();
                        return (false, "Replacement template not found or not active");
                    }
                    
                    // Load replacement template's condition via navigation property
                    await _db.Entry(replacement).Reference(t => t.Condition).LoadAsync();
                    var replacementCondition = replacement.Condition != null && !replacement.Condition.IsDeleted 
                        ? replacement.Condition 
                        : null;
                    if (replacementCondition != null)
                    {
                        replacementCondition.Operator = "DEFAULT";
                        replacementCondition.Value = null;
                        replacementCondition.MinValue = null;
                        replacementCondition.MaxValue = null;
                        replacementCondition.UpdatedAt = deletionTimestamp;
                    }
                    else
                    {
                        // Create new condition
                        replacementCondition = new MessageCondition
                        {
                            QueueId = template.QueueId,
                            Operator = "DEFAULT",
                            CreatedAt = deletionTimestamp,
                            UpdatedAt = deletionTimestamp
                        };
                        _db.Set<MessageCondition>().Add(replacementCondition);
                        await _db.SaveChangesAsync(); // Save to get condition ID
                        
                        // Update replacement template with MessageConditionId
                        replacement.MessageConditionId = replacementCondition.Id;
                    }
                }
                // NOTE: No auto-fallback to first active template. Frontend enforces explicit replacement.
            }

            // Mark template as deleted
            template.IsDeleted = true;
            template.DeletedAt = deletionTimestamp;
            template.DeletedBy = deletedByUserId;

            // Soft-delete related condition (one-to-one relationship)
            var condition = template.Condition;
            var conditions = condition != null && !condition.IsDeleted ? new[] { condition } : Array.Empty<MessageCondition>();

            foreach (var cond in conditions)
            {
                cond.IsDeleted = true;
                cond.DeletedAt = deletionTimestamp;
                cond.DeletedBy = deletedByUserId;
            }

            await _db.SaveChangesAsync();
            await transaction.CommitAsync();

            _logger.LogInformation(
                "Template {TemplateId} soft-deleted by user {UserId} at {Timestamp}",
                templateId, deletedByUserId, deletionTimestamp);

            return (true, "");
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "Error soft-deleting template {TemplateId}", templateId);
            return (false, "An error occurred while deleting the template");
        }
    }

    public async Task<(bool Success, string ErrorMessage)> RestoreTemplateAsync(int templateId, int? restoredBy = null)
    {
        try
        {
            var template = await _db.MessageTemplates
                .FirstOrDefaultAsync(t => t.Id == templateId && t.IsDeleted);

            if (template == null)
            {
                return (false, "Deleted template not found");
            }

            // Check if within 30-day window
            if (!template.DeletedAt.HasValue)
            {
                return (false, "Deletion timestamp missing");
            }

            var deletedAtValue = template.DeletedAt.Value;
            var daysDeleted = (DateTime.UtcNow - deletedAtValue).TotalDays;
            if (daysDeleted > TTL_DAYS)
            {
                return (false, "restore_window_expired");
            }

            // Capture operation snapshot timestamp to ensure consistency across all transaction operations
            var operationTimestamp = DateTime.UtcNow;

            // Wrap restore in explicit transaction for atomicity
            await using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                // Restore template with snapshot timestamp and audit fields
                template.IsDeleted = false;
                template.DeletedAt = null;
                template.DeletedBy = null;
                template.RestoredAt = operationTimestamp;
                template.RestoredBy = restoredBy;
                template.UpdatedAt = operationTimestamp;
                template.UpdatedBy = restoredBy;

                // Get the template's condition via navigation property
                await _db.Entry(template).Reference(t => t.Condition).LoadAsync();
                var templateCondition = template.Condition;

                // Guard against duplicate defaults: if this template's condition was DEFAULT,
                // but another template is now the default for this queue, convert to UNCONDITIONED on restore
                if (templateCondition?.Operator == "DEFAULT" && template.QueueId > 0)
                {
                    // Find other templates in the same queue that have DEFAULT condition
                    var otherTemplatesWithDefault = await _db.MessageTemplates
                        .Where(t => t.QueueId == template.QueueId && t.Id != template.Id && !t.IsDeleted)
                        .Include(t => t.Condition)
                        .ToListAsync();
                    var currentDefaultCondition = otherTemplatesWithDefault
                        .Where(t => t.Condition != null && t.Condition.Operator == "DEFAULT" && !t.Condition.IsDeleted)
                        .Select(t => t.Condition!)
                        .FirstOrDefault();

                    if (currentDefaultCondition != null)
                    {
                        // Another template is already the default; convert this one to UNCONDITIONED on restore
                        templateCondition.Operator = "UNCONDITIONED";
                        templateCondition.Value = null;
                        templateCondition.MinValue = null;
                        templateCondition.MaxValue = null;
                        templateCondition.UpdatedAt = operationTimestamp;
                        templateCondition.UpdatedBy = restoredBy;
                        // Get the template ID that owns this default condition
                        var defaultTemplateId = await _db.MessageTemplates
                            .Where(t => t.MessageConditionId == currentDefaultCondition.Id)
                            .Select(t => t.Id)
                            .FirstOrDefaultAsync();
                        _logger.LogInformation(
                            "Template {TemplateId} restored with UNCONDITIONED operator since template {DefaultId} is already default for queue {QueueId}",
                            template.Id, defaultTemplateId, template.QueueId);
                    }
                }

                // Restore related condition (one-to-one relationship)
                // Only restoring condition deleted during cascade window (DeletedAt >= parent deletion timestamp)
                var conditionToRestore = template.Condition;
                if (conditionToRestore != null && conditionToRestore.IsDeleted && conditionToRestore.DeletedAt.HasValue && conditionToRestore.DeletedAt >= deletedAtValue)
                {
                    conditionToRestore.IsDeleted = false;
                    conditionToRestore.DeletedAt = null;
                    conditionToRestore.DeletedBy = null;
                    conditionToRestore.RestoredAt = operationTimestamp;
                    conditionToRestore.RestoredBy = restoredBy;
                    conditionToRestore.UpdatedAt = operationTimestamp;
                    conditionToRestore.UpdatedBy = restoredBy;
                }

                await _db.SaveChangesAsync();
                await transaction.CommitAsync();

                _logger.LogInformation(
                    "Template {TemplateId} restored at {Timestamp}",
                    templateId, operationTimestamp);

                return (true, "");
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error restoring template {TemplateId}", templateId);
            return (false, "An error occurred while restoring the template");
        }
    }

    public async Task<(List<MessageTemplate> Items, int TotalCount)> GetTrashTemplatesAsync(int queueId, int pageNumber, int pageSize)
    {
        var query = _db.MessageTemplates
            .Where(t => t.QueueId == queueId && t.IsDeleted && t.DeletedAt.HasValue && (DateTime.UtcNow - t.DeletedAt.Value).TotalDays <= TTL_DAYS)
            .OrderByDescending(t => t.DeletedAt);

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, totalCount);
    }

    public async Task<(List<MessageTemplate> Items, int TotalCount)> GetArchivedTemplatesAsync(int queueId, int pageNumber, int pageSize)
    {
        var query = _db.MessageTemplates
            .Where(t => t.QueueId == queueId && t.IsDeleted && t.DeletedAt.HasValue && (DateTime.UtcNow - t.DeletedAt.Value).TotalDays > TTL_DAYS)
            .OrderByDescending(t => t.DeletedAt);

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, totalCount);
    }

    public async Task<int> PermanentlyDeleteArchivedTemplatesAsync()
    {
        // Wrap in transaction for atomicity
        await using var transaction = await _db.Database.BeginTransactionAsync();
        try
        {
            // Unify datetime for this bulk operation
            var operationTimestamp = DateTime.UtcNow;

            var archivedTemplates = await _db.MessageTemplates
                .Where(t => t.IsDeleted && t.DeletedAt.HasValue && (operationTimestamp - t.DeletedAt.Value).TotalDays > TTL_DAYS)
                .Include(t => t.Condition)
                .ToListAsync();

            foreach (var template in archivedTemplates)
            {
                // Delete condition first (one-to-one relationship)
                if (template.Condition != null)
                {
                    _db.Set<MessageCondition>().Remove(template.Condition);
                }

                _db.MessageTemplates.Remove(template);
            }

            int deleted = await _db.SaveChangesAsync();
            await transaction.CommitAsync();
            
            _logger.LogInformation("Permanently deleted {Count} archived templates at {Timestamp}", deleted, operationTimestamp);
            return deleted;
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "Error permanently deleting archived templates");
            throw;
        }
    }
}
