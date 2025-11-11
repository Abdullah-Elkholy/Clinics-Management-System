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
    Task<(bool Success, string ErrorMessage)> RestoreTemplateAsync(int templateId);

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
        try
        {
            var template = await _db.MessageTemplates
                .FirstOrDefaultAsync(t => t.Id == templateId && !t.IsDeleted);

            if (template == null)
            {
                return (false, "Template not found");
            }

            // If this template has a DEFAULT condition, require replacement or ensure there's another default
            var templateCondition = await _db.Set<MessageCondition>()
                .FirstOrDefaultAsync(c => c.TemplateId == template.Id && !c.IsDeleted);
            
            if (templateCondition?.Operator == "DEFAULT")
            {
                var otherActiveTemplates = await _db.MessageTemplates
                    .Where(t => t.QueueId == template.QueueId && t.Id != templateId && !t.IsDeleted && t.IsActive)
                    .ToListAsync();

                if (otherActiveTemplates.Count == 0 && !replacementTemplateId.HasValue)
                {
                    return (false, "default_template_replacement_required");
                }

                // If replacement provided, make it the new default
                if (replacementTemplateId.HasValue)
                {
                    var replacement = otherActiveTemplates.FirstOrDefault(t => t.Id == replacementTemplateId.Value);
                    if (replacement == null)
                    {
                        return (false, "Replacement template not found or not active");
                    }
                    
                    var replacementCondition = await _db.Set<MessageCondition>()
                        .FirstOrDefaultAsync(c => c.TemplateId == replacement.Id && !c.IsDeleted);
                    if (replacementCondition != null)
                    {
                        replacementCondition.Operator = "DEFAULT";
                        replacementCondition.Value = null;
                        replacementCondition.MinValue = null;
                        replacementCondition.MaxValue = null;
                        replacementCondition.UpdatedAt = DateTime.UtcNow;
                    }
                    else
                    {
                        replacementCondition = new MessageCondition
                        {
                            TemplateId = replacement.Id,
                            QueueId = template.QueueId,
                            Operator = "DEFAULT",
                            CreatedAt = DateTime.UtcNow,
                            UpdatedAt = DateTime.UtcNow
                        };
                        _db.Set<MessageCondition>().Add(replacementCondition);
                    }
                }
                // NOTE: No auto-fallback to first active template. Frontend enforces explicit replacement.
            }

            // Mark template as deleted
            template.IsDeleted = true;
            template.DeletedAt = DateTime.UtcNow;
            template.DeletedBy = deletedByUserId;

            // Soft-delete related conditions
            var conditions = await _db.Set<MessageCondition>()
                .Where(c => c.TemplateId == template.Id && !c.IsDeleted)
                .ToListAsync();

            foreach (var condition in conditions)
            {
                condition.IsDeleted = true;
                condition.DeletedAt = DateTime.UtcNow;
                condition.DeletedBy = deletedByUserId;
            }

            await _db.SaveChangesAsync();

            _logger.LogInformation(
                "Template {TemplateId} soft-deleted by user {UserId} at {Timestamp}",
                templateId, deletedByUserId, DateTime.UtcNow);

            return (true, "");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error soft-deleting template {TemplateId}", templateId);
            return (false, "An error occurred while deleting the template");
        }
    }

    public async Task<(bool Success, string ErrorMessage)> RestoreTemplateAsync(int templateId)
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
                // Restore template
                template.IsDeleted = false;
                template.DeletedAt = null;
                template.DeletedBy = null;

                // Get the template's condition
                var templateCondition = await _db.Set<MessageCondition>()
                    .FirstOrDefaultAsync(c => c.TemplateId == template.Id);

                // Guard against duplicate defaults: if this template's condition was DEFAULT,
                // but another template is now the default for this queue, convert to UNCONDITIONED on restore
                if (templateCondition?.Operator == "DEFAULT" && template.QueueId > 0)
                {
                    var currentDefaultCondition = await _db.Set<MessageCondition>()
                        .FirstOrDefaultAsync(c => c.QueueId == template.QueueId && c.Operator == "DEFAULT" && 
                                              c.TemplateId != template.Id && 
                                              !c.IsDeleted);

                    if (currentDefaultCondition != null)
                    {
                        // Another template is already the default; convert this one to UNCONDITIONED on restore
                        templateCondition.Operator = "UNCONDITIONED";
                        templateCondition.Value = null;
                        templateCondition.MinValue = null;
                        templateCondition.MaxValue = null;
                        templateCondition.UpdatedAt = DateTime.UtcNow;
                        _logger.LogInformation(
                            "Template {TemplateId} restored with UNCONDITIONED operator since template {DefaultId} is already default for queue {QueueId}",
                            template.Id, currentDefaultCondition.TemplateId, template.QueueId);
                    }
                }

                // Restore related conditions
                // Only restoring conditions deleted during cascade window (DeletedAt >= parent deletion timestamp)
                var conditions = await _db.Set<MessageCondition>()
                    .Where(c => c.TemplateId == template.Id && c.IsDeleted && c.DeletedAt.HasValue && c.DeletedAt >= deletedAtValue)
                    .ToListAsync();

                foreach (var condition in conditions)
                {
                    condition.IsDeleted = false;
                    condition.DeletedAt = null;
                    condition.DeletedBy = null;
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
        var archivedTemplates = await _db.MessageTemplates
            .Where(t => t.IsDeleted && t.DeletedAt.HasValue && (DateTime.UtcNow - t.DeletedAt.Value).TotalDays > TTL_DAYS)
            .ToListAsync();

        foreach (var template in archivedTemplates)
        {
            var conditions = await _db.Set<MessageCondition>()
                .Where(c => c.TemplateId == template.Id)
                .ToListAsync();
            foreach (var condition in conditions)
            {
                _db.Set<MessageCondition>().Remove(condition);
            }

            _db.MessageTemplates.Remove(template);
        }

        int deleted = await _db.SaveChangesAsync();
        _logger.LogInformation("Permanently deleted {Count} archived templates", deleted);
        return deleted;
    }
}
