using Microsoft.AspNetCore.Mvc;
using Clinics.Infrastructure;
using Clinics.Domain;
using Microsoft.EntityFrameworkCore;

namespace Clinics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin")]
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
    }
}
