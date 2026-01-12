using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Clinics.Domain;
using Clinics.Domain.Services;
using Clinics.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Clinics.Api.Services.Extension;

/// <summary>
/// DEF-008, DEF-009 FIX: Background cleanup service for extension commands.
/// Detects and recovers orphaned commands and messages.
/// Should be called periodically (e.g., every 60 seconds) by a background job.
/// </summary>
public class ExtensionCommandCleanupService
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<ExtensionCommandCleanupService> _logger;

    public ExtensionCommandCleanupService(
        ApplicationDbContext context,
        ILogger<ExtensionCommandCleanupService> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Run all cleanup tasks. Call this from a background job.
    /// </summary>
    public async Task<CleanupResult> RunCleanupAsync()
    {
        var result = new CleanupResult();

        try
        {
            // DEF-007: Expire acked commands that have timed out
            result.AckedTimedOut = await ExpireAckedTimedOutCommandsAsync();

            // DEF-008: Fix messages with orphaned InFlightCommandId
            result.OrphanedMessages = await RecoverOrphanedMessagesAsync();

            // DEF-009: Cancel duplicate in-flight commands per message
            result.DuplicatesCanceled = await CancelDuplicateCommandsAsync();

            // Expire old pending commands
            result.ExpiredCommands = await ExpireOldPendingCommandsAsync();

            result.Success = true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during command cleanup");
            result.Error = ex.Message;
        }

        return result;
    }

    /// <summary>
    /// DEF-007 FIX: Find commands that were acked but never completed within timeout.
    /// </summary>
    private async Task<int> ExpireAckedTimedOutCommandsAsync()
    {
        var cutoff = DateTime.UtcNow.AddSeconds(-ExtensionCommandValidator.AckTimeoutSeconds);

        var stuckCommands = await _context.ExtensionCommands
            .Where(c => c.Status == ExtensionCommandStatuses.Acked &&
                        c.AckedAtUtc.HasValue &&
                        c.AckedAtUtc.Value < cutoff)
            .ToListAsync();

        foreach (var cmd in stuckCommands)
        {
            _logger.LogWarning("DEF-007: Expiring acked-but-stuck command {CommandId} for message {MessageId}",
                cmd.Id, cmd.MessageId);
            cmd.Status = ExtensionCommandStatuses.Expired;
            cmd.CompletedAtUtc = DateTime.UtcNow;
            cmd.ResultJson = "{\"error\": \"Ack timeout - extension did not complete within timeout\"}";
        }

        if (stuckCommands.Any())
            await _context.SaveChangesAsync();

        return stuckCommands.Count;
    }

    /// <summary>
    /// DEF-008 FIX: Find messages with InFlightCommandId pointing to expired/missing commands.
    /// </summary>
    private async Task<int> RecoverOrphanedMessagesAsync()
    {
        // Find messages in "sending" status with InFlightCommandId
        var sendingMessages = await _context.Messages
            .Where(m => m.Status == "sending" && m.InFlightCommandId.HasValue)
            .ToListAsync();

        int recovered = 0;
        foreach (var msg in sendingMessages)
        {
            // Check if the command exists and is still active
            var command = await _context.ExtensionCommands
                .FirstOrDefaultAsync(c => c.Id == msg.InFlightCommandId);

            bool isOrphaned = false;
            if (command == null)
            {
                isOrphaned = true;
                _logger.LogWarning("DEF-008: Message {MessageId} has InFlightCommandId pointing to missing command",
                    msg.Id);
            }
            else if (ExtensionCommandValidator.IsTerminalStatus(command.Status))
            {
                isOrphaned = true;
                _logger.LogWarning("DEF-008: Message {MessageId} has InFlightCommandId pointing to terminal command {CommandId} (status={Status})",
                    msg.Id, command.Id, command.Status);
            }

            if (isOrphaned)
            {
                // Reset message to queued for retry, or failed if max attempts reached
                msg.InFlightCommandId = null;
                if (msg.Attempts >= 5)
                {
                    msg.Status = "failed";
                    msg.ErrorMessage = "Orphaned command - max attempts reached";
                }
                else
                {
                    msg.Status = "queued";
                }
                recovered++;
            }
        }

        if (recovered > 0)
            await _context.SaveChangesAsync();

        return recovered;
    }

    /// <summary>
    /// DEF-009 FIX: Find and cancel duplicate in-flight commands for the same message.
    /// </summary>
    private async Task<int> CancelDuplicateCommandsAsync()
    {
        // Group active commands by MessageId
        var activeCommands = await _context.ExtensionCommands
            .Where(c => c.MessageId.HasValue &&
                        (c.Status == ExtensionCommandStatuses.Pending ||
                         c.Status == ExtensionCommandStatuses.Sent ||
                         c.Status == ExtensionCommandStatuses.Acked))
            .GroupBy(c => c.MessageId)
            .Where(g => g.Count() > 1)
            .ToListAsync();

        int canceled = 0;
        foreach (var group in activeCommands)
        {
            // Keep the newest command, cancel the rest
            var commands = group.OrderByDescending(c => c.CreatedAtUtc).ToList();
            var keep = commands.First();

            foreach (var dup in commands.Skip(1))
            {
                _logger.LogWarning("DEF-009: Canceling duplicate command {CommandId} for message {MessageId} (keeping {KeptId})",
                    dup.Id, dup.MessageId, keep.Id);
                dup.Status = ExtensionCommandStatuses.Expired;
                dup.CompletedAtUtc = DateTime.UtcNow;
                dup.ResultJson = "{\"error\": \"Canceled - duplicate command for same message\"}";
                canceled++;
            }
        }

        if (canceled > 0)
            await _context.SaveChangesAsync();

        return canceled;
    }

    /// <summary>
    /// Expire commands that have been pending too long.
    /// </summary>
    private async Task<int> ExpireOldPendingCommandsAsync()
    {
        var now = DateTime.UtcNow;

        var expiredCommands = await _context.ExtensionCommands
            .Where(c => c.Status == ExtensionCommandStatuses.Pending &&
                        c.ExpiresAtUtc < now)
            .ToListAsync();

        foreach (var cmd in expiredCommands)
        {
            cmd.Status = ExtensionCommandStatuses.Expired;
            cmd.CompletedAtUtc = now;
            cmd.ResultJson = "{\"error\": \"Command expired before being sent\"}";
        }

        if (expiredCommands.Any())
            await _context.SaveChangesAsync();

        return expiredCommands.Count;
    }
}

/// <summary>
/// Result of cleanup operation.
/// </summary>
public class CleanupResult
{
    public bool Success { get; set; }
    public string? Error { get; set; }
    public int AckedTimedOut { get; set; }
    public int OrphanedMessages { get; set; }
    public int DuplicatesCanceled { get; set; }
    public int ExpiredCommands { get; set; }

    public int TotalCleaned => AckedTimedOut + OrphanedMessages + DuplicatesCanceled + ExpiredCommands;
}
