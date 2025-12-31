using System;
using System.Linq;
using System.Threading.Tasks;
using Clinics.Infrastructure;
using Clinics.Domain;
using Microsoft.EntityFrameworkCore;
using Clinics.Api.Controllers;
using Microsoft.AspNetCore.SignalR;
using Clinics.Api.Hubs;
using Clinics.Api.Services.Extension;

namespace Clinics.Api.Services
{
    public interface IMessageProcessor
    {
        Task ProcessQueuedMessagesAsync(int maxBatch = 50);
    }

    public class MessageProcessor : IMessageProcessor
    {
        private readonly ApplicationDbContext _db;
        private readonly IWhatsAppProviderFactory _providerFactory;
        private readonly IMessageSender _legacySender; // Fallback for when no moderator
        private readonly Clinics.Application.Interfaces.IQuotaService _quotaService;
        private readonly CircuitBreakerService _circuitBreaker;
        private readonly ILogger<MessageProcessor> _logger;
        private readonly IHubContext<DataUpdateHub> _hubContext;

        public MessageProcessor(
            ApplicationDbContext db, 
            IWhatsAppProviderFactory providerFactory,
            IMessageSender legacySender, 
            Clinics.Application.Interfaces.IQuotaService quotaService,
            CircuitBreakerService circuitBreaker,
            ILogger<MessageProcessor> logger,
            IHubContext<DataUpdateHub> hubContext)
        {
            _db = db;
            _providerFactory = providerFactory;
            _legacySender = legacySender;
            _quotaService = quotaService;
            _circuitBreaker = circuitBreaker;
            _logger = logger;
            _hubContext = hubContext;
        }

