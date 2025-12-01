using System.Collections.Concurrent;
using Clinics.Api.DTOs;

namespace Clinics.Api.Services;

/// <summary>
/// Service for idempotency tracking to prevent duplicate message sends
/// </summary>
public class IdempotencyService
{
    // In-memory cache for idempotency keys (correlation ID -> response)
    // In production, this should be Redis or a database table
    private readonly ConcurrentDictionary<Guid, IdempotencyRecord> _cache = new();
    
    // TTL for idempotency records (24 hours)
    private readonly TimeSpan _ttl = TimeSpan.FromHours(24);
    
    private readonly ILogger<IdempotencyService> _logger;

    public IdempotencyService(ILogger<IdempotencyService> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Check if a request with the given correlation ID has already been processed
    /// </summary>
    public bool TryGetCachedResponse(Guid correlationId, out SendMessageResponse? response)
    {
        if (_cache.TryGetValue(correlationId, out var record))
        {
            // Check if record has expired
            if (DateTime.UtcNow - record.CreatedAt < _ttl)
            {
                _logger.LogInformation("Idempotency hit for correlation ID {CorrelationId}", correlationId);
                response = record.Response;
                return true;
            }
            else
            {
                // Record expired, remove it
                _cache.TryRemove(correlationId, out _);
                _logger.LogDebug("Idempotency record expired for correlation ID {CorrelationId}", correlationId);
            }
        }
        
        response = null;
        return false;
    }

    /// <summary>
    /// Cache a response for idempotency
    /// </summary>
    public void CacheResponse(Guid correlationId, SendMessageResponse response)
    {
        var record = new IdempotencyRecord
        {
            CorrelationId = correlationId,
            Response = response,
            CreatedAt = DateTime.UtcNow
        };
        
        _cache[correlationId] = record;
        _logger.LogDebug("Cached idempotency response for correlation ID {CorrelationId}", correlationId);
    }

    /// <summary>
    /// Cleanup expired records (should be called periodically)
    /// </summary>
    public void CleanupExpiredRecords()
    {
        var expiredKeys = _cache
            .Where(kvp => DateTime.UtcNow - kvp.Value.CreatedAt >= _ttl)
            .Select(kvp => kvp.Key)
            .ToList();
        
        foreach (var key in expiredKeys)
        {
            _cache.TryRemove(key, out _);
        }
        
        if (expiredKeys.Any())
        {
            _logger.LogInformation("Cleaned up {Count} expired idempotency records", expiredKeys.Count);
        }
    }
}

/// <summary>
/// Idempotency record for caching responses
/// </summary>
public class IdempotencyRecord
{
    public Guid CorrelationId { get; set; }
    public SendMessageResponse Response { get; set; } = new();
    public DateTime CreatedAt { get; set; }
}
