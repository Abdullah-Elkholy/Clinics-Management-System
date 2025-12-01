using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using Clinics.Infrastructure;
using Clinics.Domain;

namespace Clinics.Api.Hubs;

/// <summary>
/// SignalR Hub for real-time data updates
/// Implements per-moderator group model as per PERFORMANCE_RESEARCH_AND_CDC_ANALYSIS.md Section 10.2
/// </summary>
[Authorize]
public class DataUpdateHub : Hub
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<DataUpdateHub> _logger;

    public DataUpdateHub(ApplicationDbContext db, ILogger<DataUpdateHub> logger)
    {
        _db = db;
        _logger = logger;
    }

    /// <summary>
    /// Called when a client connects to the hub
    /// Automatically subscribes user to their moderator's group
    /// </summary>
    public override async Task OnConnectedAsync()
    {
        try
        {
            var userId = GetUserId();
            if (userId == null)
            {
                _logger.LogWarning("Connection rejected: Unable to get user ID from token");
                Context.Abort();
                return;
            }

            var user = await _db.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == userId.Value);

            if (user == null)
            {
                _logger.LogWarning("Connection rejected: User {UserId} not found", userId);
                Context.Abort();
                return;
            }

            // Subscribe to appropriate groups based on user role
            if (user.Role == "moderator")
            {
                // Moderator subscribes to their own group
                await Groups.AddToGroupAsync(Context.ConnectionId, $"moderator-{user.Id}");
                _logger.LogInformation("Moderator {UserId} connected to group moderator-{ModeratorId}", 
                    user.Id, user.Id);
            }
            else if (user.Role == "user" && user.ModeratorId.HasValue)
            {
                // Regular user subscribes to their assigned moderator's group
                await Groups.AddToGroupAsync(Context.ConnectionId, $"moderator-{user.ModeratorId.Value}");
                _logger.LogInformation("User {UserId} connected to group moderator-{ModeratorId}", 
                    user.Id, user.ModeratorId.Value);
            }
            else if (user.Role == "primary_admin" || user.Role == "secondary_admin")
            {
                // Admins subscribe to special admin group to receive all updates
                await Groups.AddToGroupAsync(Context.ConnectionId, "admin-all");
                _logger.LogInformation("Admin {UserId} connected to group admin-all", user.Id);

                // Optionally subscribe to all moderator groups for granular monitoring
                // This is commented out by default to reduce overhead
                // var allModerators = await _db.Users
                //     .AsNoTracking()
                //     .Where(u => u.Role == "moderator" && !u.IsDeleted)
                //     .Select(u => u.Id)
                //     .ToListAsync();
                // 
                // foreach (var moderatorId in allModerators)
                // {
                //     await Groups.AddToGroupAsync(Context.ConnectionId, $"moderator-{moderatorId}");
                // }
            }

            await base.OnConnectedAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in OnConnectedAsync for connection {ConnectionId}", 
                Context.ConnectionId);
            Context.Abort();
        }
    }

    /// <summary>
    /// Called when a client disconnects from the hub
    /// </summary>
    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (exception != null)
        {
            _logger.LogWarning(exception, "Client {ConnectionId} disconnected with error", 
                Context.ConnectionId);
        }
        else
        {
            _logger.LogInformation("Client {ConnectionId} disconnected normally", 
                Context.ConnectionId);
        }

        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Manual subscription to a specific moderator's group
    /// Used for targeted monitoring or dynamic subscriptions
    /// </summary>
    /// <param name="moderatorId">The moderator ID to subscribe to</param>
    public async Task SubscribeToModerator(int moderatorId)
    {
        try
        {
            var userId = GetUserId();
            if (userId == null)
            {
                _logger.LogWarning("SubscribeToModerator rejected: Unable to get user ID");
                return;
            }

            // Verify user has access to this moderator
            if (!await HasAccessToModeratorAsync(userId.Value, moderatorId))
            {
                _logger.LogWarning("User {UserId} attempted to subscribe to unauthorized moderator {ModeratorId}", 
                    userId.Value, moderatorId);
                throw new HubException("You don't have access to this moderator's data");
            }

            await Groups.AddToGroupAsync(Context.ConnectionId, $"moderator-{moderatorId}");
            _logger.LogInformation("User {UserId} manually subscribed to moderator-{ModeratorId}", 
                userId.Value, moderatorId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in SubscribeToModerator for moderator {ModeratorId}", moderatorId);
            throw;
        }
    }

    /// <summary>
    /// Unsubscribe from a specific moderator's group
    /// </summary>
    public async Task UnsubscribeFromModerator(int moderatorId)
    {
        try
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"moderator-{moderatorId}");
            _logger.LogInformation("Connection {ConnectionId} unsubscribed from moderator-{ModeratorId}", 
                Context.ConnectionId, moderatorId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in UnsubscribeFromModerator for moderator {ModeratorId}", moderatorId);
            throw;
        }
    }

    /// <summary>
    /// Subscribe as admin to receive all updates
    /// Only available to admin users
    /// </summary>
    public async Task SubscribeAsAdmin()
    {
        try
        {
            var userId = GetUserId();
            if (userId == null)
            {
                _logger.LogWarning("SubscribeAsAdmin rejected: Unable to get user ID");
                return;
            }

            var user = await _db.Users
                .AsNoTracking()
                .FirstOrDefaultAsync(u => u.Id == userId.Value);

            if (user == null || (user.Role != "primary_admin" && user.Role != "secondary_admin"))
            {
                _logger.LogWarning("User {UserId} attempted to subscribe as admin without authorization", 
                    userId.Value);
                throw new HubException("You don't have admin privileges");
            }

            await Groups.AddToGroupAsync(Context.ConnectionId, "admin-all");
            _logger.LogInformation("User {UserId} subscribed as admin", userId.Value);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error in SubscribeAsAdmin");
            throw;
        }
    }

    #region Helper Methods

    /// <summary>
    /// Get user ID from JWT token claims
    /// </summary>
    private int? GetUserId()
    {
        var userIdClaim = Context.User?.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? Context.User?.FindFirst("sub")?.Value
            ?? Context.User?.FindFirst("userId")?.Value;

        if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
        {
            return null;
        }

        return userId;
    }

    /// <summary>
    /// Verify if user has access to a specific moderator's data
    /// </summary>
    private async Task<bool> HasAccessToModeratorAsync(int userId, int moderatorId)
    {
        var user = await _db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            return false;
        }

        // Admins have access to all moderators
        if (user.Role == "primary_admin" || user.Role == "secondary_admin")
        {
            return true;
        }

        // Moderators have access to their own data
        if (user.Role == "moderator" && user.Id == moderatorId)
        {
            return true;
        }

        // Regular users have access to their assigned moderator's data
        if (user.Role == "user" && user.ModeratorId == moderatorId)
        {
            return true;
        }

        return false;
    }

    #endregion
}