        public async Task ProcessQueuedMessagesAsync(int maxBatch = 50)
        {
            // Priority order:
            // 1. PendingQR pause rejection (highest priority) - already filtered out by !m.IsPaused
            // 2. Manual pause - already filtered out by !m.IsPaused
            // 3. Session StartTime (earliest first)
            //    - Messages ordered by their MessageSession.StartTime (earliest first)
            //    - Within a session, messages ordered by Message.CreatedAt
            
            // PERFORMANCE OPTIMIZATION: Use SQL-level ordering via join instead of in-memory ordering
            // This prevents loading 2x messages into memory just for ordering
            var msgs = await (
                from m in _db.Messages
                join s in _db.MessageSessions on m.SessionId equals s.Id.ToString()
                where m.Status == "queued" 
                    && !m.IsPaused 
                    && !string.IsNullOrEmpty(m.SessionId)
                    && !s.IsDeleted
                orderby s.StartTime, m.CreatedAt
                select m
            )
            .Include(m => m.Queue)
            .AsNoTracking()
            .Take(maxBatch) // Only take exactly what we need
            .ToListAsync();

            var totalMessages = msgs.Count;
            var processedCount = 0;
            var errorCount = 0;
            
            foreach (var m in msgs)
            {
                try
                {
                    // Double-check pause state (may have been paused while processing)
                    if (m.IsPaused)
                    {
                        continue; // Skip paused messages
                    }
                    
                    // Check circuit breaker state before attempting send
                    if (m.ModeratorId.HasValue)
                    {
                        var circuitState = _circuitBreaker.GetState(m.ModeratorId.Value);
                        if (circuitState == CircuitBreakerState.Open)
                        {
                            _logger.LogWarning("Skipping message {MessageId} - circuit is OPEN for moderator {ModeratorId}", 
                                m.Id, m.ModeratorId.Value);
                            continue; // Skip this message, circuit is open
                        }
                    }

                    m.Status = "sending";
                    m.Attempts += 1;
                    m.LastAttemptAt = DateTime.UtcNow;
                    await _db.SaveChangesAsync();

                    // Execute send through circuit breaker using the appropriate provider
                    (bool success, string? providerId, string? providerResponse) result;
                    try
                    {
                        if (m.ModeratorId.HasValue)
                        {
                            result = await _circuitBreaker.ExecuteAsync(m.ModeratorId.Value, async () => 
                            {
                                // Get the appropriate provider (Extension or Playwright fallback)
                                var (provider, providerName) = await _providerFactory.GetProviderAsync(m.ModeratorId.Value);
                                _logger.LogDebug("Using {ProviderName} provider for message {MessageId}", providerName, m.Id);
                                
                                // Send via the selected provider
                                var sendResult = await provider.SendMessageAsync(m);
                                
                                // Convert WhatsAppSendResult to legacy tuple format for compatibility
                                return (sendResult.Success, providerName, sendResult.ProviderResponse ?? sendResult.ErrorMessage);
                            });
                        }
                        else
                        {
                            // No moderator ID - use legacy sender as fallback
                            result = await _legacySender.SendAsync(m);
                        }
                    }
                    catch (CircuitBreakerOpenException cbEx)
                    {
                        _logger.LogWarning("Circuit breaker open for moderator {ModeratorId}: {Message}", 
                            m.ModeratorId, cbEx.Message);
                        
                        // Pause this message until circuit recovers
                        m.Status = "queued";
                        m.IsPaused = true;
                        m.PausedAt = DateTime.UtcNow;
                        m.PauseReason = "CircuitBreakerOpen";
                        m.ErrorMessage = $"Circuit breaker open. Retry after {cbEx.RetryAfter.TotalSeconds:F0}s";
                        m.Attempts -= 1; // Don't count circuit breaker trips as attempts
                        await _db.SaveChangesAsync();
                        continue;
                    }
                    
                    // Check for PendingQR response - automatically pause ALL messages for this moderator
                    if (result.providerResponse != null && result.providerResponse.Contains("PendingQR", StringComparison.OrdinalIgnoreCase))
                    {
                        // Pause this message (not failed, just paused)
                        m.Status = "queued";
                        m.IsPaused = true;
                        m.PausedAt = DateTime.UtcNow;
                        m.PauseReason = "PendingQR";
                        m.Attempts -= 1; // Don't count this as a failed attempt
                        await _db.SaveChangesAsync();

                        // Pause ALL queued messages for this moderator (unified WhatsApp session per moderator)
                        if (m.ModeratorId.HasValue)
                        {
                            var moderatorId = m.ModeratorId.Value;
                            var allQueuedMessages = await _db.Messages
                                .Where(msg => msg.ModeratorId == moderatorId 
                                    && msg.Status == "queued" 
                                    && !msg.IsPaused
                                    && msg.Id != m.Id) // Exclude the current message (already paused)
                                .ToListAsync();

                            foreach (var msg in allQueuedMessages)
                            {
                                msg.IsPaused = true;
                                msg.PausedAt = DateTime.UtcNow;
                                msg.PauseReason = "PendingQR";
                            }

                            if (allQueuedMessages.Any())
                            {
                                await _db.SaveChangesAsync();
                            }

                            // Also pause any active sessions for this moderator
                            var activeSessions = await _db.MessageSessions
                                .Where(s => s.ModeratorId == moderatorId && s.Status == "active" && !s.IsPaused)
                                .ToListAsync();

                            foreach (var session in activeSessions)
                            {
                                session.IsPaused = true;
                                session.Status = "paused";
                                session.PausedAt = DateTime.UtcNow;
                                session.PauseReason = "PendingQR";
                                session.LastUpdated = DateTime.UtcNow;
                            }

                            if (activeSessions.Any())
                            {
                                await _db.SaveChangesAsync();
                            }
                        }

                        throw new InvalidOperationException("WhatsApp session requires authentication. All messages for this moderator have been paused. Please authenticate and resume.");
                    }
                    
                    if (result.success)
                    {
                        m.Status = "sent";
                        m.SentAt = DateTime.UtcNow;
                        m.ProviderMessageId = result.providerId;
                        
                        // CRITICAL: Save immediately to ensure this success is persisted
                        // even if the next message in the batch throws an exception
                        await _db.SaveChangesAsync();
                        
                        // Update MessageSession if this message is part of a session
                        if (!string.IsNullOrEmpty(m.SessionId) && Guid.TryParse(m.SessionId, out var sessionGuid))
                        {
                            var session = await _db.MessageSessions.FindAsync(sessionGuid);
                            if (session != null)
                            {
                                session.SentMessages++;
                                session.LastUpdated = DateTime.UtcNow;
                                
                                // Mark session as completed if all messages are sent
                                if (session.SentMessages >= session.TotalMessages)
                                {
                                    session.Status = "completed";
                                    session.EndTime = DateTime.UtcNow;
                                }
                                
                                await _db.SaveChangesAsync();
                                
                                // Notify via SignalR for real-time UI updates
                                await NotifySessionUpdate(session, "updated");
                            }
                        }
                        
                        // Notify via SignalR for real-time UI updates
                        await NotifyMessageUpdate(m, "sent");
                        
                        // Consume quota on successful send (moved from queueing phase for fair billing)
                        if (m.SenderUserId.HasValue)
                        {
                            await _quotaService.ConsumeMessageQuotaAsync(m.SenderUserId.Value, 1);
                        }
                    }
                    else
                    {
                        // Failure - check if we should retry with backoff or mark as failed
                        const int maxRetryAttempts = 3;
                        
                        if (m.Attempts < maxRetryAttempts)
                        {
                            // Calculate exponential backoff delay
                            var delayMs = ExponentialBackoff.CalculateDelayMs(m.Attempts, baseDelaySeconds: 1, maxDelaySeconds: 30);
                            var delayDesc = ExponentialBackoff.GetDelayDescription(m.Attempts);
                            
                            _logger.LogWarning("Message {MessageId} failed (attempt {Attempt}/{Max}). Retrying with backoff: {Delay}", 
                                m.Id, m.Attempts, maxRetryAttempts, delayDesc);
                            
                            // Re-queue with backoff delay
                            m.Status = "queued";
                            m.IsPaused = true; // Temporarily pause for backoff
                            m.PausedAt = DateTime.UtcNow;
                            m.PauseReason = $"ExponentialBackoff_{delayDesc}";
                            m.ErrorMessage = $"Attempt {m.Attempts}/{maxRetryAttempts} failed: {result.providerResponse}. Retrying in {delayDesc}";
                            
                            await _db.SaveChangesAsync();
                            
                            // Schedule resume after backoff (background task)
                            _ = Task.Run(async () =>
                            {
                                await Task.Delay(delayMs);
                                
                                // Resume message after backoff
                                using var scope = _db.Database.BeginTransaction();
                                try
                                {
                                    var msgToResume = await _db.Messages.FindAsync(m.Id);
                                    if (msgToResume != null && msgToResume.IsPaused && msgToResume.PauseReason?.StartsWith("ExponentialBackoff") == true)
                                    {
                                        msgToResume.IsPaused = false;
                                        msgToResume.PauseReason = null;
                                        msgToResume.PausedAt = null;
                                        await _db.SaveChangesAsync();
                                        await scope.CommitAsync();
                                        
                                        _logger.LogInformation("Message {MessageId} resumed after backoff delay", m.Id);
                                    }
                                }
                                catch (Exception ex)
                                {
                                    _logger.LogError(ex, "Error resuming message {MessageId} after backoff", m.Id);
                                    await scope.RollbackAsync();
                                }
                            });
                        }
                        else
                        {
                            // Max attempts reached - mark as permanently failed
                            _logger.LogError("Message {MessageId} permanently failed after {Attempts} attempts", m.Id, m.Attempts);
                            
                            m.Status = "failed";
                            m.ErrorMessage = result.providerResponse ?? "Provider returned failure";
                            
                            // Create failed task
                            var ft = new FailedTask 
                            { 
                                MessageId = m.Id, 
                                PatientId = m.PatientId, 
                                QueueId = m.QueueId, 
                                Reason = "provider_failure", 
                                ProviderResponse = result.providerResponse, 
                                CreatedAt = DateTime.UtcNow, 
                                RetryCount = 0 
                            };
                            _db.FailedTasks.Add(ft);
                            
                            // Update session failed count
                            if (!string.IsNullOrEmpty(m.SessionId) && Guid.TryParse(m.SessionId, out var sessionGuid))
                            {
                                var session = await _db.MessageSessions.FindAsync(sessionGuid);
                                if (session != null)
                                {
                                    session.FailedMessages++;
                                    session.LastUpdated = DateTime.UtcNow;
                                    
                                    await _db.SaveChangesAsync();
                                    
                                    // Notify via SignalR
                                    await NotifySessionUpdate(session, "updated");
                                }
                            }
                            
                            await _db.SaveChangesAsync();
                            
                            // Notify via SignalR for real-time UI updates
                            await NotifyMessageUpdate(m, "failed");
                        }
                    }
                    await _db.SaveChangesAsync();
                    processedCount++;
                }
                catch (InvalidOperationException ex) when (
                    ex.Message.StartsWith("PendingQR:", StringComparison.OrdinalIgnoreCase) ||
                    ex.Message.StartsWith("PendingNET:", StringComparison.OrdinalIgnoreCase) ||
                    ex.Message.StartsWith("BrowserClosure:", StringComparison.OrdinalIgnoreCase))
                {
                    // Global pause handling for connection/browser issues
                    // IMPORTANT:
                    // - PendingQR: UNRESUMABLE global pause (only resumable when WhatsApp connection state = "connected")
                    // - PendingNET: RESUMABLE global pause (can be manually resumed from OngoingTasksPanel)
                    // - BrowserClosure: RESUMABLE global pause (can be manually resumed from OngoingTasksPanel)
                    string pauseReason;
                    string errorType;
                    
                    if (ex.Message.StartsWith("PendingQR:", StringComparison.OrdinalIgnoreCase))
                    {
                        pauseReason = "PendingQR - Authentication required";
                        errorType = "PendingQR";
                    }
                    else if (ex.Message.StartsWith("PendingNET:", StringComparison.OrdinalIgnoreCase))
                    {
                        pauseReason = "PendingNET - Network failure";
                        errorType = "PendingNET";
                    }
                    else // BrowserClosure
                    {
                        pauseReason = "BrowserClosure - Browser session terminated";
                        errorType = "BrowserClosure";
                    }
                    
                    // Pause this message (not failed, just paused)
                    m.Status = "queued";
                    m.IsPaused = true;
                    m.PausedAt = DateTime.UtcNow;
                    m.PauseReason = errorType;
                    m.Attempts -= 1; // Don't count this as a failed attempt
                    m.ErrorMessage = ex.Message; // Store error message for user visibility
                    await _db.SaveChangesAsync();
                    
                    // Pause global WhatsAppSession for this moderator (3-tier hierarchy: top level)
                    if (m.ModeratorId.HasValue)
                    {
                        var moderatorId = m.ModeratorId.Value;
                        var whatsappSession = await _db.WhatsAppSessions
                            .FirstOrDefaultAsync(ws => ws.ModeratorUserId == moderatorId && !ws.IsDeleted);
                        
                        if (whatsappSession == null)
                        {
                            // Create new WhatsAppSession if doesn't exist
                            whatsappSession = new WhatsAppSession
                            {
                                ModeratorUserId = moderatorId,
                                Status = "connected",
                                CreatedAt = DateTime.UtcNow,
                                IsPaused = false
                            };
                            _db.WhatsAppSessions.Add(whatsappSession);
                        }
                        
                        // Set global pause - this will affect ALL messages/sessions for this moderator
                        whatsappSession.IsPaused = true;
                        whatsappSession.PausedAt = DateTime.UtcNow;
                        whatsappSession.PausedBy = m.SenderUserId;
                        whatsappSession.PauseReason = pauseReason;
                        whatsappSession.UpdatedAt = DateTime.UtcNow;
                        whatsappSession.UpdatedBy = m.SenderUserId;
                        
                        await _db.SaveChangesAsync();
                        
                        var remainingCount = totalMessages - processedCount;
                        Console.WriteLine($"[{errorType}] Global pause set for moderator {moderatorId}. Processed: {processedCount}/{totalMessages}, Remaining will be paused by QueuedMessageProcessor.");
                    }
                    
                    // Stop processing batch - global pause is set, QueuedMessageProcessor will handle remaining messages
                    throw;
                }
                catch (Exception ex)
                {
                    // If old PendingQR exception format (for backwards compatibility)
                    if (ex.Message.Contains("WhatsApp session requires authentication", StringComparison.OrdinalIgnoreCase))
                    {
                        var remainingCount = totalMessages - processedCount;
                        Console.WriteLine($"[PendingQR] Stopping batch processing. Processed: {processedCount}/{totalMessages}, Remaining paused: {remainingCount}");
                        throw; // Stop processing batch, message already in "queued" status
                    }
                    
                    // For other exceptions, log and mark failed
                    errorCount++;
                    m.Status = "failed";
                    m.ErrorMessage = ex.Message;
                    _db.FailedTasks.Add(new FailedTask { MessageId = m.Id, PatientId = m.PatientId, QueueId = m.QueueId, Reason = "exception", ProviderResponse = ex.Message, CreatedAt = DateTime.UtcNow, RetryCount = m.Attempts });
                    await _db.SaveChangesAsync();
                }
            }
            
            // Update health metrics
            HealthController.UpdateProcessorState(processedCount, errorCount);
        }

