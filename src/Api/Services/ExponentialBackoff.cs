namespace Clinics.Api.Services;

/// <summary>
/// Exponential backoff helper for retry logic
/// </summary>
public static class ExponentialBackoff
{
    private static readonly Random _random = new Random();
    
    /// <summary>
    /// Calculate backoff delay with exponential growth and jitter
    /// </summary>
    /// <param name="attemptNumber">Current attempt number (1-based)</param>
    /// <param name="baseDelaySeconds">Base delay in seconds (default 1)</param>
    /// <param name="maxDelaySeconds">Maximum delay in seconds (default 30)</param>
    /// <param name="jitterPercent">Jitter percentage 0-100 (default 20)</param>
    /// <returns>Delay in milliseconds</returns>
    public static int CalculateDelayMs(int attemptNumber, int baseDelaySeconds = 1, int maxDelaySeconds = 30, int jitterPercent = 20)
    {
        // Exponential: base * 2^(attempt-1)
        // Example: 1s → 2s → 4s → 8s → 16s → 30s (capped)
        var exponentialDelay = baseDelaySeconds * Math.Pow(2, attemptNumber - 1);
        var cappedDelay = Math.Min(exponentialDelay, maxDelaySeconds);
        
        // Add jitter to prevent thundering herd
        var jitterRange = cappedDelay * (jitterPercent / 100.0);
        var jitter = (_random.NextDouble() - 0.5) * 2 * jitterRange; // -jitterRange to +jitterRange
        
        var finalDelay = Math.Max(0, cappedDelay + jitter);
        
        return (int)(finalDelay * 1000); // Convert to milliseconds
    }

    /// <summary>
    /// Get human-readable delay description
    /// </summary>
    public static string GetDelayDescription(int attemptNumber, int baseDelaySeconds = 1, int maxDelaySeconds = 30)
    {
        var delayMs = CalculateDelayMs(attemptNumber, baseDelaySeconds, maxDelaySeconds, jitterPercent: 0);
        var delaySec = delayMs / 1000.0;
        
        if (delaySec < 60)
        {
            return $"{delaySec:F1}s";
        }
        else
        {
            return $"{delaySec / 60:F1}m";
        }
    }
}
