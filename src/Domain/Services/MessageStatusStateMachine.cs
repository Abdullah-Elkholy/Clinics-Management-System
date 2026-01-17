namespace Clinics.Domain.Services;

/// <summary>
/// DEF-014 FIX: Message status state machine.
/// Validates status transitions to prevent invalid state changes.
/// </summary>
public static class MessageStatusStateMachine
{
    /// <summary>
    /// Valid status transitions. Key = current status, Value = allowed next statuses.
    /// </summary>
    private static readonly Dictionary<string, HashSet<string>> ValidTransitions = new()
    {
        ["queued"] = new() { "sending", "paused", "failed" },
        ["sending"] = new() { "sent", "failed" },
        ["paused"] = new() { "queued", "failed" },
        ["sent"] = new(),  // Terminal state - no further transitions
        ["failed"] = new() { "queued" }  // Retry allowed
    };

    /// <summary>
    /// Check if a status transition is valid.
    /// </summary>
    /// <param name="from">Current status</param>
    /// <param name="to">Requested new status</param>
    /// <returns>True if transition is allowed</returns>
    public static bool CanTransition(string? from, string? to)
    {
        if (string.IsNullOrEmpty(from) || string.IsNullOrEmpty(to))
            return false;

        var fromLower = from.ToLowerInvariant();
        var toLower = to.ToLowerInvariant();

        if (!ValidTransitions.TryGetValue(fromLower, out var validNextStatuses))
            return false;

        return validNextStatuses.Contains(toLower);
    }

    /// <summary>
    /// Get all valid next statuses for a given current status.
    /// </summary>
    public static IReadOnlySet<string> GetValidNextStatuses(string? current)
    {
        if (string.IsNullOrEmpty(current))
            return new HashSet<string>();

        var currentLower = current.ToLowerInvariant();

        if (ValidTransitions.TryGetValue(currentLower, out var validNext))
            return validNext;

        return new HashSet<string>();
    }

    /// <summary>
    /// Check if a status is a terminal state (no further transitions allowed).
    /// </summary>
    public static bool IsTerminal(string? status)
    {
        if (string.IsNullOrEmpty(status))
            return false;

        var statusLower = status.ToLowerInvariant();
        return ValidTransitions.TryGetValue(statusLower, out var next) && next.Count == 0;
    }

    /// <summary>
    /// All known statuses in the system.
    /// </summary>
    public static IReadOnlyList<string> AllStatuses =>
        new[] { "queued", "sending", "paused", "sent", "failed" };
}
