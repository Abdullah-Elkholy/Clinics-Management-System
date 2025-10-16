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
    }
}
