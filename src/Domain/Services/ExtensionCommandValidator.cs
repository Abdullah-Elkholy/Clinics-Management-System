using System;

namespace Clinics.Domain.Services;

/// <summary>
/// DEF-006, DEF-010 FIX: Extension command validation and lifecycle helper.
/// Validates commands before creation and provides lifecycle constants.
/// </summary>
public static class ExtensionCommandValidator
{
    /// <summary>
    /// Maximum number of retry attempts for a command before it should be abandoned.
    /// DEF-010 FIX: Prevents infinite retry loops.
    /// </summary>
    public const int MaxRetryCount = 5;

    /// <summary>
    /// Default command expiry duration in seconds.
    /// </summary>
    public const int DefaultExpirySeconds = 120;

    /// <summary>
    /// Timeout for acked-but-not-completed commands (shorter than expiry).
    /// DEF-007: Commands acked but not completed within this time should be recovered.
    /// </summary>
    public const int AckTimeoutSeconds = 60;

    /// <summary>
    /// Minimum time in the future for command expiry.
    /// DEF-006 FIX: Prevents creating already-expired commands.
    /// </summary>
    public const int MinExpiryBufferSeconds = 5;

    /// <summary>
    /// Validates if a command can be created with the given parameters.
    /// </summary>
    /// <param name="expiresAtUtc">Proposed expiry time</param>
    /// <returns>Validation result with error message if invalid</returns>
    public static (bool IsValid, string? Error) ValidateCreation(DateTime expiresAtUtc)
    {
        // DEF-006: Check if expiry is in the future
        var minExpiry = DateTime.UtcNow.AddSeconds(MinExpiryBufferSeconds);
        if (expiresAtUtc < minExpiry)
        {
            return (false, $"Command expiry must be at least {MinExpiryBufferSeconds} seconds in the future");
        }

        return (true, null);
    }

    /// <summary>
    /// Validates if a command can be retried.
    /// DEF-010 FIX: Enforces max retry limit.
    /// </summary>
    /// <param name="currentRetryCount">Current retry count</param>
    /// <returns>True if retry is allowed</returns>
    public static bool CanRetry(int currentRetryCount)
    {
        return currentRetryCount < MaxRetryCount;
    }

    /// <summary>
    /// Checks if an acked command has timed out.
    /// DEF-007: Detects stuck acked commands.
    /// </summary>
    /// <param name="ackedAtUtc">When command was acked</param>
    /// <returns>True if command has exceeded ack timeout</returns>
    public static bool IsAckTimedOut(DateTime? ackedAtUtc)
    {
        if (!ackedAtUtc.HasValue)
            return false;

        return DateTime.UtcNow > ackedAtUtc.Value.AddSeconds(AckTimeoutSeconds);
    }

    /// <summary>
    /// Checks if a command has expired based on its expiry time.
    /// </summary>
    public static bool IsExpired(DateTime expiresAtUtc)
    {
        return DateTime.UtcNow > expiresAtUtc;
    }

    /// <summary>
    /// Determines if command status is terminal (no further transitions allowed).
    /// </summary>
    public static bool IsTerminalStatus(string status)
    {
        return status == ExtensionCommandStatuses.Completed ||
               status == ExtensionCommandStatuses.Failed ||
               status == ExtensionCommandStatuses.Expired;
    }

    /// <summary>
    /// Valid status transitions for extension commands.
    /// </summary>
    private static readonly Dictionary<string, HashSet<string>> ValidTransitions = new()
    {
        [ExtensionCommandStatuses.Pending] = new()
        {
            ExtensionCommandStatuses.Sent,
            ExtensionCommandStatuses.Expired,
            ExtensionCommandStatuses.Failed
        },
        [ExtensionCommandStatuses.Sent] = new()
        {
            ExtensionCommandStatuses.Acked,
            ExtensionCommandStatuses.Completed,
            ExtensionCommandStatuses.Failed,
            ExtensionCommandStatuses.Expired
        },
        [ExtensionCommandStatuses.Acked] = new()
        {
            ExtensionCommandStatuses.Completed,
            ExtensionCommandStatuses.Failed,
            ExtensionCommandStatuses.Expired
        },
        // Terminal states - no further transitions
        [ExtensionCommandStatuses.Completed] = new(),
        [ExtensionCommandStatuses.Failed] = new(),
        [ExtensionCommandStatuses.Expired] = new()
    };

    /// <summary>
    /// Validates if a command status transition is allowed.
    /// </summary>
    public static bool CanTransition(string fromStatus, string toStatus)
    {
        if (ValidTransitions.TryGetValue(fromStatus, out var validNext))
            return validNext.Contains(toStatus);
        return false;
    }
}
