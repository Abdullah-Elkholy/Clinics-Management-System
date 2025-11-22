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
            // Fetch up to maxBatch queued messages
            var msgs = await _db.Messages
                .Where(m => m.Status == "queued")
                .OrderBy(m => m.CreatedAt)
                .Take(maxBatch)
                .ToListAsync();
            var totalMessages = msgs.Count;
            var processedCount = 0;
            
            foreach (var m in msgs)
            {
                try
                {
                    m.Status = "sending";
                    m.Attempts += 1;
                    m.LastAttemptAt = DateTime.UtcNow;
                    await _db.SaveChangesAsync();

                    var result = await _sender.SendAsync(m);
                    
                    // Check for PendingQR response - pause all operations if authentication required
                    if (result.providerResponse != null && result.providerResponse.Contains("PendingQR", StringComparison.OrdinalIgnoreCase))
                    {
                        // Reset message to queued state and stop processing
                        m.Status = "queued";
                        m.Attempts -= 1; // Don't count this as a failed attempt
                        await _db.SaveChangesAsync();
                        throw new InvalidOperationException("WhatsApp session requires authentication. Please authenticate and try again.");
                    }
                    
                    if (result.success)
                    {
                        m.Status = "sent";
                        m.SentAt = DateTime.UtcNow;
                        m.ProviderMessageId = result.providerId;
                        
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
