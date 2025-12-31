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
            return await _db.ExtensionCommands.FindAsync(commandId);
        }
    }
}
