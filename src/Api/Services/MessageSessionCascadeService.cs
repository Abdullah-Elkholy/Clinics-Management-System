/*
 * MessageSession Cascade Service - Soft Delete and Restore Handler
 * File: src/Api/Services/MessageSessionCascadeService.cs
 * 
 * Handles cascading soft-deletes and restores for MessageSessions and their related Messages.
 * This service is the single point of responsibility for Message cascade operations.
 */

using Clinics.Domain;
using Clinics.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Clinics.Api.Services;

public interface IMessageSessionCascadeService
{
    /// <summary>
    /// Soft-delete a MessageSession and cascade to all related Messages
    /// </summary>
    Task<(bool Success, string ErrorMessage)> SoftDeleteMessageSessionAsync(Guid sessionId, int deletedByUserId, bool useTransaction = true);

    /// <summary>
    /// Restore a previously soft-deleted MessageSession and cascade restore to related Messages
    /// </summary>
    Task<(bool Success, string ErrorMessage)> RestoreMessageSessionAsync(Guid sessionId, int? restoredBy = null, bool useTransaction = true);
}

public class MessageSessionCascadeService : IMessageSessionCascadeService
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<MessageSessionCascadeService> _logger;

    public MessageSessionCascadeService(ApplicationDbContext db, ILogger<MessageSessionCascadeService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<(bool Success, string ErrorMessage)> SoftDeleteMessageSessionAsync(
        Guid sessionId,
        int deletedByUserId,
        bool useTransaction = true)
    {
        if (useTransaction)
        {
            // Wrap in transaction for atomicity
            await using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var result = await SoftDeleteMessageSessionInternalAsync(sessionId, deletedByUserId);
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
                _logger.LogError(ex, "Error soft-deleting MessageSession {SessionId}", sessionId);
                return (false, "حدث خطأ أثناء حذف الجلسة");
            }
        }
        else
        {
            // Called from within an existing transaction
            return await SoftDeleteMessageSessionInternalAsync(sessionId, deletedByUserId);
        }
    }

    private async Task<(bool Success, string ErrorMessage)> SoftDeleteMessageSessionInternalAsync(
        Guid sessionId,
        int deletedByUserId)
    {
        // Unify datetime for this bulk operation
        var deletionTimestamp = DateTime.UtcNow;

        var session = await _db.MessageSessions
            .FirstOrDefaultAsync(s => s.Id == sessionId && !s.IsDeleted);

        if (session == null)
        {
            return (false, "الجلسة غير موجودة");
        }

        // Soft-delete MessageSession
        session.IsDeleted = true;
        session.DeletedAt = deletionTimestamp;
        session.DeletedBy = deletedByUserId;
        session.Status = "cancelled";
        session.EndTime = deletionTimestamp;
        session.LastUpdated = deletionTimestamp;

        // Soft-delete all related Messages
        var sessionIdStr = sessionId.ToString();
        var messages = await _db.Messages
            .Where(m => m.SessionId == sessionIdStr && !m.IsDeleted)
            .ToListAsync();

        foreach (var message in messages)
        {
            message.IsDeleted = true;
            message.DeletedAt = deletionTimestamp;
            message.DeletedBy = deletedByUserId;
            message.UpdatedAt = deletionTimestamp;
            // Note: Message Status remains unchanged
        }

        await _db.SaveChangesAsync();

        _logger.LogInformation(
            "MessageSession {SessionId} soft-deleted by user {UserId} at {Timestamp}. Cascaded to {MessageCount} messages.",
            sessionId, deletedByUserId, deletionTimestamp, messages.Count);

        return (true, "");
    }

    public async Task<(bool Success, string ErrorMessage)> RestoreMessageSessionAsync(
        Guid sessionId,
        int? restoredBy = null,
        bool useTransaction = true)
    {
        if (useTransaction)
        {
            // Wrap in transaction for atomicity
            await using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                var result = await RestoreMessageSessionInternalAsync(sessionId, restoredBy);
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
                _logger.LogError(ex, "Error restoring MessageSession {SessionId}", sessionId);
                return (false, "حدث خطأ أثناء استعادة الجلسة");
            }
        }
        else
        {
            // Called from within an existing transaction
            return await RestoreMessageSessionInternalAsync(sessionId, restoredBy);
        }
    }

    private async Task<(bool Success, string ErrorMessage)> RestoreMessageSessionInternalAsync(
        Guid sessionId,
        int? restoredBy)
    {
        var session = await _db.MessageSessions
            .FirstOrDefaultAsync(s => s.Id == sessionId && s.IsDeleted);

        if (session == null)
        {
            return (false, "الجلسة المحذوفة غير موجودة");
        }

        // Check if within 30-day window
        if (!session.DeletedAt.HasValue)
        {
            return (false, "طابع زمني للحذف مفقود");
        }

        var deletedAtValue = session.DeletedAt.Value;
        var daysDeleted = (DateTime.UtcNow - deletedAtValue).TotalDays;
        if (daysDeleted > 30)
        {
            return (false, "انتهت فترة الاستعادة");
        }

        // Capture operation snapshot timestamp
        var operationTimestamp = DateTime.UtcNow;

        // Restore MessageSession
        session.IsDeleted = false;
        session.DeletedAt = null;
        session.DeletedBy = null;
        session.LastUpdated = operationTimestamp;
        // Note: Status remains "cancelled" (or could be restored to "active" - business decision)

        // Restore all related Messages that were deleted in the same cascade operation
        var sessionIdStr = sessionId.ToString();
        var messages = await _db.Messages
            .Where(m => m.SessionId == sessionIdStr
                && m.IsDeleted
                && m.DeletedAt.HasValue
                && m.DeletedAt >= deletedAtValue)
            .ToListAsync();

        foreach (var message in messages)
        {
            message.IsDeleted = false;
            message.DeletedAt = null;
            message.DeletedBy = null;
            message.UpdatedAt = operationTimestamp;
            // Note: Message Status remains unchanged
        }

        await _db.SaveChangesAsync();

        _logger.LogInformation(
            "MessageSession {SessionId} restored at {Timestamp}. Restored {MessageCount} messages.",
            sessionId, operationTimestamp, messages.Count);

        return (true, "");
    }
}

