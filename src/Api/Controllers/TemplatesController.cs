using Microsoft.AspNetCore.Mvc;
using Clinics.Infrastructure;
using Clinics.Domain;
using Microsoft.EntityFrameworkCore;

namespace Clinics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin")]
    public class TemplatesController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        public TemplatesController(ApplicationDbContext db) { _db = db; }

        [HttpGet]
        public async Task<IActionResult> Get()
        {
            var templates = await _db.MessageTemplates.ToListAsync();
            return Ok(new { success = true, data = templates });
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] MessageTemplate req)
        {
            if (!ModelState.IsValid) return BadRequest(new { success = false, errors = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage) });
            req.CreatedAt = DateTime.UtcNow;
            _db.MessageTemplates.Add(req);
            await _db.SaveChangesAsync();
            return Ok(new { success = true, data = req });
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] MessageTemplate req)
        {
            var existing = await _db.MessageTemplates.FindAsync(id);
            if (existing == null) return NotFound(new { success = false });
            existing.Title = req.Title;
            existing.Content = req.Content;
            existing.IsShared = req.IsShared;
            existing.Moderator = req.Moderator;
            await _db.SaveChangesAsync();
            return Ok(new { success = true, data = existing });
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var existing = await _db.MessageTemplates.FindAsync(id);
            if (existing == null) return NotFound(new { success = false });
            _db.MessageTemplates.Remove(existing);
            await _db.SaveChangesAsync();
            return Ok(new { success = true });
        }
    }
}
