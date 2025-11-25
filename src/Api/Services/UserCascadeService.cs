/**
 * User Cascade Service - Soft Delete Handler
 * File: src/Api/Services/UserCascadeService.cs
 * 
 * Handles soft-deletes for users
 * Simple cascade - just soft-delete the user record
 */

using Clinics.Domain;
using Clinics.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Clinics.Api.Services;

public interface IUserCascadeService
{
    /// <summary>
    /// Soft-delete a user
    /// </summary>
    Task<(bool Success, string ErrorMessage)> SoftDeleteUserAsync(int userId, int deletedByUserId);

    /// <summary>
    /// Restore a previously soft-deleted user
    /// </summary>
    Task<(bool Success, string ErrorMessage)> RestoreUserAsync(int userId, int? restoredBy = null);

    /// <summary>
    /// Get soft-deleted users (trash)
    /// </summary>
    Task<(List<User> Items, int TotalCount)> GetTrashUsersAsync(int pageNumber, int pageSize);

    /// <summary>
    /// Get permanently deleted users (archived - over 30 days)
    /// </summary>
    Task<(List<User> Items, int TotalCount)> GetArchivedUsersAsync(int pageNumber, int pageSize);

    /// <summary>
    /// Permanently delete archived users (cron job)
    /// </summary>
    Task<int> PermanentlyDeleteArchivedUsersAsync();
}

