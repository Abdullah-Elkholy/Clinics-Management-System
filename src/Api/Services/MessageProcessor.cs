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

        public MessageProcessor(ApplicationDbContext db, IMessageSender sender)
        {
            _db = db;
            _sender = sender;
        }

        public async Task ProcessQueuedMessagesAsync(int maxBatch = 50)
        {
            var msgs = await _db.Messages.Where(m => m.Status == "queued").OrderBy(m => m.CreatedAt).Take(maxBatch).ToListAsync();
            foreach (var m in msgs)
            {
                try
                {
                    m.Status = "sending";
                    m.Attempts += 1;
                    m.LastAttemptAt = DateTime.UtcNow;
                    await _db.SaveChangesAsync();

                    var result = await _sender.SendAsync(m);
                    if (result.success)
                    {
                        m.Status = "sent";
                        m.SentAt = DateTime.UtcNow;
                        m.ProviderMessageId = result.providerId;
                    }
                    else
                    {
                        m.Status = "failed";
                        // create or update failed tasks
                        var ft = new FailedTask { MessageId = m.Id, PatientId = m.PatientId, QueueId = m.QueueId, Reason = "provider_failure", ProviderResponse = result.providerResponse, CreatedAt = DateTime.UtcNow, RetryCount = 0 };
                        _db.FailedTasks.Add(ft);
                    }
                    await _db.SaveChangesAsync();
                }
                catch (Exception ex)
                {
                    // log and mark failed
                    m.Status = "failed";
                    _db.FailedTasks.Add(new FailedTask { MessageId = m.Id, PatientId = m.PatientId, QueueId = m.QueueId, Reason = "exception", ProviderResponse = ex.Message, CreatedAt = DateTime.UtcNow, RetryCount = m.Attempts });
                    await _db.SaveChangesAsync();
                }
            }
        }
    }
}
