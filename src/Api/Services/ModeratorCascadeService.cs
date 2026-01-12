/**
 * Moderator Cascade Service - Soft Delete/Restore Handler
 * File: src/Api/Services/ModeratorCascadeService.cs
 * 
 * Handles cascading operations for moderators
 */

using Clinics.Domain;
using Clinics.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Clinics.Api.Services;

/// <summary>
/// Result type for cascade operations
/// </summary>
public record CascadeOperationResult
{
    public bool Success { get; init; }
    public string Message { get; init; } = "";
    public int StatusCode { get; init; } = 200;
    public string? ErrorCode { get; init; }
    public Dictionary<string, object>? Metadata { get; init; }
}

public interface IModeratorCascadeService
{
    /// <summary>
    /// Restore a soft-deleted moderator user with cascade restore of related entities
    /// </summary>
    Task<CascadeOperationResult> RestoreModeratorAsync(User user, int restoredByUserId, int ttlDays = 30);
}

public class ModeratorCascadeService : IModeratorCascadeService
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<ModeratorCascadeService> _logger;

    public ModeratorCascadeService(
        ApplicationDbContext db,
        ILogger<ModeratorCascadeService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<CascadeOperationResult> RestoreModeratorAsync(User user, int restoredByUserId, int ttlDays = 30)
    {
        try
        {
            // Check if within TTL window
            if (!user.DeletedAt.HasValue)
            {
                return new CascadeOperationResult
                {
                    Success = false,
                    Message = "طابع زمني للحذف مفقود",
                    StatusCode = 400
                };
            }

            var daysDeleted = (DateTime.UtcNow - user.DeletedAt.Value).TotalDays;
            if (daysDeleted > ttlDays)
            {
                return new CascadeOperationResult
                {
                    Success = false,
                    Message = "انتهت فترة الاستعادة",
                    StatusCode = 400,
                    ErrorCode = "TTL_EXPIRED"
                };
            }

            // Check for username conflict
            var existingUser = await _db.Users
                .Where(u => u.Username == user.Username && u.Id != user.Id && !u.IsDeleted)
                .FirstOrDefaultAsync();

            if (existingUser != null)
            {
                return new CascadeOperationResult
                {
                    Success = false,
                    Message = "اسم المستخدم موجود بالفعل",
                    StatusCode = 409,
                    ErrorCode = "USERNAME_CONFLICT",
                    Metadata = new Dictionary<string, object>
                    {
                        { "conflictingUserId", existingUser.Id },
                        { "conflictingUsername", existingUser.Username }
                    }
                };
            }

            var operationTimestamp = DateTime.UtcNow;

            // Restore user
            user.IsDeleted = false;
            user.DeletedAt = null;
            user.DeletedBy = null;
            user.RestoredAt = operationTimestamp;
            user.RestoredBy = restoredByUserId;
            user.UpdatedAt = operationTimestamp;
            user.UpdatedBy = restoredByUserId;

            await _db.SaveChangesAsync();

            _logger.LogInformation(
                "User {UserId} ({Username}) restored by {RestoredByUserId} at {Timestamp}",
                user.Id, user.Username, restoredByUserId, operationTimestamp);

            return new CascadeOperationResult
            {
                Success = true,
                Message = "تم استعادة المستخدم بنجاح",
                StatusCode = 200
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error restoring user {UserId}", user.Id);
            return new CascadeOperationResult
            {
                Success = false,
                Message = "حدث خطأ أثناء استعادة المستخدم",
                StatusCode = 500
            };
        }
    }
}
