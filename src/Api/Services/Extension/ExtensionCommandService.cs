using System.Text.Json;
using Clinics.Domain;
using Clinics.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Clinics.Api.Services.Extension
{
    /// <summary>
    /// Service for managing commands sent to browser extensions.
    /// </summary>
    public class ExtensionCommandService : IExtensionCommandService
    {
        private readonly ApplicationDbContext _db;
        private readonly ILogger<ExtensionCommandService> _logger;
        private readonly TimeSpan _defaultCommandTimeout = TimeSpan.FromMinutes(2);
        private readonly JsonSerializerOptions _jsonOptions = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

        public ExtensionCommandService(ApplicationDbContext db, ILogger<ExtensionCommandService> logger)
        {
            _db = db;
            _logger = logger;
        }

        public async Task<ExtensionCommand> CreateCommandAsync(
            int moderatorUserId,
            string commandType,
            object payload,
            Guid? messageId = null,
            int priority = 100,
            TimeSpan? timeout = null)
        {
            var command = new ExtensionCommand
            {
                Id = Guid.NewGuid(),
                ModeratorUserId = moderatorUserId,
                CommandType = commandType,
                PayloadJson = JsonSerializer.Serialize(payload, _jsonOptions),
                MessageId = messageId,
                Status = ExtensionCommandStatuses.Pending,
                CreatedAtUtc = DateTime.UtcNow,
                ExpiresAtUtc = DateTime.UtcNow.Add(timeout ?? _defaultCommandTimeout),
                Priority = priority
            };

            _db.ExtensionCommands.Add(command);
            await _db.SaveChangesAsync();

            _logger.LogInformation("Created command {CommandId} ({CommandType}) for moderator {ModeratorId}", 
                command.Id, commandType, moderatorUserId);

            return command;
        }

        public async Task<IList<ExtensionCommand>> GetPendingCommandsAsync(int moderatorUserId, int maxCount = 10)
        {
            return await _db.ExtensionCommands
                .Where(c => c.ModeratorUserId == moderatorUserId && 
                           (c.Status == ExtensionCommandStatuses.Pending || c.Status == ExtensionCommandStatuses.Sent) &&
                            c.ExpiresAtUtc > DateTime.UtcNow)
                .OrderBy(c => c.Priority)
                .ThenBy(c => c.CreatedAtUtc)
                .Take(maxCount)
                .ToListAsync();
        }

        public async Task<bool> MarkSentAsync(Guid commandId)
        {
            var command = await _db.ExtensionCommands.FindAsync(commandId);
            if (command == null) return false;

            if (command.Status != ExtensionCommandStatuses.Pending)
            {
                _logger.LogWarning("Cannot mark command {CommandId} as sent - current status is {Status}", 
                    commandId, command.Status);
                return false;
            }

            command.Status = ExtensionCommandStatuses.Sent;
            command.SentAtUtc = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            _logger.LogDebug("Command {CommandId} marked as sent", commandId);
            return true;
        }

        public async Task<bool> AcknowledgeAsync(Guid commandId)
        {
            var command = await _db.ExtensionCommands.FindAsync(commandId);
            if (command == null) return false;

            if (command.Status != ExtensionCommandStatuses.Sent && command.Status != ExtensionCommandStatuses.Pending)
            {
                _logger.LogWarning("Cannot acknowledge command {CommandId} - current status is {Status}", 
                    commandId, command.Status);
                return false;
            }

            command.Status = ExtensionCommandStatuses.Acked;
            command.AckedAtUtc = DateTime.UtcNow;
            await _db.SaveChangesAsync();

            _logger.LogDebug("Command {CommandId} acknowledged", commandId);
            return true;
        }

        public async Task<bool> CompleteAsync(Guid commandId, string resultStatus, object? resultData = null)
        {
            var command = await _db.ExtensionCommands.FindAsync(commandId);
            if (command == null) return false;

            command.Status = ExtensionCommandStatuses.Completed;
            command.CompletedAtUtc = DateTime.UtcNow;
            command.ResultStatus = resultStatus;
            command.ResultJson = resultData != null 
                ? JsonSerializer.Serialize(resultData, _jsonOptions) 
                : null;

            // CRITICAL: If extension reports successful send, ALWAYS mark message as "sent"
            // This is the ground truth - the message was physically delivered to WhatsApp.
            // Pause enforcement must happen BEFORE sending, not after.
            // If a message slipped through during a race condition, we must still reflect
            // the actual state (sent) to prevent data inconsistency and duplicate sends.
            if (command.MessageId.HasValue && resultStatus == ExtensionResultStatuses.Success)
            {
                var message = await _db.Messages.FindAsync(command.MessageId.Value);
                if (message != null)
                {
                    if (message.Status != "sent")
                    {
                        _logger.LogInformation("Message {MessageId} marked as sent (was {Status}, IsPaused={IsPaused}, PauseReason={PauseReason}) - extension confirmed successful send after command {CommandId} completion",
                            message.Id, message.Status, message.IsPaused, message.PauseReason, commandId);
                        
                        message.Status = "sent";
                        message.SentAt = DateTime.UtcNow;
                        message.IsPaused = false;
                        message.PauseReason = null;
                        message.PausedAt = null;
                        message.ErrorMessage = null;
                    }
                }
            }
            // CRITICAL FIX: If extension reports failure, mark message as FAILED permanently
            // DO NOT retry automatically - user must manually retry failed messages
            // This prevents duplicate sends when extension times out but message was actually sent
            else if (command.MessageId.HasValue && resultStatus == ExtensionResultStatuses.Failed)
            {
                var message = await _db.Messages.FindAsync(command.MessageId.Value);
                if (message != null && message.Status == "sending")
                {
                    _logger.LogError("Message {MessageId} command failed, marking as PERMANENTLY FAILED (no automatic retry). Command {CommandId}, Error: {Error}",
                        message.Id, commandId, command.ResultJson);
                    
                    // Mark as permanently failed - NO automatic retry
                    message.Status = "failed";
                    message.InFlightCommandId = null;
                    message.ErrorMessage = $"Extension timeout: {command.ResultJson}";
                    message.NextAttemptAt = null; // Clear any retry scheduling
                }
            }

            await _db.SaveChangesAsync();

            _logger.LogInformation("Command {CommandId} completed with status {ResultStatus}", 
                commandId, resultStatus);

            return true;
        }

        public async Task<bool> FailAsync(Guid commandId, string reason)
        {
            var command = await _db.ExtensionCommands.FindAsync(commandId);
            if (command == null) return false;

            command.Status = ExtensionCommandStatuses.Failed;
            command.CompletedAtUtc = DateTime.UtcNow;
            command.ResultStatus = ExtensionResultStatuses.Failed;
            command.ResultJson = JsonSerializer.Serialize(new { error = reason }, _jsonOptions);

            await _db.SaveChangesAsync();

            _logger.LogWarning("Command {CommandId} failed: {Reason}", commandId, reason);

            return true;
        }

        public async Task<int> ExpireTimedOutCommandsAsync()
        {
            var now = DateTime.UtcNow;
            var expiredCommands = await _db.ExtensionCommands
                .Where(c => (c.Status == ExtensionCommandStatuses.Pending || 
                            c.Status == ExtensionCommandStatuses.Sent ||
                            c.Status == ExtensionCommandStatuses.Acked) &&
                           c.ExpiresAtUtc < now)
                .ToListAsync();

            foreach (var command in expiredCommands)
            {
                command.Status = ExtensionCommandStatuses.Expired;
                command.CompletedAtUtc = now;
                command.ResultStatus = ExtensionResultStatuses.Failed;
                command.ResultJson = JsonSerializer.Serialize(new { error = "Command timed out" }, _jsonOptions);
            }

            if (expiredCommands.Any())
            {
                await _db.SaveChangesAsync();
                _logger.LogInformation("Expired {Count} timed-out commands", expiredCommands.Count);
            }

            return expiredCommands.Count;
        }

        public async Task<ExtensionCommand?> GetCommandAsync(Guid commandId)
        {
            // Use AsNoTracking to always get fresh data from the database
            // This is critical for polling loops that check command completion status
            return await _db.ExtensionCommands
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == commandId);
        }
    }
}
