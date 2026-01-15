/*
 * Queue Cascade Service - Soft Delete Handler
 * File: src/Api/Services/QueueCascadeService.cs
 * 
 * Handles cascading soft-deletes for queues and their related entities
 * Enforces business rules:
 * - Check if this is the user's only queue (prevent deletion if so)
 * - Release quota back to creator
 * - Soft-delete all related patients, templates, conditions
 * - Audit log the deletion
 */

using Clinics.Domain;
using Clinics.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Clinics.Api.Services;

public interface IQueueCascadeService
{
    /// <summary>
    /// Soft-delete a queue and all its related entities
    /// </summary>
    /// <param name="queueId">The ID of the queue to soft-delete</param>
    /// <param name="deletedByUserId">The ID of the user performing the deletion</param>
    /// <param name="useTransaction">If false, assumes caller manages transaction</param>
    Task<(bool Success, string ErrorMessage)> SoftDeleteQueueAsync(int queueId, int deletedByUserId, bool useTransaction = true);

    /// <summary>
    /// Restore a previously soft-deleted queue
    /// </summary>
    /// <param name="queueId">The ID of the queue to restore</param>
    /// <param name="restoredBy">The ID of the user restoring the queue</param>
    /// <param name="useTransaction">If false, assumes caller manages transaction</param>
    Task<(bool Success, string ErrorMessage)> RestoreQueueAsync(int queueId, int? restoredBy = null, bool useTransaction = true);

    /// <summary>
    /// Get soft-deleted queues (trash)
    /// </summary>
    Task<(List<Queue> Items, int TotalCount)> GetTrashQueuesAsync(int pageNumber, int pageSize);

    /// <summary>
    /// Get permanently deleted queues (archived - over 30 days)
    /// </summary>
    Task<(List<Queue> Items, int TotalCount)> GetArchivedQueuesAsync(int pageNumber, int pageSize);

    /// <summary>
    /// Permanently delete archived queues (cron job / admin action)
    /// </summary>
    Task<int> PermanentlyDeleteArchivedQueuesAsync();
}

