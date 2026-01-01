using Microsoft.AspNetCore.SignalR;
using Clinics.Api.Services.Extension;
using System.Security.Claims;

namespace Clinics.Api.Hubs
{
    /// <summary>
    /// SignalR Hub for browser extension communication.
    /// Handles command dispatch, heartbeats, and status updates.
    /// Extensions authenticate via device token and join moderator-specific groups.
    /// </summary>
    public class ExtensionHub : Hub
    {
        private readonly IExtensionLeaseService _leaseService;
        private readonly IExtensionCommandService _commandService;
        private readonly ILogger<ExtensionHub> _logger;

        // Connection metadata keys
        private const string ModeratorIdKey = "ModeratorId";
        private const string DeviceIdKey = "DeviceId";
        private const string LeaseIdKey = "LeaseId";

        public ExtensionHub(
            IExtensionLeaseService leaseService,
            IExtensionCommandService commandService,
            ILogger<ExtensionHub> logger)
        {
            _leaseService = leaseService;
            _commandService = commandService;
            _logger = logger;
        }

        /// <summary>
        /// Called when extension connects. Extension must provide lease info.
        /// </summary>
        public override async Task OnConnectedAsync()
        {
            _logger.LogInformation("Extension connection attempt: {ConnectionId}", Context.ConnectionId);
            await base.OnConnectedAsync();
        }

        /// <summary>
        /// Called when extension disconnects.
        /// </summary>
        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var moderatorId = GetConnectionData<int?>(ModeratorIdKey);
            var deviceId = GetConnectionData<Guid?>(DeviceIdKey);

            if (moderatorId.HasValue)
            {
                _logger.LogInformation("Extension disconnected: moderator {ModeratorId}, device {DeviceId}, connection {ConnectionId}", 
                    moderatorId, deviceId, Context.ConnectionId);
            }

            await base.OnDisconnectedAsync(exception);
        }

        /// <summary>
        /// Extension registers itself after connecting.
        /// Must have valid lease to join command group.
        /// </summary>
        public async Task<object> Register(Guid leaseId, string leaseToken, int moderatorUserId, Guid deviceId)
        {
            try
            {
                // Validate lease
                var isValid = await _leaseService.ValidateLeaseAsync(leaseId, leaseToken);
                if (!isValid)
                {
                    _logger.LogWarning("Extension registration failed: invalid lease {LeaseId}", leaseId);
                    return new { success = false, error = "Invalid or expired lease" };
                }

                // Store connection metadata
                Context.Items[ModeratorIdKey] = moderatorUserId;
                Context.Items[DeviceIdKey] = deviceId;
                Context.Items[LeaseIdKey] = leaseId;

                // Join extension group for this moderator
                await Groups.AddToGroupAsync(Context.ConnectionId, $"extension-{moderatorUserId}");

                _logger.LogInformation("Extension registered: moderator {ModeratorId}, device {DeviceId}, connection {ConnectionId}", 
                    moderatorUserId, deviceId, Context.ConnectionId);

                // Get pending commands
                var pendingCommands = await _commandService.GetPendingCommandsAsync(moderatorUserId);

                return new 
                { 
                    success = true, 
                    moderatorId = moderatorUserId,
                    pendingCommands = pendingCommands.Select(c => new 
                    {
                        commandId = c.Id,
                        commandType = c.CommandType,
                        // Parse the JSON string to return as object (avoids double-encoding)
                        payload = System.Text.Json.JsonSerializer.Deserialize<object>(c.PayloadJson)
                    }).ToList()
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Extension registration error");
                return new { success = false, error = "Registration failed" };
            }
        }

        /// <summary>
        /// Extension sends heartbeat with status update.
        /// </summary>
        public async Task<object> Heartbeat(Guid leaseId, string leaseToken, string? currentUrl, string? whatsAppStatus, string? lastError)
        {
            try
            {
                var (success, error) = await _leaseService.HeartbeatAsync(
                    leaseId, 
                    leaseToken, 
                    currentUrl, 
                    whatsAppStatus, 
                    lastError);

                if (!success)
                {
                    _logger.LogWarning("Heartbeat failed for lease {LeaseId}: {Error}", leaseId, error);
                    return new { success = false, error };
                }

                return new { success = true };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Heartbeat error for lease {LeaseId}", leaseId);
                return new { success = false, error = "Heartbeat failed" };
            }
        }

        /// <summary>
        /// Extension acknowledges receipt of command.
        /// </summary>
        public async Task<object> AckCommand(Guid commandId)
        {
            try
            {
                var success = await _commandService.AcknowledgeAsync(commandId);
                return new { success };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "AckCommand error for command {CommandId}", commandId);
                return new { success = false, error = "Ack failed" };
            }
        }