public class UserCascadeService : IUserCascadeService
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<UserCascadeService> _logger;
    private readonly IQueueCascadeService _queueCascadeService;
    private const int TTL_DAYS = 30;

    public UserCascadeService(
        ApplicationDbContext db, 
        ILogger<UserCascadeService> logger,
        IQueueCascadeService queueCascadeService)
    {
        _db = db;
        _logger = logger;
        _queueCascadeService = queueCascadeService;
    }

    public async Task<(bool Success, string ErrorMessage)> SoftDeleteUserAsync(int userId, int deletedByUserId)
    {
        // Wrap in transaction for atomicity
        await using var transaction = await _db.Database.BeginTransactionAsync();
        try
        {
            var user = await _db.Users
                .FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted);

            if (user == null)
            {
                await transaction.RollbackAsync();
                return (false, "User not found");
            }

            // Capture operation snapshot timestamp to ensure consistency
            var operationTimestamp = DateTime.UtcNow;

            // If user is a moderator, soft-delete all their Queues (which will cascade to MessageSessions → Messages)
            if (user.Role == "moderator")
            {
                var queues = await _db.Queues
                    .Where(q => q.ModeratorId == userId && !q.IsDeleted)
                    .ToListAsync();

                foreach (var queue in queues)
                {
                    // Call QueueCascadeService with useTransaction = false since we're already in a transaction
                    // Note: QueueCascadeService will call MessageSessionCascadeService which will cascade to Messages
                    var (success, error) = await _queueCascadeService.SoftDeleteQueueAsync(queue.Id, deletedByUserId, useTransaction: false);
                    
                    if (!success)
                    {
                        await transaction.RollbackAsync();
                        _logger.LogError("Failed to soft-delete Queue {QueueId} for moderator {UserId}: {Error}", queue.Id, userId, error);
                        return (false, $"فشل حذف الطابور: {error}");
                    }
                }

                // Soft-delete WhatsAppSession
                var whatsappSession = await _db.Set<WhatsAppSession>()
                    .FirstOrDefaultAsync(s => s.ModeratorUserId == userId && !s.IsDeleted);
                
                if (whatsappSession != null)
                {
                    whatsappSession.IsDeleted = true;
                    whatsappSession.DeletedAt = operationTimestamp;
                    whatsappSession.DeletedBy = deletedByUserId;
                    whatsappSession.Status = "disconnected"; // Update status to disconnected
                    
                    _logger.LogInformation(
                        "WhatsAppSession {SessionId} for moderator {UserId} soft-deleted at {Timestamp}",
                        whatsappSession.Id, userId, operationTimestamp);
                }
            }

            // Mark user as deleted with snapshot timestamp
            user.IsDeleted = true;
            user.DeletedAt = operationTimestamp;
            user.DeletedBy = deletedByUserId;

            await _db.SaveChangesAsync();
            await transaction.CommitAsync();

            _logger.LogInformation(
                "User {UserId} soft-deleted by user {DeletingUserId} at {Timestamp}",
                userId, deletedByUserId, operationTimestamp);

            return (true, "");
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "Error soft-deleting user {UserId}", userId);
            return (false, "حدث خطأ أثناء حذف المستخدم");
        }
    }

    public async Task<(bool Success, string ErrorMessage)> RestoreUserAsync(int userId, int? restoredBy = null)
    {
        // Wrap in transaction for atomicity
        await using var transaction = await _db.Database.BeginTransactionAsync();
        try
        {
            var user = await _db.Users
                .FirstOrDefaultAsync(u => u.Id == userId && u.IsDeleted);

            if (user == null)
            {
                await transaction.RollbackAsync();
                return (false, "المستخدم المحذوف غير موجود");
            }

            // Check if within 30-day window
            if (!user.DeletedAt.HasValue)
            {
                await transaction.RollbackAsync();
                return (false, "طابع زمني للحذف مفقود");
            }

            var daysDeleted = (DateTime.UtcNow - user.DeletedAt.Value).TotalDays;
            if (daysDeleted > TTL_DAYS)
            {
                await transaction.RollbackAsync();
                return (false, "انتهت فترة الاستعادة");
            }

            // Capture the original DeletedAt timestamp before clearing it (for cascade window check)
            var originalDeletedAt = user.DeletedAt.Value;

            // Capture operation snapshot timestamp to ensure consistency
            var operationTimestamp = DateTime.UtcNow;

            // If user is a moderator, restore all their Queues (which will restore MessageSessions → Messages)
            if (user.Role == "moderator")
            {
                var queues = await _db.Queues
                    .Where(q => q.ModeratorId == userId 
                        && q.IsDeleted 
                        && q.DeletedAt.HasValue 
                        && q.DeletedAt >= originalDeletedAt)
                    .ToListAsync();

                foreach (var queue in queues)
                {
                    // Call QueueCascadeService with useTransaction = false since we're already in a transaction
                    // Note: QueueCascadeService will call MessageSessionCascadeService which will restore Messages
                    var (success, error) = await _queueCascadeService.RestoreQueueAsync(queue.Id, restoredBy, useTransaction: false);
                    
                    if (!success)
                    {
                        await transaction.RollbackAsync();
                        _logger.LogError("Failed to restore Queue {QueueId} for moderator {UserId}: {Error}", queue.Id, userId, error);
                        return (false, $"فشل استعادة الطابور: {error}");
                    }
                }

                // Restore WhatsAppSession (if deleted during same cascade)
                var whatsappSession = await _db.Set<WhatsAppSession>()
                    .IgnoreQueryFilters() // Must bypass soft-delete filter to find deleted sessions
                    .FirstOrDefaultAsync(s => s.ModeratorUserId == userId 
                        && s.IsDeleted 
                        && s.DeletedAt.HasValue 
                        && s.DeletedAt >= originalDeletedAt);
                
                if (whatsappSession != null)
                {
                    whatsappSession.IsDeleted = false;
                    whatsappSession.DeletedAt = null;
                    whatsappSession.DeletedBy = null;
                    whatsappSession.RestoredAt = operationTimestamp;
                    whatsappSession.RestoredBy = restoredBy;
                    whatsappSession.UpdatedAt = operationTimestamp;
                    whatsappSession.UpdatedBy = restoredBy;
                    // Note: Status remains "disconnected" - user must re-authenticate
                    
                    _logger.LogInformation(
                        "WhatsAppSession {SessionId} for moderator {UserId} restored at {Timestamp}",
                        whatsappSession.Id, userId, operationTimestamp);
                }
            }

            // Restore user with snapshot timestamp and audit fields
            user.IsDeleted = false;
            user.DeletedAt = null;
            user.DeletedBy = null;
            user.RestoredAt = operationTimestamp;
            user.RestoredBy = restoredBy;
            user.UpdatedAt = operationTimestamp;
            user.UpdatedBy = restoredBy;

            await _db.SaveChangesAsync();
            await transaction.CommitAsync();

            _logger.LogInformation(
                "User {UserId} restored at {Timestamp}",
                userId, operationTimestamp);

            return (true, "");
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();
            _logger.LogError(ex, "Error restoring user {UserId}", userId);
            return (false, "حدث خطأ أثناء استعادة المستخدم");
        }
    }

    public async Task<(List<User> Items, int TotalCount)> GetTrashUsersAsync(int pageNumber, int pageSize)
    {
        var query = _db.Users
            .Where(u => u.IsDeleted && u.DeletedAt.HasValue && (DateTime.UtcNow - u.DeletedAt.Value).TotalDays <= TTL_DAYS)
            .OrderByDescending(u => u.DeletedAt);

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, totalCount);
    }

    public async Task<(List<User> Items, int TotalCount)> GetArchivedUsersAsync(int pageNumber, int pageSize)
    {
        var query = _db.Users
            .Where(u => u.IsDeleted && u.DeletedAt.HasValue && (DateTime.UtcNow - u.DeletedAt.Value).TotalDays > TTL_DAYS)
            .OrderByDescending(u => u.DeletedAt);

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, totalCount);
    }

    public async Task<int> PermanentlyDeleteArchivedUsersAsync()
    {
        var archivedUsers = await _db.Users
            .Where(u => u.IsDeleted && u.DeletedAt.HasValue && (DateTime.UtcNow - u.DeletedAt.Value).TotalDays > TTL_DAYS)
            .ToListAsync();

        foreach (var user in archivedUsers)
        {
            _db.Users.Remove(user);
        }

        int deleted = await _db.SaveChangesAsync();
        _logger.LogInformation("Permanently deleted {Count} archived users", deleted);
        return deleted;
    }
}
