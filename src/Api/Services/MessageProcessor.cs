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
        private readonly IExtensionCommandService _commandService;

        public MessageProcessor(
            ApplicationDbContext db,
            IWhatsAppProviderFactory providerFactory,
            IMessageSender legacySender,
            Clinics.Application.Interfaces.IQuotaService quotaService,
            CircuitBreakerService circuitBreaker,
            ILogger<MessageProcessor> logger,
            IHubContext<DataUpdateHub> hubContext,
            IExtensionCommandService commandService)
        {
            _db = db;
            _providerFactory = providerFactory;
            _legacySender = legacySender;
            _quotaService = quotaService;
            _circuitBreaker = circuitBreaker;
            _logger = logger;
            _hubContext = hubContext;
            _commandService = commandService;
        }

        public async Task ProcessQueuedMessagesAsync(int maxBatch = 50)
        {
            // P2.8: Generate correlation ID for this processor run
            var processorRunId = Guid.NewGuid();
            using var processorScope = _logger.BeginScope(new Dictionary<string, object>
            {
                ["ProcessorRunId"] = processorRunId,
                ["ProcessorStartTime"] = DateTime.UtcNow
            });

            _logger.LogInformation("ProcessorRun started: {ProcessorRunId}", processorRunId);

            // Priority order:
            // 1. Global WhatsAppSession.IsPaused (highest priority) - skip entire moderator
            // 2. PendingQR pause rejection - already filtered out by !m.IsPaused
            // 3. Manual pause - already filtered out by !m.IsPaused
            // 4. Session StartTime (earliest first)
            //    - Messages ordered by their MessageSession.StartTime (earliest first)
            //    - Within a session, messages ordered by Message.CreatedAt

            // Get list of moderators that have globally paused WhatsApp sessions
            var pausedModeratorIds = await _db.WhatsAppSessions
                .Where(ws => ws.IsPaused && !ws.IsDeleted)
                .Select(ws => ws.ModeratorUserId)
                .ToListAsync();

            // Expire timed-out commands BEFORE checking orphaned messages
            // This ensures commands that expired while in "acked" status are marked as expired
            var expiredCount = await _commandService.ExpireTimedOutCommandsAsync();
            if (expiredCount > 0)
            {
                _logger.LogWarning("Expired {Count} timed-out command(s)", expiredCount);
            }

            // Cleanup orphaned messages stuck in 'sending' status
            // This handles cases where the app restarted before command creation/completion
            // OR where the command expired/failed without updating the message
            var orphanedMessages = await _db.Messages
                .Where(m => !m.IsDeleted && m.Status == "sending" && m.InFlightCommandId != null)
                .ToListAsync();

            foreach (var orphan in orphanedMessages)
            {
                if (!orphan.InFlightCommandId.HasValue)
                    continue;

                // Check if the command exists and its status
                var command = await _db.ExtensionCommands
                    .FirstOrDefaultAsync(c => c.Id == orphan.InFlightCommandId.Value);

                if (command == null)
                {
                    // Command doesn't exist - reset message to queued for retry
                    _logger.LogWarning("Resetting orphaned message {MessageId} from sending to queued (command {CommandId} not found)",
                        orphan.Id, orphan.InFlightCommandId);
                    orphan.Status = "queued";
                    orphan.InFlightCommandId = null;
                }
                else if (command.Status == ExtensionCommandStatuses.Expired ||
                         command.Status == ExtensionCommandStatuses.Failed)
                {
                    // Command expired or failed - reset message to queued for retry
                    _logger.LogWarning("Resetting message {MessageId} from sending to queued (command {CommandId} status: {Status})",
                        orphan.Id, orphan.InFlightCommandId, command.Status);
                    orphan.Status = "queued";
                    orphan.InFlightCommandId = null;
                }
            }

            if (orphanedMessages.Count > 0)
            {
                await _db.SaveChangesAsync();
                _logger.LogInformation("Reset {Count} orphaned message(s) from sending to queued", orphanedMessages.Count);
            }

            var totalMessages = 0;
            var processedCount = 0;
            var errorCount = 0;

            // P0.2: Process messages one at a time with atomic claiming
            // Instead of selecting a batch then updating, we claim one message atomically per iteration
            for (int i = 0; i < maxBatch; i++)
            {
                // Atomic claim: SELECT + UPDATE in one query using ExecuteSqlRaw
                // This prevents race conditions where two workers claim the same message
                var claimedMessage = await ClaimNextEligibleMessageAsync(pausedModeratorIds);

                if (claimedMessage == null)
                {
                    // No more eligible messages
                    if (i == 0 && pausedModeratorIds.Count > 0)
                    {
                        _logger.LogDebug("No messages to process. {PausedCount} moderator(s) are globally paused.", pausedModeratorIds.Count);
                    }
                    break;
                }

                totalMessages++;
                var m = claimedMessage;

                // P2.8: Create message-level correlation scope
                var messageAttemptId = Guid.NewGuid();
                using var messageScope = _logger.BeginScope(new Dictionary<string, object>
                {
                    ["MessageId"] = m.Id,
                    ["MessageAttemptId"] = messageAttemptId,
                    ["AttemptNumber"] = m.Attempts + 1,
                    ["ModeratorId"] = m.ModeratorId ?? 0,
                    ["SessionId"] = m.SessionId ?? "none",
                    ["CorrelationId"] = m.CorrelationId?.ToString() ?? processorRunId.ToString()
                });

                // P2.8: Log state transition - claiming
                _logger.LogInformation("StateTransition: {PreviousState} → {NewState} for message {MessageId}",
                    "queued", "sending", m.Id);

                try
                {
                    // Double-check pause state (may have been paused while processing)
                    if (m.IsPaused)
                    {
                        // P2.8: Log state transition - paused detected
                        _logger.LogInformation("StateTransition: {PreviousState} → {NewState} for message {MessageId} (paused by user)",
                            "sending", "queued(paused)", m.Id);

                        // Release claim - reset to queued
                        m.Status = "queued";
                        await _db.SaveChangesAsync();
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
                            // Release claim - reset to queued
                            m.Status = "queued";
                            await _db.SaveChangesAsync();
                            continue; // Skip this message, circuit is open
                        }
                    }

                    // Message is already claimed as 'sending' by ClaimNextEligibleMessageAsync
                    // Attempts was already incremented, LastAttemptAt was already set

                    // Execute send through circuit breaker using the appropriate provider
                    (bool success, string? providerId, string? providerResponse) result;
                    try
                    {
                        if (m.ModeratorId.HasValue)
                        {
                            result = await _circuitBreaker.ExecuteAsync(m.ModeratorId.Value, async () =>
                            {
                                // Get the appropriate provider (Extension or Playwright fallback)
                                var providerResult = await _providerFactory.GetProviderAsync(m.ModeratorId.Value);
                                var provider = providerResult.provider;
                                var providerName = providerResult.providerName;
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
                        // P2.8: Log state transition - sent successfully
                        _logger.LogInformation("StateTransition: {PreviousState} → {NewState} for message {MessageId} (provider confirmed)",
                            "sending", "sent", m.Id);

                        m.Status = "sent";
                        m.SentAt = DateTime.UtcNow;
                        m.ProviderMessageId = result.providerId;
                        m.InFlightCommandId = null; // Clear in-flight command on success

                        // CRITICAL: Save with concurrency conflict handling
                        // If the message was paused while we were sending, the pause wins
                        // because the user explicitly requested it
                        try
                        {
                            await _db.SaveChangesAsync();
                        }
                        catch (DbUpdateConcurrencyException ex)
                        {
                            // Concurrency conflict - reload and check current state
                            _logger.LogWarning(ex, "Concurrency conflict saving message {MessageId} as sent. Reloading to check state.", m.Id);
                            await _db.Entry(m).ReloadAsync();

                            // If message was paused by user, respect that decision
                            if (m.IsPaused)
                            {
                                _logger.LogInformation("Message {MessageId} was paused during send. Keeping paused state (user decision wins).", m.Id);
                                continue;
                            }

                            // Otherwise, re-apply our sent status and try again
                            m.Status = "sent";
                            m.SentAt = DateTime.UtcNow;
                            m.ProviderMessageId = result.providerId;
                            m.InFlightCommandId = null;
                            await _db.SaveChangesAsync();
                        }

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
                            // P1.6: Calculate exponential backoff delay using NextAttemptAt field
                            // Instead of Task.Run with in-memory delay, use DB-driven scheduling
                            var delayMs = ExponentialBackoff.CalculateDelayMs(m.Attempts, baseDelaySeconds: 1, maxDelaySeconds: 30);
                            var delayDesc = ExponentialBackoff.GetDelayDescription(m.Attempts);
                            var nextAttempt = DateTime.UtcNow.AddMilliseconds(delayMs);

                            // P2.8: Log state transition - scheduling retry
                            _logger.LogWarning("StateTransition: {PreviousState} → {NewState} for message {MessageId} (attempt {Attempt}/{Max}, retry at {NextAttempt})",
                                "sending", "awaiting_retry", m.Id, m.Attempts, maxRetryAttempts, nextAttempt);

                            // Schedule retry using NextAttemptAt - processor will pick it up when due
                            m.Status = "queued";
                            m.NextAttemptAt = nextAttempt;
                            m.ErrorMessage = $"Attempt {m.Attempts}/{maxRetryAttempts} failed: {result.providerResponse}. Retrying at {nextAttempt:HH:mm:ss}";
                            m.InFlightCommandId = null; // Clear in-flight command

                            await _db.SaveChangesAsync();

                            // Note: No Task.Run - the processor query now includes NextAttemptAt check
                        }
                        else
                        {
                            // Max attempts reached - mark as permanently failed
                            // P2.8: Log state transition - permanent failure
                            _logger.LogError("StateTransition: {PreviousState} → {NewState} for message {MessageId} (max attempts {Attempts} reached)",
                                "sending", "failed", m.Id, m.Attempts);

                            m.Status = "failed";
                            m.ErrorMessage = result.providerResponse ?? "Provider returned failure";
                            m.InFlightCommandId = null;

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

                    // P2.8: Log state transition - exception failure
                    _logger.LogError(ex, "StateTransition: {PreviousState} → {NewState} for message {MessageId} (unhandled exception)",
                        "sending", "failed", m.Id);

                    m.Status = "failed";
                    m.ErrorMessage = ex.Message;
                    m.InFlightCommandId = null;
                    _db.FailedTasks.Add(new FailedTask { MessageId = m.Id, PatientId = m.PatientId, QueueId = m.QueueId, Reason = "exception", ProviderResponse = ex.Message, CreatedAt = DateTime.UtcNow, RetryCount = m.Attempts });
                    await _db.SaveChangesAsync();
                }
            }

            // P2.8: Log processor run summary
            _logger.LogInformation("ProcessorRun completed: {ProcessorRunId} - Processed={Processed}, Errors={Errors}, Total={Total}",
                processorRunId, processedCount, errorCount, totalMessages);

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

        #region Atomic Claiming

        /// <summary>
        /// Atomically claim the next eligible message for processing.
        /// This prevents race conditions where multiple workers claim the same message.
        /// Uses a single UPDATE with OUTPUT to atomically select and update in one query.
        /// Note: Message.SessionId is a string (VARCHAR) storing the MessageSession.Id (GUID)
        /// </summary>
        private async Task<Message?> ClaimNextEligibleMessageAsync(List<int> pausedModeratorIds)
        {
            // Build the list of paused moderator IDs for SQL IN clause (no quotes for int)
            var pausedModeratorIdsCsv = string.Join(",", pausedModeratorIds);
            var pausedModeratorFilter = pausedModeratorIds.Any()
                ? $"AND (m.ModeratorId IS NULL OR m.ModeratorId NOT IN ({pausedModeratorIdsCsv}))"
                : "";

            // Generate a unique command ID to track this claim
            var commandId = Guid.NewGuid();

            // Atomic claim using OUTPUT INTO temp table - SQL Server specific
            // Using OUTPUT INTO instead of plain OUTPUT to work with triggers on Messages table
            // This atomically finds the next eligible message and marks it as 'sending'
            // Note: SessionId is stored as VARCHAR(100), need to TRY_CAST for join
            // CRITICAL: Only claim if no other message for the same moderator is already in 'sending' status
            // This ensures sequential processing (one message at a time per moderator)
            var sql = $@"
                -- Create temp table for output
                CREATE TABLE #ClaimedMessages (MessageId UNIQUEIDENTIFIER);
                
                ;WITH EligibleMessages AS (
                    SELECT TOP(1) m.Id, m.ModeratorId
                    FROM Messages m
                    LEFT JOIN MessageSessions s ON TRY_CAST(m.SessionId AS UNIQUEIDENTIFIER) = s.Id
                    WHERE m.Status IN ('queued', 'pending')
                      AND m.IsPaused = 0
                      AND m.IsDeleted = 0
                      AND (s.Id IS NULL OR (s.IsPaused = 0 AND s.IsDeleted = 0))
                      AND (m.NextAttemptAt IS NULL OR m.NextAttemptAt <= GETUTCDATE())
                      {pausedModeratorFilter}
                      -- CRITICAL: Only claim if no other message for this moderator is in 'sending' status
                      AND NOT EXISTS (
                          SELECT 1 FROM Messages sending
                          WHERE sending.ModeratorId = m.ModeratorId
                            AND sending.Status = 'sending'
                            AND sending.IsDeleted = 0
                      )
                    -- Priority: check_whatsapp sessions first (0), then send sessions (1)
                    ORDER BY CASE WHEN s.SessionType = 'check_whatsapp' THEN 0 ELSE 1 END ASC,
                             COALESCE(s.StartTime, m.CreatedAt) ASC, m.CreatedAt ASC, m.Id ASC
                )
                UPDATE m
                SET m.Status = 'sending',
                    m.InFlightCommandId = '{commandId}'
                OUTPUT inserted.Id INTO #ClaimedMessages
                FROM Messages m
                INNER JOIN EligibleMessages e ON m.Id = e.Id;
                
                -- Return the claimed message ID
                SELECT MessageId FROM #ClaimedMessages;
                
                -- Cleanup
                DROP TABLE #ClaimedMessages;
                ";

            try
            {
                // Execute the atomic claim and get the claimed message ID
                var claimedIds = await _db.Database
                    .SqlQueryRaw<Guid>(sql)
                    .ToListAsync();

                if (claimedIds.Count == 0)
                {
                    return null;
                }

                // Fetch the full message entity
                var claimedId = claimedIds.First();
                var trackedMessage = await _db.Messages
                    .FirstOrDefaultAsync(m => m.Id == claimedId);

                if (trackedMessage != null)
                {
                    _logger.LogDebug("Atomically claimed message {MessageId} with command {CommandId}",
                        trackedMessage.Id, commandId);
                }

                return trackedMessage;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in atomic message claiming");
                return null;
            }
        }

        #endregion
    }
}
