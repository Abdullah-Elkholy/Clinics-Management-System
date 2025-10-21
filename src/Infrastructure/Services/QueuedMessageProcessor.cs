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

        public QueuedMessageProcessor(
            IUnitOfWork unitOfWork,
            IMessageSender messageSender,
            ILogger<QueuedMessageProcessor> logger)
        {
            _unitOfWork = unitOfWork ?? throw new ArgumentNullException(nameof(unitOfWork));
            _messageSender = messageSender ?? throw new ArgumentNullException(nameof(messageSender));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        /// <summary>
        /// Process queued messages and attempt to send them
        /// </summary>
        public async Task ProcessQueuedMessagesAsync(int maxBatch = 50)
        {
            try
            {
                await _unitOfWork.BeginTransactionAsync();

                var queuedMessages = await _unitOfWork.Messages
                    .FindAsync(m => m.Status == "queued")
                    .ContinueWith(t => t.Result.OrderBy(m => m.CreatedAt).Take(maxBatch).ToList());

                if (!queuedMessages.Any())
                {
                    _logger.LogInformation("No queued messages to process");
                    return;
                }

                _logger.LogInformation($"Processing {queuedMessages.Count} queued messages");

                foreach (var message in queuedMessages)
                {
                    await ProcessSingleMessageAsync(message);
                }

                await _unitOfWork.CommitAsync();
                _logger.LogInformation($"Successfully processed {queuedMessages.Count} messages");
            }
            catch (Exception ex)
            {
                _logger.LogError($"Error processing queued messages: {ex.Message}");
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

                if (success)
                {
                    message.Status = "sent";
                    message.SentAt = DateTime.UtcNow;
                    message.ProviderMessageId = providerId;
                    _logger.LogInformation($"Message {message.Id} sent successfully");
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
