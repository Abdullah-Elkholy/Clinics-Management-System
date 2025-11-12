using Clinics.Domain;
using Clinics.Infrastructure;
using Clinics.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace Clinics.Api.Services;

/// <summary>
/// Service for managing quotas and user-moderator relationships.
/// Handles shared quota logic where users consume their moderator's quota.
/// </summary>
public class QuotaService
{
    private readonly ApplicationDbContext _context;
    private readonly Clinics.Infrastructure.Services.IQueueCascadeService _queueCascadeService;

    public QuotaService(ApplicationDbContext context, Clinics.Infrastructure.Services.IQueueCascadeService queueCascadeService)
    {
        _context = context;
        _queueCascadeService = queueCascadeService;
    }

    /// <summary>
    /// Get the effective moderator ID for a user.
    /// If user is a moderator, returns their own ID.
    /// If user has a moderator, returns the moderator's ID.
    /// </summary>
    public async Task<int> GetEffectiveModeratorIdAsync(int userId)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
            throw new InvalidOperationException($"User with ID {userId} not found");

        // If user has ModeratorId set, use that (users share moderator's quota)
        if (user.ModeratorId.HasValue)
            return user.ModeratorId.Value;

        // If user is moderator themselves, use their own ID
        if (user.Role == "moderator")
            return user.Id;

        // Admins don't have quotas
        throw new InvalidOperationException("User is not associated with any moderator");
    }

    /// <summary>
    /// Get quota for the effective moderator
    /// </summary>
    public async Task<Quota?> GetQuotaForUserAsync(int userId)
    {
        try
        {
            var moderatorId = await GetEffectiveModeratorIdAsync(userId);
            return await _context.Quotas.FirstOrDefaultAsync(q => q.ModeratorUserId == moderatorId);
        }
        catch
        {
            return null; // Admins or users without moderators
        }
    }

    /// <summary>
    /// Check if user/moderator has enough quota for messages
    /// </summary>
    public async Task<bool> HasMessagesQuotaAsync(int userId, int count)
    {
        var quota = await GetQuotaForUserAsync(userId);
        if (quota == null) return true; // No quota restriction (admins)
        
        return quota.RemainingMessages >= count;
    }

    /// <summary>
    /// Check if user/moderator has enough quota for queues
    /// </summary>
    public async Task<bool> HasQueuesQuotaAsync(int userId)
    {
        var quota = await GetQuotaForUserAsync(userId);
        if (quota == null) return true; // No quota restriction (admins)
        
        return quota.RemainingQueues > 0;
    }

    /// <summary>
    /// Consume messages quota for user/moderator
    /// </summary>
    public async Task<bool> ConsumeMessagesQuotaAsync(int userId, int count)
    {
        try
        {
            var moderatorId = await GetEffectiveModeratorIdAsync(userId);
            var quota = await _context.Quotas.FirstOrDefaultAsync(q => q.ModeratorUserId == moderatorId);
            
            if (quota == null)
            {
                // Create default quota if doesn't exist
                quota = new Quota
                {
                    ModeratorUserId = moderatorId,
                    MessagesQuota = 0,
                    ConsumedMessages = 0,
                    QueuesQuota = 0,
                    ConsumedQueues = 0,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.Quotas.Add(quota);
            }

            // Check if enough quota
            if (quota.RemainingMessages < count)
                return false;

            quota.ConsumedMessages += count;
            quota.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            
            return true;
        }
        catch
        {
            // Admins - no quota restrictions
            return true;
        }
    }

    /// <summary>
    /// Consume queue quota for user/moderator
    /// </summary>
    public async Task<bool> ConsumeQueueQuotaAsync(int userId)
    {
        try
        {
            var moderatorId = await GetEffectiveModeratorIdAsync(userId);
            var quota = await _context.Quotas.FirstOrDefaultAsync(q => q.ModeratorUserId == moderatorId);
            
            if (quota == null)
            {
                // Create default quota
                quota = new Quota
                {
                    ModeratorUserId = moderatorId,
                    MessagesQuota = 0,
                    ConsumedMessages = 0,
                    QueuesQuota = 0,
                    ConsumedQueues = 0,
                    UpdatedAt = DateTime.UtcNow
                };
                _context.Quotas.Add(quota);
            }

            // Check if enough quota
            if (quota.RemainingQueues <= 0)
                return false;

            quota.ConsumedQueues++;
            quota.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            
            return true;
        }
        catch
        {
            // Admins - no quota restrictions
            return true;
        }
    }

    /// <summary>
    /// Release queue quota when queue is deleted
    /// </summary>
    public async Task ReleaseQueueQuotaAsync(int userId)
    {
        try
        {
            var moderatorId = await GetEffectiveModeratorIdAsync(userId);
            var quota = await _context.Quotas.FirstOrDefaultAsync(q => q.ModeratorUserId == moderatorId);
            
            if (quota != null && quota.ConsumedQueues > 0)
            {
                quota.ConsumedQueues--;
                quota.UpdatedAt = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }
        }
        catch
        {
            // Ignore for admins
        }
    }

    /// <summary>
    /// Add quota to moderator
    /// </summary>
    public async Task AddQuotaAsync(int moderatorId, int addMessages, int addQueues)
    {
        var quota = await _context.Quotas.FirstOrDefaultAsync(q => q.ModeratorUserId == moderatorId);
        
        if (quota == null)
        {
            quota = new Quota
            {
                ModeratorUserId = moderatorId,
                MessagesQuota = addMessages,
                ConsumedMessages = 0,
                QueuesQuota = addQueues,
                ConsumedQueues = 0,
                UpdatedAt = DateTime.UtcNow
            };
            _context.Quotas.Add(quota);
        }
        else
        {
            quota.MessagesQuota += addMessages;
            quota.QueuesQuota += addQueues;
            quota.UpdatedAt = DateTime.UtcNow;
        }
        
        await _context.SaveChangesAsync();
    }

    /// <summary>
    /// Get all users managed by a moderator
    /// </summary>
    public async Task<List<User>> GetManagedUsersAsync(int moderatorId)
    {
        return await _context.Users
            .Where(u => u.ModeratorId == moderatorId)
            .ToListAsync();
    }

    /// <summary>
    /// Assign user to moderator
    /// </summary>
    public async Task AssignUserToModeratorAsync(int userId, int moderatorId)
    {
        var user = await _context.Users.FindAsync(userId);
        var moderator = await _context.Users.FindAsync(moderatorId);

        if (user == null)
            throw new InvalidOperationException("User not found");
        
        if (moderator == null || moderator.Role != "moderator")
            throw new InvalidOperationException("Invalid moderator");

        user.ModeratorId = moderatorId;
        await _context.SaveChangesAsync();
    }

    /// <summary>
    /// Restore a soft-deleted queue via the cascade service.
    /// Delegates to QueueCascadeService for TTL and business rule enforcement.
    /// </summary>
    public async Task<RestoreResult> RestoreQueueAsync(Queue queue, int? restoredBy = null)
    {
        return await _queueCascadeService.RestoreQueueAsync(queue, restoredBy, ttlDays: 30);
    }
}