        /// <summary>
        /// Extension reports command completion.
        /// </summary>
        public async Task<object> CompleteCommand(Guid commandId, string resultStatus, object? resultData)
        {
            try
            {
                var success = await _commandService.CompleteAsync(commandId, resultStatus, resultData);
                
                _logger.LogInformation("Command {CommandId} completed with status {Status}", commandId, resultStatus);
                
                return new { success };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "CompleteCommand error for command {CommandId}", commandId);
                return new { success = false, error = "Complete failed" };
            }
        }

        /// <summary>
        /// Extension reports command failure.
        /// </summary>
        public async Task<object> FailCommand(Guid commandId, string reason)
        {
            try
            {
                var success = await _commandService.FailAsync(commandId, reason);
                
                _logger.LogWarning("Command {CommandId} failed: {Reason}", commandId, reason);
                
                return new { success };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "FailCommand error for command {CommandId}", commandId);
                return new { success = false, error = "Fail report failed" };
            }
        }

        /// <summary>
        /// Extension requests pending commands (polling fallback).
        /// </summary>
        public async Task<object> GetPendingCommands()
        {
            try
            {
                var moderatorId = GetConnectionData<int?>(ModeratorIdKey);
                if (!moderatorId.HasValue)
                {
                    return new { success = false, error = "Not registered" };
                }

                var commands = await _commandService.GetPendingCommandsAsync(moderatorId.Value);
                
                return new 
                { 
                    success = true, 
                    commands = commands.Select(c => new 
                    {
                        commandId = c.Id,
                        commandType = c.CommandType,
                        // Parse the JSON string to return as object (avoids double-encoding)
                        payload = System.Text.Json.JsonSerializer.Deserialize<object>(c.PayloadJson)
                    }).ToList()
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GetPendingCommands error");
                return new { success = false, error = "Failed to get commands" };
            }
        }

        /// <summary>
        /// Extension reports WhatsApp status change (connected, pending_qr, etc.)
        /// </summary>
        public async Task<object> ReportStatus(string status, string? url, string? errorMessage)
        {
            try
            {
                var moderatorId = GetConnectionData<int?>(ModeratorIdKey);
                var leaseId = GetConnectionData<Guid?>(LeaseIdKey);

                if (!moderatorId.HasValue || !leaseId.HasValue)
                {
                    return new { success = false, error = "Not registered" };
                }

                // Get lease to update (we need the token, but for status we can trust the connection)
                var lease = await _leaseService.GetActiveLeaseAsync(moderatorId.Value);
                if (lease == null || lease.Id != leaseId.Value)
                {
                    return new { success = false, error = "Invalid lease" };
                }

                // Update lease status directly (simplified - in production use proper token validation)
                lease.WhatsAppStatus = status;
                lease.CurrentUrl = url;
                lease.LastError = errorMessage;

                _logger.LogInformation("Extension status update: moderator {ModeratorId}, status {Status}", 
                    moderatorId, status);

                return new { success = true };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "ReportStatus error");
                return new { success = false, error = "Status report failed" };
            }
        }

        #region Helper Methods

        private T? GetConnectionData<T>(string key)
        {
            if (Context.Items.TryGetValue(key, out var value) && value is T typedValue)
            {
                return typedValue;
            }
            return default;
        }

        #endregion
    }
}
