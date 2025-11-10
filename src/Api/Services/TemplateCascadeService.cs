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

            // If this is a default template, require replacement or ensure there's another default
            if (template.IsDefault)
            {
                var otherActiveTemplates = await _db.MessageTemplates
                    .Where(t => t.QueueId == template.QueueId && t.Id != templateId && !t.IsDeleted && t.IsActive)
                    .ToListAsync();

                if (otherActiveTemplates.Count == 0 && !replacementTemplateId.HasValue)
                {
                    return (false, "Cannot delete the only active template. Specify a replacement template.");
                }

                // If replacement provided, make it the new default
                if (replacementTemplateId.HasValue)
                {
                    var replacement = otherActiveTemplates.FirstOrDefault(t => t.Id == replacementTemplateId.Value);
                    if (replacement == null)
                    {
                        return (false, "Replacement template not found or not active");
                    }
                    replacement.IsDefault = true;
                }
                else if (otherActiveTemplates.Count > 0)
                {
                    // Make the first other active template the default
                    otherActiveTemplates[0].IsDefault = true;
                }
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

            var daysDeleted = (DateTime.UtcNow - template.DeletedAt.Value).TotalDays;
            if (daysDeleted > TTL_DAYS)
            {
                return (false, "restore_window_expired");
            }

            // Restore template
            template.IsDeleted = false;
            template.DeletedAt = null;
            template.DeletedBy = null;

            // Restore related conditions
            var conditions = await _db.Set<MessageCondition>()
                .Where(c => c.TemplateId == template.Id && c.IsDeleted && c.DeletedAt.HasValue && c.DeletedAt >= template.DeletedAt)
                .ToListAsync();

            foreach (var condition in conditions)
            {
                condition.IsDeleted = false;
                condition.DeletedAt = null;
                condition.DeletedBy = null;
            }

            await _db.SaveChangesAsync();

            _logger.LogInformation(
                "Template {TemplateId} restored at {Timestamp}",
                templateId, DateTime.UtcNow);

            return (true, "");
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
