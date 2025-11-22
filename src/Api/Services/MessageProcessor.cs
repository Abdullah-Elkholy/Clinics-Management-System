using System;
using System.Linq;
using System.Threading.Tasks;
using Clinics.Infrastructure;
using Clinics.Domain;
using Microsoft.EntityFrameworkCore;

namespace Clinics.Api.Services
{
    public interface IMessageProcessor
    {
        Task ProcessQueuedMessagesAsync(int maxBatch = 50);
    }

    public class MessageProcessor : IMessageProcessor
    {
        private readonly ApplicationDbContext _db;
        private readonly IMessageSender _sender;
        private readonly Clinics.Application.Interfaces.IQuotaService _quotaService;

        public MessageProcessor(ApplicationDbContext db, IMessageSender sender, Clinics.Application.Interfaces.IQuotaService quotaService)
        {
            _db = db;
            _sender = sender;
            _quotaService = quotaService;
        }

        public async Task ProcessQueuedMessagesAsync(int maxBatch = 50)
        {
            // Fetch ALL queued messages that are NOT paused (no limit) - maxBatch parameter is ignored
            var msgs = await _db.Messages
                .Where(m => m.Status == "queued" && !m.IsPaused)
                .OrderBy(m => m.CreatedAt)
                .ToListAsync();
            var totalMessages = msgs.Count;
            var processedCount = 0;
            
            foreach (var m in msgs)
            {
                try
                {
                    // Double-check pause state (may have been paused while processing)
                    if (m.IsPaused)
                    {
                        continue; // Skip paused messages
                    }

                    m.Status = "sending";
                    m.Attempts += 1;
                    m.LastAttemptAt = DateTime.UtcNow;
                    await _db.SaveChangesAsync();

                    var result = await _sender.SendAsync(m);
                    
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
                            }
                        }
                        
                        // Consume quota on successful send (moved from queueing phase for fair billing)
                        if (m.SenderUserId.HasValue)
                        {
                            await _quotaService.ConsumeMessageQuotaAsync(m.SenderUserId.Value, 1);
                        }
                    }
                    else
                    {
                        m.Status = "failed";
                        // create or update failed tasks
                        var ft = new FailedTask { MessageId = m.Id, PatientId = m.PatientId, QueueId = m.QueueId, Reason = "provider_failure", ProviderResponse = result.providerResponse, CreatedAt = DateTime.UtcNow, RetryCount = 0 };
                        _db.FailedTasks.Add(ft);
                    }
                    await _db.SaveChangesAsync();
                    processedCount++;
                }
                catch (Exception ex)
                {
                    // If PendingQR exception, re-throw to stop batch processing (message already reset to queued)
                    if (ex.Message.Contains("WhatsApp session requires authentication", StringComparison.OrdinalIgnoreCase))
                    {
                        var remainingCount = totalMessages - processedCount;
                        Console.WriteLine($"[PendingQR] Stopping batch processing. Processed: {processedCount}/{totalMessages}, Remaining paused: {remainingCount}");
                        throw; // Stop processing batch, message already in "queued" status
                    }
                    
                    // For other exceptions, log and mark failed
                    m.Status = "failed";
                    _db.FailedTasks.Add(new FailedTask { MessageId = m.Id, PatientId = m.PatientId, QueueId = m.QueueId, Reason = "exception", ProviderResponse = ex.Message, CreatedAt = DateTime.UtcNow, RetryCount = m.Attempts });
                    await _db.SaveChangesAsync();
                }
            }
        }
    }
}
