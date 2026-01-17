using Hangfire;

namespace Clinics.Api.Services
{
    /// <summary>
    /// Wrapper job class for ProcessQueuedMessages with explicit concurrency control.
    /// This ensures only one instance of the processor runs at a time across all Hangfire workers/servers.
    /// 
    /// The [DisableConcurrentExecution] attribute on an interface method may not work as expected
    /// because Hangfire applies it at the concrete class level. By using this wrapper, we guarantee
    /// the attribute is applied correctly.
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
        /// Execute the message processing job with concurrency protection.
        /// 
        /// DisableConcurrentExecution: Ensures only one instance runs at a time.
        /// - If another instance is running, this one will wait up to 300 seconds (5 minutes).
        /// - If still locked after timeout, job will fail and be retried by Hangfire.
        /// 
        /// AutomaticRetry(Attempts = 0): Don't auto-retry the job itself.
        /// - The processor handles its own retry logic per-message.
        /// - If the job fails (e.g., DB connection), Hangfire will schedule it again on the next cron tick.
        /// </summary>
        [DisableConcurrentExecution(timeoutInSeconds: 300)]
        [AutomaticRetry(Attempts = 0)]
        public async Task ExecuteAsync()
        {
            var correlationId = Guid.NewGuid();
            using var scope = _logger.BeginScope(new Dictionary<string, object> { ["ProcessorRunId"] = correlationId });
            
            _logger.LogInformation("Starting message processor run {ProcessorRunId}", correlationId);
            
            try
            {
                await _processor.ProcessQueuedMessagesAsync(50);
                _logger.LogInformation("Completed message processor run {ProcessorRunId}", correlationId);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Message processor run {ProcessorRunId} failed", correlationId);
                throw; // Let Hangfire handle the failure
            }
        }
    }
}
