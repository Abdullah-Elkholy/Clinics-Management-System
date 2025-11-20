using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Clinics.Application.Interfaces;
using Clinics.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Clinics.Infrastructure.Services
{
    /// <summary>
    /// Message Processor Implementation
    /// Single Responsibility: Process queued messages and handle retries
    /// Depends on abstractions: IUnitOfWork, IMessageSender, ILogger
    /// </summary>
    public class QueuedMessageProcessor : IMessageProcessor
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IMessageSender _messageSender;
        private readonly ILogger<QueuedMessageProcessor> _logger;
        private readonly Clinics.Application.Interfaces.IQuotaService _quotaService;

        public QueuedMessageProcessor(
            IUnitOfWork unitOfWork,
            IMessageSender messageSender,
            ILogger<QueuedMessageProcessor> logger,
            Clinics.Application.Interfaces.IQuotaService quotaService)
        {
            _unitOfWork = unitOfWork ?? throw new ArgumentNullException(nameof(unitOfWork));
            _messageSender = messageSender ?? throw new ArgumentNullException(nameof(messageSender));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _quotaService = quotaService ?? throw new ArgumentNullException(nameof(quotaService));
        }

        /// <summary>
        /// Process queued messages and attempt to send them
        /// NOTE: No batch limit - processes ALL queued messages in a single run
        /// </summary>
        public async Task ProcessQueuedMessagesAsync(int maxBatch = 50)
        {
            List<Message>? queuedMessages = null;
            try
            {
                await _unitOfWork.BeginTransactionAsync();

                // Fetch ALL queued messages (no limit) - ordered by creation time
                queuedMessages = await _unitOfWork.Messages
                    .FindAsync(m => m.Status == "queued")
                    .ContinueWith(t => t.Result.OrderBy(m => m.CreatedAt).ToList());

                if (!queuedMessages.Any())
                {
                    _logger.LogInformation("No queued messages to process");
                    return;
                }

                _logger.LogInformation($"Processing {queuedMessages.Count} queued messages");

                var processedCount = 0;
                foreach (var message in queuedMessages)
                {
                    await ProcessSingleMessageAsync(message);
                    processedCount++;
                }

                await _unitOfWork.CommitAsync();
                _logger.LogInformation($"Successfully processed {queuedMessages.Count} messages");
            }
            catch (Exception ex)
            {
                var isPendingQR = ex.Message.Contains("WhatsApp session requires authentication", StringComparison.OrdinalIgnoreCase);
                if (isPendingQR)
                {
                    _logger.LogWarning($"[PendingQR] Transaction rollback initiated. All {queuedMessages?.Count ?? 0} messages will be reset to 'queued' status and paused for retry after authentication.");
                }
                else
                {
                    _logger.LogError($"Error processing queued messages: {ex.Message}");
                }
                await _unitOfWork.RollbackAsync();
                throw;
            }
        }

        /// <summary>
        /// Retry failed messages with exponential backoff
        /// </summary>
        public async Task RetryFailedMessagesAsync(int maxBatch = 50)
        {
            try
            {
                await _unitOfWork.BeginTransactionAsync();

                var failedMessages = await _unitOfWork.Messages
                    .FindAsync(m => m.Status == "failed" && m.Attempts < 3)
                    .ContinueWith(t => t.Result
                        .OrderBy(m => m.LastAttemptAt)
                        .Take(maxBatch)
                        .ToList());

                if (!failedMessages.Any())
                {
                    _logger.LogInformation("No failed messages to retry");
                    return;
                }

                _logger.LogInformation($"Retrying {failedMessages.Count} failed messages");

                foreach (var message in failedMessages)
                {
                    message.Status = "queued";
                    await _unitOfWork.Messages.UpdateAsync(message);
                    _logger.LogInformation($"Queued message {message.Id} for retry (attempt {message.Attempts + 1})");
                }

                await _unitOfWork.CommitAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error retrying failed messages: {ex.Message}");
                await _unitOfWork.RollbackAsync();
                throw;
            }
        }

        private async Task ProcessSingleMessageAsync(Message message)
        {
            try
            {
                message.Status = "sending";
                message.Attempts += 1;
                message.LastAttemptAt = DateTime.UtcNow;
                await _unitOfWork.Messages.UpdateAsync(message);

                var (success, providerId, providerResponse) = await _messageSender.SendAsync(message);

                // Check for PendingQR response - pause all operations if authentication required
                if (providerResponse != null && providerResponse.Contains("PendingQR", StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogWarning($"WhatsApp authentication required (PendingQR detected). Pausing all message sending operations.");
                    message.Status = "queued"; // Reset to queued so it will be retried after auth
                    message.Attempts -= 1; // Don't count this as a failed attempt
                    await _unitOfWork.Messages.UpdateAsync(message);
                    
                    // Throw exception to trigger transaction rollback and stop processing batch
                    throw new InvalidOperationException("WhatsApp session requires authentication. Please authenticate and try again.");
                }

                if (success)
                {
                    message.Status = "sent";
                    message.SentAt = DateTime.UtcNow;
                    message.ProviderMessageId = providerId;
                    _logger.LogInformation($"Message {message.Id} sent successfully");
                    
                    // Consume quota on successful send (moved from queueing phase for fair billing)
                    if (message.SenderUserId.HasValue)
                    {
                        var quotaConsumed = await _quotaService.ConsumeMessageQuotaAsync(message.SenderUserId.Value, 1);
                        if (quotaConsumed)
                        {
                            _logger.LogInformation($"Message {message.Id} sent - quota consumed for user {message.SenderUserId}");
                        }
                        else
                        {
                            _logger.LogWarning($"Message {message.Id} sent but quota consumption failed for user {message.SenderUserId}");
                        }
                    }
                }
                else
                {
                    message.Status = "failed";
                    var failedTask = new FailedTask
                    {
                        MessageId = message.Id,
                        PatientId = message.PatientId,
                        QueueId = message.QueueId,
                        Reason = "provider_failure",
                        ProviderResponse = providerResponse,
                        CreatedAt = DateTime.UtcNow,
                        RetryCount = 0
                    };
                    await _unitOfWork.FailedTasks.AddAsync(failedTask);
                    _logger.LogWarning($"Message {message.Id} failed: {providerResponse}");
                }

                await _unitOfWork.Messages.UpdateAsync(message);
            }
            catch (Exception ex)
            {
                // If PendingQR exception, re-throw to trigger transaction rollback and stop processing
                if (ex.Message.Contains("WhatsApp session requires authentication", StringComparison.OrdinalIgnoreCase))
                {
                    throw; // Stop processing batch, message already in "queued" status, will be rolled back by transaction
                }
                
                // For other exceptions, mark as failed
                message.Status = "failed";
                var failedTask = new FailedTask
                {
                    MessageId = message.Id,
                    PatientId = message.PatientId,
                    QueueId = message.QueueId,
                    Reason = "exception",
                    ProviderResponse = ex.Message,
                    CreatedAt = DateTime.UtcNow,
                    RetryCount = message.Attempts
                };
                await _unitOfWork.FailedTasks.AddAsync(failedTask);
                await _unitOfWork.Messages.UpdateAsync(message);
                _logger.LogError($"Exception processing message {message.Id}: {ex.Message}");
            }
        }
    }
}
