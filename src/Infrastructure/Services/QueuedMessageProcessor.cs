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
        private readonly IArabicErrorMessageService _errorMessageService;

        public QueuedMessageProcessor(
            IUnitOfWork unitOfWork,
            IMessageSender messageSender,
            ILogger<QueuedMessageProcessor> logger,
            Clinics.Application.Interfaces.IQuotaService quotaService,
            IArabicErrorMessageService errorMessageService)
        {
            _unitOfWork = unitOfWork ?? throw new ArgumentNullException(nameof(unitOfWork));
            _messageSender = messageSender ?? throw new ArgumentNullException(nameof(messageSender));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
            _quotaService = quotaService ?? throw new ArgumentNullException(nameof(quotaService));
            _errorMessageService = errorMessageService ?? throw new ArgumentNullException(nameof(errorMessageService));
        }

        /// <summary>
        /// Process queued messages and attempt to send them
        /// Implements 3-level hierarchical pause system:
        /// 1. WhatsAppSession.IsPaused (Global moderator pause) - Highest priority
        /// 2. MessageSession.IsPaused (Session-level pause) - Medium priority
        /// 3. Message.IsPaused (Message-level pause) - Lowest priority
        /// </summary>
        public async Task ProcessQueuedMessagesAsync(int maxBatch = 50)
        {
            List<Message>? queuedMessages = null;
            try
            {
                await _unitOfWork.BeginTransactionAsync();

                // Fetch ALL queued messages (no limit) - ordered by creation time
                queuedMessages = await _unitOfWork.Messages
                    .FindAsync(m => m.Status == "queued" && !m.IsDeleted)
                    .ContinueWith(t => t.Result.OrderBy(m => m.CreatedAt).ToList());

                if (!queuedMessages.Any())
                {
                    _logger.LogInformation("No queued messages to process");
                    return;
                }

                _logger.LogInformation($"Found {queuedMessages.Count} queued messages. Checking pause hierarchy...");

                // Apply hierarchical pause filtering
                var processableMessages = await FilterPausedMessagesAsync(queuedMessages);

                if (!processableMessages.Any())
                {
                    _logger.LogInformation($"All {queuedMessages.Count} messages are paused. Skipping processing.");
                    return;
                }

                var pausedCount = queuedMessages.Count - processableMessages.Count;
                if (pausedCount > 0)
                {
                    _logger.LogInformation($"Filtered out {pausedCount} paused messages. Processing {processableMessages.Count} messages.");
                }

                var processedCount = 0;
                foreach (var message in processableMessages)
                {
                    await ProcessSingleMessageAsync(message);
                    processedCount++;
                }

                await _unitOfWork.CommitAsync();
                _logger.LogInformation($"Successfully processed {processableMessages.Count} messages");
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
        /// Filters messages based on 3-level hierarchical pause system.
        /// Priority: WhatsAppSession.IsPaused > MessageSession.IsPaused > Message.IsPaused
        /// Returns only messages that are NOT paused at any level.
        /// </summary>
        private async Task<List<Message>> FilterPausedMessagesAsync(List<Message> messages)
        {
            // Get unique moderator IDs
            var moderatorIds = messages
                .Where(m => m.ModeratorId.HasValue)
                .Select(m => m.ModeratorId!.Value)
                .Distinct()
                .ToList();

            // Fetch all WhatsAppSessions for these moderators (Priority 1 check)
            var whatsappSessions = new Dictionary<int, bool>();
            if (moderatorIds.Any())
            {
                var sessions = await _unitOfWork.WhatsAppSessions
                    .FindAsync(ws => moderatorIds.Contains(ws.ModeratorUserId));
                
                whatsappSessions = sessions.ToDictionary(
                    ws => ws.ModeratorUserId,
                    ws => ws.IsPaused
                );
            }

            // Get unique session IDs
            var sessionIds = messages
                .Where(m => !string.IsNullOrEmpty(m.SessionId))
                .Select(m => Guid.Parse(m.SessionId!))
                .Distinct()
                .ToList();

            // Fetch all MessageSessions (Priority 2 check)
            var messageSessions = new Dictionary<Guid, bool>();
            if (sessionIds.Any())
            {
                var sessions = await _unitOfWork.MessageSessions
                    .FindAsync(s => sessionIds.Contains(s.Id));
                
                messageSessions = sessions.ToDictionary(
                    s => s.Id,
                    s => s.IsPaused
                );
            }

            // Filter messages based on pause hierarchy
            var processableMessages = messages.Where(m =>
            {
                // Priority 1: Check global moderator pause (WhatsAppSession)
                if (m.ModeratorId.HasValue && whatsappSessions.TryGetValue(m.ModeratorId.Value, out var isModeratorPaused))
                {
                    if (isModeratorPaused)
                    {
                        _logger.LogDebug($"Message {m.Id} skipped: Global moderator pause (ModeratorId: {m.ModeratorId})");
                        return false;
                    }
                }

                // Priority 2: Check session-level pause (MessageSession)
                if (!string.IsNullOrEmpty(m.SessionId) && Guid.TryParse(m.SessionId, out var sessionGuid))
                {
                    if (messageSessions.TryGetValue(sessionGuid, out var isSessionPaused) && isSessionPaused)
                    {
                        _logger.LogDebug($"Message {m.Id} skipped: Session-level pause (SessionId: {m.SessionId})");
                        return false;
                    }
                }

                // Priority 3: Check message-level pause
                if (m.IsPaused)
                {
                    _logger.LogDebug($"Message {m.Id} skipped: Message-level pause (PauseReason: {m.PauseReason})");
                    return false;
                }

                return true; // Not paused at any level
            }).ToList();

            return processableMessages;
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
                // UNRESUMABLE: PendingQR pause can only be resumed when WhatsApp connection state = "connected"
                if (providerResponse != null && providerResponse.Contains("PendingQR", StringComparison.OrdinalIgnoreCase))
                {
                    _logger.LogWarning($"WhatsApp authentication required (PendingQR detected). Pausing all message sending operations.");
                    message.Status = "queued"; // Reset to queued so it will be retried after auth
                    message.Attempts -= 1; // Don't count this as a failed attempt
                    message.IsPaused = true;
                    message.PausedAt = DateTime.UtcNow;
                    message.PausedBy = message.SenderUserId;
                    message.PauseReason = "PendingQR - Authentication required";
                    await _unitOfWork.Messages.UpdateAsync(message);
                    
                    // Set global moderator pause if moderatorId exists
                    if (message.ModeratorId.HasValue)
                    {
                        var whatsappSession = await _unitOfWork.WhatsAppSessions
                            .FindAsync(ws => ws.ModeratorUserId == message.ModeratorId.Value)
                            .ContinueWith(t => t.Result.FirstOrDefault());
                        
                        if (whatsappSession != null)
                        {
                            whatsappSession.IsPaused = true;
                            whatsappSession.PausedAt = DateTime.UtcNow;
                            whatsappSession.PausedBy = message.SenderUserId;
                            whatsappSession.PauseReason = "PendingQR - Authentication required";
                            whatsappSession.Status = "pending";
                            await _unitOfWork.WhatsAppSessions.UpdateAsync(whatsappSession);
                        }
                    }
                    
                    // Throw exception to trigger transaction rollback and stop processing batch
                    throw new InvalidOperationException("WhatsApp session requires authentication. All tasks including this one have been paused.");
                }

                // Check for PendingNET response - pause all operations if network failure
                // RESUMABLE: PendingNET pause can be manually resumed from OngoingTasksPanel
                if (providerResponse != null && (providerResponse.Contains("PendingNET", StringComparison.OrdinalIgnoreCase) || 
                    providerResponse.Contains("Internet connection unavailable", StringComparison.OrdinalIgnoreCase) ||
                    providerResponse.Contains("ERR_INTERNET_DISCONNECTED", StringComparison.OrdinalIgnoreCase)))
                {
                    _logger.LogWarning($"Network failure detected (PendingNET). Pausing all message sending operations.");
                    message.Status = "queued"; // Keep as queued so it will be retried after network restored
                    message.Attempts -= 1; // Don't count this as a failed attempt
                    message.IsPaused = true;
                    message.PausedAt = DateTime.UtcNow;
                    message.PausedBy = message.SenderUserId;
                    message.PauseReason = "PendingNET - Network failure";
                    await _unitOfWork.Messages.UpdateAsync(message);
                    
                    // Set global moderator pause
                    if (message.ModeratorId.HasValue)
                    {
                        var whatsappSession = await _unitOfWork.WhatsAppSessions
                            .FindAsync(ws => ws.ModeratorUserId == message.ModeratorId.Value)
                            .ContinueWith(t => t.Result.FirstOrDefault());
                        
                        if (whatsappSession != null)
                        {
                            whatsappSession.IsPaused = true;
                            whatsappSession.PausedAt = DateTime.UtcNow;
                            whatsappSession.PausedBy = message.SenderUserId;
                            whatsappSession.PauseReason = "PendingNET - Network failure";
                            await _unitOfWork.WhatsAppSessions.UpdateAsync(whatsappSession);
                        }
                    }
                    
                    throw new InvalidOperationException("Network failure detected. All tasks including this one have been paused.");
                }

                if (success)
                {
                    message.Status = "sent";
                    message.SentAt = DateTime.UtcNow;
                    message.ErrorMessage = null; // ✅ Clear error message on success
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
                    message.ErrorMessage = _errorMessageService.TranslateProviderError(providerResponse);
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
                // If browser was closed, pause current task and set global pause
                // RESUMABLE: BrowserClosure pause can be manually resumed from OngoingTasksPanel
                if (IsBrowserClosedException(ex))
                {
                    _logger.LogWarning($"Browser closed intentionally. Pausing message {message.Id} and all moderator tasks.");
                    message.Status = "queued"; // Keep as queued
                    message.Attempts -= 1; // Don't count this as a failed attempt
                    message.IsPaused = true;
                    message.PausedAt = DateTime.UtcNow;
                    message.PausedBy = message.SenderUserId;
                    message.PauseReason = "BrowserClosure - Browser closed intentionally";
                    await _unitOfWork.Messages.UpdateAsync(message);
                    
                    // Set global moderator pause
                    if (message.ModeratorId.HasValue)
                    {
                        var whatsappSession = await _unitOfWork.WhatsAppSessions
                            .FindAsync(ws => ws.ModeratorUserId == message.ModeratorId.Value)
                            .ContinueWith(t => t.Result.FirstOrDefault());
                        
                        if (whatsappSession != null)
                        {
                            whatsappSession.IsPaused = true;
                            whatsappSession.PausedAt = DateTime.UtcNow;
                            whatsappSession.PausedBy = message.SenderUserId;
                            whatsappSession.PauseReason = "BrowserClosure - Browser closed intentionally";
                            await _unitOfWork.WhatsAppSessions.UpdateAsync(whatsappSession);
                        }
                    }
                    
                    throw new InvalidOperationException("Browser was closed. All tasks including this one have been paused.");
                }
                
                // If PendingQR exception, re-throw to trigger transaction rollback and stop processing
                if (ex.Message.Contains("WhatsApp session requires authentication", StringComparison.OrdinalIgnoreCase))
                {
                    throw; // Stop processing batch, message already in "queued" status, will be rolled back by transaction
                }
                
                // If PendingNET exception, re-throw to trigger transaction rollback
                if (ex.Message.Contains("Network failure detected", StringComparison.OrdinalIgnoreCase))
                {
                    throw; // Stop processing batch, message already in "queued" status
                }
                
                // For other exceptions, mark as failed
                message.Status = "failed";
                message.ErrorMessage = _errorMessageService.TranslateException(ex);
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

        /// <summary>
        /// Helper method to detect browser closed exceptions
        /// </summary>
        private bool IsBrowserClosedException(Exception ex)
        {
            if (ex == null) return false;
            
            var message = ex.Message?.ToLowerInvariant() ?? string.Empty;
            return message.Contains("target page, context or browser has been closed") ||
                   message.Contains("browser has been disconnected") ||
                   message.Contains("session closed") ||
                   message.Contains("browser closed");
        }
    }
}
