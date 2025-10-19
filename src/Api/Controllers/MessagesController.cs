using Microsoft.AspNetCore.Mvc;
using Clinics.Infrastructure;
using Clinics.Domain;
using Clinics.Api.DTOs;
using Microsoft.EntityFrameworkCore;

namespace Clinics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin")]
    public class MessagesController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        public MessagesController(ApplicationDbContext db) { _db = db; }

        [HttpPost("send")]
        public async Task<IActionResult> Send([FromBody] SendMessageRequest req)
        {
            var template = await _db.MessageTemplates.FindAsync(req.TemplateId);
            if (template == null) return BadRequest(new { success = false, errors = new[]{ new { code = "TemplateNotFound", message = "Template not found" } } });

            var patients = await _db.Patients.Where(p => req.PatientIds.Contains(p.Id)).ToListAsync();
            var messages = new List<Message>();

            foreach(var p in patients)
            {
                var content = req.OverrideContent ?? template.Content;
                var msg = new Message {
                    PatientId = p.Id,
                    TemplateId = template.Id,
                    QueueId = p.QueueId,
                    SenderUserId = null,
                    Channel = req.Channel ?? "whatsapp",
                    RecipientPhone = p.PhoneNumber,
                    Content = content,
                    Status = "queued",
                    CreatedAt = DateTime.UtcNow
                };
                messages.Add(msg);
            }

            if (messages.Count > 0)
            {
                await _db.Messages.AddRangeAsync(messages);
                await _db.SaveChangesAsync();
            }

            return Ok(new { success = true, queued = messages.Count });
        }

        // Retry processing for failed messages/tasks - frontend posts to /api/messages/retry
        [HttpPost("retry")]
        public async Task<IActionResult> RetryAll()
        {
            // Simple operation: requeue any failed tasks' messages
            var failed = await _db.FailedTasks.ToListAsync();
            var requeued = 0;
            foreach(var f in failed)
            {
                if (f.MessageId.HasValue)
                {
                    var msg = await _db.Messages.FindAsync(f.MessageId.Value);
                    if (msg != null)
                    {
                        msg.Status = "queued";
                        msg.Attempts = 0;
                        _db.FailedTasks.Remove(f);
                        requeued++;
                    }
                }
            }
            await _db.SaveChangesAsync();
            return Ok(new { success = true, requeued });
        }
    }
}
