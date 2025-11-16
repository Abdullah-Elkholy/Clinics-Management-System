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
    private const int TTL_DAYS = 30;

    public UserCascadeService(ApplicationDbContext db, ILogger<UserCascadeService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<(bool Success, string ErrorMessage)> SoftDeleteUserAsync(int userId, int deletedByUserId)
    {
        try
        {
            var user = await _db.Users
                .FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted);

            if (user == null)
            {
                return (false, "User not found");
            }

            // Mark user as deleted
            user.IsDeleted = true;
            user.DeletedAt = DateTime.UtcNow;
            user.DeletedBy = deletedByUserId;

            await _db.SaveChangesAsync();

            _logger.LogInformation(
                "User {UserId} soft-deleted by user {DeletingUserId} at {Timestamp}",
                userId, deletedByUserId, DateTime.UtcNow);

            return (true, "");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error soft-deleting user {UserId}", userId);
            return (false, "An error occurred while deleting the user");
        }
    }

    public async Task<(bool Success, string ErrorMessage)> RestoreUserAsync(int userId, int? restoredBy = null)
    {
        try
        {
            var user = await _db.Users
                .FirstOrDefaultAsync(u => u.Id == userId && u.IsDeleted);

            if (user == null)
            {
                return (false, "Deleted user not found");
            }

            // Check if within 30-day window
            if (!user.DeletedAt.HasValue)
            {
                return (false, "Deletion timestamp missing");
            }

            var daysDeleted = (DateTime.UtcNow - user.DeletedAt.Value).TotalDays;
            if (daysDeleted > TTL_DAYS)
            {
                return (false, "restore_window_expired");
            }

            // Capture operation snapshot timestamp to ensure consistency
            var operationTimestamp = DateTime.UtcNow;

            // Restore user with snapshot timestamp and audit fields
            user.IsDeleted = false;
            user.DeletedAt = null;
            user.DeletedBy = null;
            user.RestoredAt = operationTimestamp;
            user.RestoredBy = restoredBy;
            user.UpdatedAt = operationTimestamp;
            user.UpdatedBy = restoredBy;

            await _db.SaveChangesAsync();

            _logger.LogInformation(
                "User {UserId} restored at {Timestamp}",
                userId, DateTime.UtcNow);

            return (true, "");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error restoring user {UserId}", userId);
            return (false, "An error occurred while restoring the user");
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
