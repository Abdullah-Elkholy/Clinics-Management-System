using Hangfire;
using Hangfire.Storage;

namespace Clinics.Api.Services
{
    /// <summary>
    /// Wrapper job class for ProcessQueuedMessages with explicit concurrency control.
    /// This ensures only one instance of the processor runs at a time across all Hangfire workers/servers.
    /// 
    /// Supports two modes:
    /// 1. ExecuteAsync() - GLOBAL: Process all messages with global lock (legacy/safety net)
    /// 2. ExecuteForModeratorAsync(modId) - PER-MODERATOR: Process with per-moderator lock (parallel)
    /// </summary>
    public class ProcessQueuedMessagesJob
    {
        private readonly IMessageProcessor _processor;
        private readonly ILogger<ProcessQueuedMessagesJob> _logger;

        public ProcessQueuedMessagesJob(IMessageProcessor processor, ILogger<ProcessQueuedMessagesJob> logger)
        {
            _processor = processor;
            _logger = logger;
        }

        /// <summary>
        /// GLOBAL: Execute the message processing job with global concurrency protection.
        /// Still needed for:
        /// - ExpireTimedOutCommandsAsync (global cleanup)
        /// - Messages without ModeratorId (edge case)
        /// Frequency reduced from 15s to 60s.
        /// </summary>
        [DisableConcurrentExecution(timeoutInSeconds: 300)]
        [AutomaticRetry(Attempts = 0)]
        public async Task ExecuteAsync()
        {
            var correlationId = Guid.NewGuid();
            using var scope = _logger.BeginScope(new Dictionary<string, object> { ["ProcessorRunId"] = correlationId });
            
            _logger.LogDebug("Starting GLOBAL message processor run {ProcessorRunId}", correlationId);
            
            try
            {
                await _processor.ProcessQueuedMessagesAsync(50);
                _logger.LogDebug("Completed GLOBAL message processor run {ProcessorRunId}", correlationId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "GLOBAL message processor run {ProcessorRunId} failed", correlationId);
                throw;
            }
        }

        /// <summary>
        /// PER-MODERATOR: Process messages for a specific moderator with per-moderator lock.
        /// This enables parallel processing across different moderators.
        /// 
        /// Lock timeout: 600s (10 min) calculated as:
        /// - 50 messages max × 7s max rate limit delay = 350s
        /// - Plus processing overhead = 250s buffer
        /// 
        /// NOTE: Cannot use [DisableConcurrentExecution] attribute with dynamic resource key.
        /// Uses JobStorage.Current.GetConnection().AcquireDistributedLock() instead.
        /// </summary>
        [AutomaticRetry(Attempts = 0)]
        public async Task ExecuteForModeratorAsync(int moderatorId)
        {
            var correlationId = Guid.NewGuid();
            using var logScope = _logger.BeginScope(new Dictionary<string, object> 
            { 
                ["ProcessorRunId"] = correlationId,
                ["ModeratorId"] = moderatorId
            });

            var lockKey = $"process-mod-{moderatorId}";
            var lockTimeout = TimeSpan.FromSeconds(600);

            IDisposable? distributedLock = null;
            try
            {
                // Acquire per-moderator distributed lock via Hangfire storage
                using var connection = JobStorage.Current.GetConnection();
                
                try
                {
                    distributedLock = connection.AcquireDistributedLock(lockKey, lockTimeout);
                }
                catch (DistributedLockTimeoutException)
                {
                    // Another job is already processing this moderator - normal behavior
                    _logger.LogDebug(
                        "Lock {LockKey} already held, skipping run {ProcessorRunId} for moderator {ModeratorId}", 
                        lockKey, correlationId, moderatorId);
                    return;
                }

                _logger.LogDebug(
                    "Acquired lock {LockKey}, starting per-moderator processor run {ProcessorRunId}", 
                    lockKey, correlationId);

                await _processor.ProcessQueuedMessagesForModeratorAsync(moderatorId, 50);

                _logger.LogDebug(
                    "Completed per-moderator processor run {ProcessorRunId} for moderator {ModeratorId}", 
                    correlationId, moderatorId);
            }
            catch (Exception ex) when (ex is not DistributedLockTimeoutException)
            {
                _logger.LogError(ex, 
                    "Per-moderator processor run {ProcessorRunId} for moderator {ModeratorId} failed", 
                    correlationId, moderatorId);
                throw;
            }
            finally
            {
                distributedLock?.Dispose();
            }
        }
    }
}
