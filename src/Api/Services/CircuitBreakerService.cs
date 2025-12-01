using System.Collections.Concurrent;

namespace Clinics.Api.Services;

/// <summary>
/// Circuit breaker pattern implementation to prevent cascading failures
/// when WhatsApp service is experiencing issues
/// </summary>
public class CircuitBreakerService
{
    private readonly ILogger<CircuitBreakerService> _logger;
    
    // Circuit state per moderator
    private readonly ConcurrentDictionary<int, CircuitState> _circuits = new();
    
    // Configuration
    private readonly int _failureThreshold = 5; // Open circuit after 5 consecutive failures
    private readonly TimeSpan _openDuration = TimeSpan.FromMinutes(2); // Stay open for 2 minutes
    private readonly TimeSpan _halfOpenTimeout = TimeSpan.FromSeconds(30); // Half-open timeout
    
    public CircuitBreakerService(ILogger<CircuitBreakerService> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Execute an action through the circuit breaker
    /// </summary>
    public async Task<T> ExecuteAsync<T>(int moderatorId, Func<Task<T>> action)
    {
        var circuit = _circuits.GetOrAdd(moderatorId, _ => new CircuitState());
        
        // Check circuit state
        lock (circuit)
        {
            if (circuit.State == CircuitBreakerState.Open)
            {
                // Check if enough time has passed to try half-open
                if (DateTime.UtcNow - circuit.LastFailureTime >= _openDuration)
                {
                    _logger.LogInformation("Circuit for moderator {ModeratorId} transitioning to Half-Open", moderatorId);
                    circuit.State = CircuitBreakerState.HalfOpen;
                    circuit.HalfOpenStartTime = DateTime.UtcNow;
                }
                else
                {
                    var remainingTime = _openDuration - (DateTime.UtcNow - circuit.LastFailureTime);
                    _logger.LogWarning("Circuit is OPEN for moderator {ModeratorId}. Retry in {Seconds}s", 
                        moderatorId, (int)remainingTime.TotalSeconds);
                    throw new CircuitBreakerOpenException(
                        $"Circuit breaker is open for moderator {moderatorId}. Service is temporarily unavailable.",
                        remainingTime);
                }
            }
            
            if (circuit.State == CircuitBreakerState.HalfOpen)
            {
                // In half-open, check timeout
                if (DateTime.UtcNow - circuit.HalfOpenStartTime >= _halfOpenTimeout)
                {
                    _logger.LogWarning("Half-Open timeout for moderator {ModeratorId}, reopening circuit", moderatorId);
                    circuit.State = CircuitBreakerState.Open;
                    circuit.LastFailureTime = DateTime.UtcNow;
                    throw new CircuitBreakerOpenException(
                        $"Circuit breaker half-open timeout for moderator {moderatorId}",
                        _openDuration);
                }
            }
        }
        
        try
        {
            var result = await action();
            
            // Success - close circuit or confirm half-open success
            lock (circuit)
            {
                if (circuit.State == CircuitBreakerState.HalfOpen)
                {
                    _logger.LogInformation("Circuit for moderator {ModeratorId} transitioning to Closed after successful half-open test", 
                        moderatorId);
                }
                
                circuit.State = CircuitBreakerState.Closed;
                circuit.ConsecutiveFailures = 0;
                circuit.LastSuccessTime = DateTime.UtcNow;
            }
            
            return result;
        }
        catch
        {
            // Failure - increment counter and possibly open circuit
            lock (circuit)
            {
                circuit.ConsecutiveFailures++;
                circuit.LastFailureTime = DateTime.UtcNow;
                
                if (circuit.State == CircuitBreakerState.HalfOpen)
                {
                    // Failure in half-open immediately reopens
                    _logger.LogWarning("Circuit for moderator {ModeratorId} failed in Half-Open, reopening", moderatorId);
                    circuit.State = CircuitBreakerState.Open;
                }
                else if (circuit.ConsecutiveFailures >= _failureThreshold)
                {
                    _logger.LogError("Circuit for moderator {ModeratorId} OPENING after {Count} consecutive failures", 
                        moderatorId, circuit.ConsecutiveFailures);
                    circuit.State = CircuitBreakerState.Open;
                }
                else
                {
                    _logger.LogWarning("Circuit failure {Count}/{Threshold} for moderator {ModeratorId}", 
                        circuit.ConsecutiveFailures, _failureThreshold, moderatorId);
                }
            }
            
            throw;
        }
    }

    /// <summary>
    /// Get current circuit state for a moderator
    /// </summary>
    public CircuitBreakerState GetState(int moderatorId)
    {
        if (_circuits.TryGetValue(moderatorId, out var circuit))
        {
            lock (circuit)
            {
                return circuit.State;
            }
        }
        
        return CircuitBreakerState.Closed;
    }

    /// <summary>
    /// Manually reset a circuit (admin intervention)
    /// </summary>
    public void Reset(int moderatorId)
    {
        if (_circuits.TryGetValue(moderatorId, out var circuit))
        {
            lock (circuit)
            {
                _logger.LogInformation("Manually resetting circuit for moderator {ModeratorId}", moderatorId);
                circuit.State = CircuitBreakerState.Closed;
                circuit.ConsecutiveFailures = 0;
            }
        }
    }

    /// <summary>
    /// Get health status for all circuits
    /// </summary>
    public Dictionary<int, CircuitHealthStatus> GetAllCircuitStatus()
    {
        return _circuits.ToDictionary(
            kvp => kvp.Key,
            kvp =>
            {
                lock (kvp.Value)
                {
                    return new CircuitHealthStatus
                    {
                        ModeratorId = kvp.Key,
                        State = kvp.Value.State.ToString(),
                        ConsecutiveFailures = kvp.Value.ConsecutiveFailures,
                        LastFailureTime = kvp.Value.LastFailureTime,
                        LastSuccessTime = kvp.Value.LastSuccessTime
                    };
                }
            });
    }
}

/// <summary>
/// Circuit state per moderator
/// </summary>
internal class CircuitState
{
    public CircuitBreakerState State { get; set; } = CircuitBreakerState.Closed;
    public int ConsecutiveFailures { get; set; }
    public DateTime LastFailureTime { get; set; }
    public DateTime LastSuccessTime { get; set; }
    public DateTime? HalfOpenStartTime { get; set; }
}

/// <summary>
/// Circuit breaker states
/// </summary>
public enum CircuitBreakerState
{
    /// <summary>
    /// Normal operation - requests pass through
    /// </summary>
    Closed,
    
    /// <summary>
    /// Circuit is open - all requests fail immediately
    /// </summary>
    Open,
    
    /// <summary>
    /// Testing if service has recovered - single request allowed
    /// </summary>
    HalfOpen
}

/// <summary>
/// Exception thrown when circuit is open
/// </summary>
public class CircuitBreakerOpenException : Exception
{
    public TimeSpan RetryAfter { get; }
    
    public CircuitBreakerOpenException(string message, TimeSpan retryAfter) : base(message)
    {
        RetryAfter = retryAfter;
    }
}

/// <summary>
/// Health status for a circuit
/// </summary>
public class CircuitHealthStatus
{
    public int ModeratorId { get; set; }
    public string State { get; set; } = string.Empty;
    public int ConsecutiveFailures { get; set; }
    public DateTime? LastFailureTime { get; set; }
    public DateTime? LastSuccessTime { get; set; }
}