        #region SignalR Notification Helpers

        /// <summary>
        /// Notify clients about message status change via SignalR
        /// </summary>
        private async Task NotifyMessageUpdate(Message message, string eventType = "updated")
        {
            if (!message.ModeratorId.HasValue) return;

            try
            {
                var payload = new
                {
                    id = message.Id,
                    patientId = message.PatientId,
                    sessionId = message.SessionId,
                    status = message.Status,
                    attempts = message.Attempts,
                    isPaused = message.IsPaused,
                    pauseReason = message.PauseReason,
                    errorMessage = message.ErrorMessage,
                    sentAt = message.SentAt,
                    eventType = eventType
                };

                // Send to moderator's group for real-time updates
                await _hubContext.Clients
                    .Group($"moderator-{message.ModeratorId.Value}")
                    .SendAsync("MessageUpdated", payload);

                _logger.LogDebug("SignalR: Sent MessageUpdated event to moderator-{ModeratorId} for message {MessageId}",
                    message.ModeratorId.Value, message.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending SignalR MessageUpdated notification for message {MessageId}", message.Id);
                // Don't throw - notification failures shouldn't stop processing
            }
        }

        /// <summary>
        /// Notify clients about session status change via SignalR
        /// </summary>
        private async Task NotifySessionUpdate(MessageSession session, string eventType = "updated")
        {
            try
            {
                var payload = new
                {
                    id = session.Id,
                    queueId = session.QueueId,
                    status = session.Status,
                    isPaused = session.IsPaused,
                    totalMessages = session.TotalMessages,
                    sentMessages = session.SentMessages,
                    failedMessages = session.FailedMessages,
                    ongoingMessages = session.OngoingMessages,
                    eventType = eventType
                };

                // Send to moderator's group for real-time updates
                await _hubContext.Clients
                    .Group($"moderator-{session.ModeratorId}")
                    .SendAsync("SessionUpdated", payload);

                _logger.LogDebug("SignalR: Sent SessionUpdated event to moderator-{ModeratorId} for session {SessionId}",
                    session.ModeratorId, session.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending SignalR SessionUpdated notification for session {SessionId}", session.Id);
                // Don't throw - notification failures shouldn't stop processing
            }
        }

        #endregion
    }
}