public class QueueCascadeService : IQueueCascadeService
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<QueueCascadeService> _logger;
    private readonly IMessageSessionCascadeService _messageSessionCascadeService;
    private const int TTL_DAYS = 30;

    public QueueCascadeService(
        ApplicationDbContext db,
        ILogger<QueueCascadeService> logger,
        IMessageSessionCascadeService messageSessionCascadeService)
    {
        _db = db;
        _logger = logger;
        _messageSessionCascadeService = messageSessionCascadeService;
    }

    public async Task<(bool Success, string ErrorMessage)> SoftDeleteQueueAsync(int queueId, int deletedByUserId, bool useTransaction = true)
    {
        if (useTransaction)
        {
            // Wrap in transaction for atomicity
            await using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var result = await SoftDeleteQueueInternalAsync(queueId, deletedByUserId);
                if (result.Success)
                {
                    await transaction.CommitAsync();
                }
                else
                {
                    await transaction.RollbackAsync();
                }
                return result;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Error soft-deleting queue {QueueId}", queueId);
                return (false, "حدث خطأ أثناء حذف العيادة");
            }
        }
        else
        {
            // Called from within an existing transaction
            return await SoftDeleteQueueInternalAsync(queueId, deletedByUserId);
        }
    }

    private async Task<(bool Success, string ErrorMessage)> SoftDeleteQueueInternalAsync(int queueId, int deletedByUserId)
    {
        // Unify datetime for this bulk operation
        var deletionTimestamp = DateTime.UtcNow;

        var queue = await _db.Queues
            .FirstOrDefaultAsync(q => q.Id == queueId && !q.IsDeleted);

        if (queue == null)
        {
            return (false, "Queue not found");
        }

        // Mark queue as deleted
        queue.IsDeleted = true;
        queue.DeletedAt = deletionTimestamp;
        queue.DeletedBy = deletedByUserId;

        // Soft-delete all related MessageSessions (which will cascade to Messages)
        var messageSessions = await _db.MessageSessions
            .Where(s => s.QueueId == queueId && !s.IsDeleted)
            .ToListAsync();

        foreach (var session in messageSessions)
        {
            // Call MessageSessionCascadeService with useTransaction = false since we're already in a transaction
            var (success, error) = await _messageSessionCascadeService.SoftDeleteMessageSessionAsync(
                session.Id,
                deletedByUserId,
                useTransaction: false);

            if (!success)
            {
                _logger.LogError("Failed to soft-delete MessageSession {SessionId}: {Error}", session.Id, error);
                return (false, $"فشل حذف جلسة الرسائل: {error}");
            }
        }

        // Soft-delete all related patients
        var patients = await _db.Patients
            .Where(p => p.QueueId == queueId && !p.IsDeleted)
            .ToListAsync();
        foreach (var patient in patients)
        {
            patient.IsDeleted = true;
            patient.DeletedAt = deletionTimestamp;
            patient.DeletedBy = deletedByUserId;
        }

        // Soft-delete all related templates and their conditions (one-to-one relationship)
        var templates = await _db.MessageTemplates
            .Where(t => t.QueueId == queueId && !t.IsDeleted)
            .Include(t => t.Condition)
            .ToListAsync();
        foreach (var template in templates)
        {
            template.IsDeleted = true;
            template.DeletedAt = deletionTimestamp;
            template.DeletedBy = deletedByUserId;

            // Soft-delete the template's condition (one-to-one relationship)
            if (template.Condition != null && !template.Condition.IsDeleted)
            {
                template.Condition.IsDeleted = true;
                template.Condition.DeletedAt = deletionTimestamp;
                template.Condition.DeletedBy = deletedByUserId;
            }
        }

        await _db.SaveChangesAsync();

        _logger.LogInformation(
            "Queue {QueueId} soft-deleted by user {UserId} at {Timestamp}",
            queueId, deletedByUserId, deletionTimestamp);

        return (true, "");
    }

    public async Task<(bool Success, string ErrorMessage)> RestoreQueueAsync(int queueId, int? restoredBy = null, bool useTransaction = true)
    {
        if (useTransaction)
        {
            // Wrap restore in explicit transaction for atomicity
            await using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var result = await RestoreQueueInternalAsync(queueId, restoredBy);
                if (result.Success)
                {
                    await transaction.CommitAsync();
                }
                else
                {
                    await transaction.RollbackAsync();
                }
                return result;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Error restoring queue {QueueId}", queueId);
                return (false, "حدث خطأ أثناء استعادة العيادة");
            }
        }
        else
        {
            // Called from within an existing transaction
            return await RestoreQueueInternalAsync(queueId, restoredBy);
        }
    }

    private async Task<(bool Success, string ErrorMessage)> RestoreQueueInternalAsync(int queueId, int? restoredBy)
    {
        var queue = await _db.Queues
            .FirstOrDefaultAsync(q => q.Id == queueId && q.IsDeleted);

        if (queue == null)
        {
            return (false, "العيادة المحذوفة غير موجود");
        }

        // Check if within 30-day window
        if (!queue.DeletedAt.HasValue)
        {
            return (false, "طابع زمني للحذف مفقود");
        }

        var deletedAtValue = queue.DeletedAt.Value;
        var daysDeleted = (DateTime.UtcNow - deletedAtValue).TotalDays;
        if (daysDeleted > TTL_DAYS)
        {
            return (false, "انتهت فترة الاستعادة");
        }

        // Capture operation snapshot timestamp to ensure consistency across all transaction operations
        var operationTimestamp = DateTime.UtcNow;

        try
        {
            // Check quota before restoring
            // Queue quota is based on active (!IsDeleted) queues count
            var activeQueuesCount = await _db.Queues
                .CountAsync(q => q.ModeratorId == queue.ModeratorId && !q.IsDeleted);

            var quota = await _db.Quotas
                .FirstOrDefaultAsync(q => q.ModeratorUserId == queue.ModeratorId);

            // If quota exists and restoring would exceed limit, block the restore
            // Skip check if quota is unlimited (-1)
            if (quota != null && quota.QueuesQuota != -1)
            {
                // After restore, active count will be +1
                if (activeQueuesCount + 1 > quota.QueuesQuota)
                {
                    _logger.LogWarning(
                        "Restore blocked for queue {QueueId}: would exceed quota. Active: {Active}, Limit: {Limit}",
                        queueId, activeQueuesCount, quota.QueuesQuota);
                    return (false, "تم تجاوز الحصة");
                }
            }

            // Use restoredBy parameter passed from controller

            // Restore queue with snapshot timestamp and audit fields
            queue.IsDeleted = false;
            queue.DeletedAt = null;
            queue.DeletedBy = null;
            queue.RestoredAt = operationTimestamp;
            queue.RestoredBy = restoredBy;
            queue.UpdatedAt = operationTimestamp;
            queue.UpdatedBy = restoredBy;

            // Restore related MessageSessions (which will restore Messages)
            var messageSessions = await _db.MessageSessions
                .Where(s => s.QueueId == queueId
                    && s.IsDeleted
                    && s.DeletedAt.HasValue
                    && s.DeletedAt >= deletedAtValue)
                .ToListAsync();

            foreach (var session in messageSessions)
            {
                // Call MessageSessionCascadeService with useTransaction = false since we're already in a transaction
                var (success, error) = await _messageSessionCascadeService.RestoreMessageSessionAsync(
                    session.Id,
                    restoredBy,
                    useTransaction: false);

                if (!success)
                {
                    _logger.LogError("Failed to restore MessageSession {SessionId}: {Error}", session.Id, error);
                    return (false, $"فشل استعادة جلسة الرسائل: {error}");
                }
            }

            // Restore related patients
            // Only restoring patients deleted during cascade window (DeletedAt >= parent deletion timestamp)
            var patients = await _db.Patients
                .Where(p => p.QueueId == queueId && p.IsDeleted && p.DeletedAt.HasValue && p.DeletedAt >= deletedAtValue)
                .ToListAsync();

            foreach (var patient in patients)
            {
                patient.IsDeleted = false;
                patient.DeletedAt = null;
                patient.DeletedBy = null;
                patient.RestoredAt = operationTimestamp;
                patient.RestoredBy = restoredBy;
                patient.UpdatedAt = operationTimestamp;
                patient.UpdatedBy = restoredBy;
            }

            var templates = await _db.MessageTemplates
                .Where(t => t.QueueId == queueId && t.IsDeleted && t.DeletedAt.HasValue && t.DeletedAt >= deletedAtValue)
                .ToListAsync();

            // Optimize: preload all conditions for restored templates using MessageConditionId
            var messageConditionIds = templates.Where(t => t.MessageConditionId > 0).Select(t => t.MessageConditionId).ToList();
            var allConditions = messageConditionIds.Count > 0
                ? await _db.Set<MessageCondition>()
                    .Where(c => messageConditionIds.Contains(c.Id)
                        && c.IsDeleted
                        && c.DeletedAt.HasValue
                        && c.DeletedAt >= deletedAtValue)
                    .ToListAsync()
                : new List<MessageCondition>();

            // Create dictionary mapping MessageConditionId to condition
            var conditionsByMessageConditionId = allConditions.ToDictionary(c => c.Id);

            foreach (var template in templates)
            {
                template.IsDeleted = false;
                template.DeletedAt = null;
                template.DeletedBy = null;
                template.RestoredAt = operationTimestamp;
                template.RestoredBy = restoredBy;
                template.UpdatedAt = operationTimestamp;
                template.UpdatedBy = restoredBy;

                // Restore related condition from preloaded data (one-to-one relationship)
                if (template.MessageConditionId > 0 && conditionsByMessageConditionId.TryGetValue(template.MessageConditionId, out var condition))
                {
                    condition.IsDeleted = false;
                    condition.DeletedAt = null;
                    condition.DeletedBy = null;
                    condition.RestoredAt = operationTimestamp;
                    condition.RestoredBy = restoredBy;
                    condition.UpdatedAt = operationTimestamp;
                    condition.UpdatedBy = restoredBy;
                }
            }

            await _db.SaveChangesAsync();

            _logger.LogInformation(
                "Queue {QueueId} restored at {Timestamp}",
                queueId, operationTimestamp);

            return (true, "");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error restoring queue {QueueId}", queueId);
            return (false, "حدث خطأ أثناء استعادة العيادة");
        }
    }

    public async Task<(List<Queue> Items, int TotalCount)> GetTrashQueuesAsync(int pageNumber, int pageSize)
    {
        var query = _db.Queues
            .Where(q => q.IsDeleted && q.DeletedAt.HasValue && (DateTime.UtcNow - q.DeletedAt.Value).TotalDays <= TTL_DAYS)
            .OrderByDescending(q => q.DeletedAt);

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, totalCount);
    }

    public async Task<(List<Queue> Items, int TotalCount)> GetArchivedQueuesAsync(int pageNumber, int pageSize)
    {
        var query = _db.Queues
            .Where(q => q.IsDeleted && q.DeletedAt.HasValue && (DateTime.UtcNow - q.DeletedAt.Value).TotalDays > TTL_DAYS)
            .OrderByDescending(q => q.DeletedAt);

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, totalCount);
    }

    public async Task<int> PermanentlyDeleteArchivedQueuesAsync()
    {
        // Wrap in transaction for atomicity
        await using var transaction = await _db.Database.BeginTransactionAsync();
        try
        {
            // Unify datetime for this bulk operation
            var operationTimestamp = DateTime.UtcNow;

            var archivedQueues = await _db.Queues
                .Where(q => q.IsDeleted && q.DeletedAt.HasValue && (operationTimestamp - q.DeletedAt.Value).TotalDays > TTL_DAYS)
                .ToListAsync();

            foreach (var queue in archivedQueues)
            {
                // Also delete related records
                var patients = await _db.Patients
                    .Where(p => p.QueueId == queue.Id)
                    .ToListAsync();
                _db.Patients.RemoveRange(patients);

                // Delete templates and their conditions
                var templates = await _db.MessageTemplates
                    .Where(t => t.QueueId == queue.Id)
                    .Include(t => t.Condition)
                    .ToListAsync();

                foreach (var template in templates)
                {
                    // Delete condition first (one-to-one relationship)
                    if (template.Condition != null)
                    {
                        _db.Set<MessageCondition>().Remove(template.Condition);
                    }
                }

                _db.MessageTemplates.RemoveRange(templates);

                _db.Queues.Remove(queue);
            }

            int deleted = await _db.SaveChangesAsync();
            await transaction.CommitAsync();

            _logger.LogInformation("Permanently deleted {Count} archived queues at {Timestamp}", deleted, operationTimestamp);
            return deleted;
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "Error permanently deleting archived queues");
            throw;
        }
    }
}


