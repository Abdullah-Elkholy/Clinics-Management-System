using Clinics.Domain;
using Clinics.Infrastructure;
using Clinics.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace Clinics.Api.Services;

/// <summary>
/// Service for managing quotas and user-moderator relationships.
/// Handles shared quota logic where users consume their moderator's quota.
/// </summary>
public class QuotaService : Clinics.Application.Interfaces.IQuotaService
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

        // Check if user is a moderator first
        // Moderators use their own ID for quota tracking
        if (user.Role == "moderator")
            return user.Id;

        // If user has ModeratorId set, use that (users share moderator's quota)
        if (user.ModeratorId.HasValue)
            return user.ModeratorId.Value;

        // Admins don't have quotas
        throw new InvalidOperationException("User is not associated with any moderator");
    }

    /// <summary>
    /// Get or create quota for the effective moderator.
    /// If quota exists, returns it. If missing, creates one with unlimited values.
    /// Quota is always tied to a moderator—never created standalone.
    /// </summary>
    public async Task<Quota> GetOrCreateQuotaForModeratorAsync(int moderatorId)
    {
        var existingQuota = await _context.Quotas.FirstOrDefaultAsync(q => q.ModeratorUserId == moderatorId);
        
        if (existingQuota != null)
            return existingQuota;

        // Create new unlimited quota for this moderator (-1 = unlimited)
        var newQuota = new Quota
        {
            ModeratorUserId = moderatorId,
            MessagesQuota = -1, // -1 = unlimited
            ConsumedMessages = 0,
            QueuesQuota = -1, // -1 = unlimited
            ConsumedQueues = 0,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Quotas.Add(newQuota);
        await _context.SaveChangesAsync();

        return newQuota;
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
    /// Returns true if quota is unlimited (-1) or if remaining quota >= count
    /// </summary>
    public async Task<bool> HasMessagesQuotaAsync(int userId, int count)
    {
        var quota = await GetQuotaForUserAsync(userId);
        if (quota == null) return true; // No quota restriction (admins)
        
        // Unlimited quota (-1) always has enough
        if (quota.MessagesQuota == -1) return true;
        
        return quota.RemainingMessages >= count;
    }

    /// <summary>
    /// Check if user/moderator has enough quota for queues
    /// Returns true if quota is unlimited (-1) or if remaining quota > 0
    /// </summary>
    public async Task<bool> HasQueuesQuotaAsync(int userId)
    {
        var quota = await GetQuotaForUserAsync(userId);
        if (quota == null) return true; // No quota restriction (admins)
        
        // Unlimited quota (-1) always has enough
        if (quota.QueuesQuota == -1) return true;
        
        return quota.RemainingQueues > 0;
    }

    /// <summary>
    /// Consume messages quota for user/moderator
    /// NOTE: Quota is now consumed when messages are SUCCESSFULLY SENT (in MessageProcessor),
    /// not when queued. This ensures fair billing - users only pay for delivered messages.
    /// ConsumedMessages tracks the total number of messages actually sent.
    /// </summary>
    public async Task<bool> ConsumeMessageQuotaAsync(int userId, int count)
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

            // Check if enough quota (skip check if unlimited)
            if (quota.MessagesQuota != -1 && quota.RemainingMessages < count)
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

            // Check if enough quota (skip check if unlimited)
            if (quota.QueuesQuota != -1 && quota.RemainingQueues <= 0)
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

    // IQuotaService interface implementation wrappers
    
    /// <summary>
    /// Check if user can send messages (IQuotaService interface)
    /// </summary>
    public async Task<(bool allowed, string message)> CanSendMessageAsync(int userId, int count = 1)
    {
        var hasQuota = await HasMessagesQuotaAsync(userId, count);
        if (hasQuota)
            return (true, "Quota available");
        
        return (false, $"Insufficient message quota. Need {count} messages.");
    }

    /// <summary>
    /// Check if user can create queue (IQuotaService interface)
    /// </summary>
    public async Task<(bool allowed, string message)> CanCreateQueueAsync(int userId)
    {
        var hasQuota = await HasQueuesQuotaAsync(userId);
        if (hasQuota)
            return (true, "Quota available");
        
        return (false, "Insufficient queue quota.");
    }

    /// <summary>
    /// Consume queue quota directly for a specific moderator.
    /// Useful for admin flows where the acting user is not the moderator but
    /// wants to consume from a moderator's quota.
    /// </summary>
    public async Task<bool> ConsumeQueueQuotaForModeratorAsync(int moderatorId)
    {
        var quota = await _context.Quotas.FirstOrDefaultAsync(q => q.ModeratorUserId == moderatorId);

        if (quota == null)
        {
            // Create default quota for this moderator if missing
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

        // Check if enough quota (skip check if unlimited)
        if (quota.QueuesQuota != -1 && quota.RemainingQueues <= 0)
            return false;

        quota.ConsumedQueues++;
        quota.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        return true;
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
    /// Note: Cannot add to unlimited quota (-1). If current quota is unlimited, setting a new limit will replace it.
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
            // Only add if current quota is not unlimited (-1)
            // If unlimited, adding would be meaningless, so we skip it
            if (quota.MessagesQuota != -1)
            {
                quota.MessagesQuota += addMessages;
            }
            
            if (quota.QueuesQuota != -1)
            {
                quota.QueuesQuota += addQueues;
            }
            
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

        // Prevent assigning moderators or admins to other moderators
        if (user.Role != "user")
            throw new InvalidOperationException("Only users with 'user' role can be assigned to a moderator");

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
