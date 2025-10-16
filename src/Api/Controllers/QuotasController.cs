using Microsoft.AspNetCore.Mvc;
using Clinics.Infrastructure;
using Clinics.Domain;
using Microsoft.EntityFrameworkCore;

namespace Clinics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin")]
    public class QuotasController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        public QuotasController(ApplicationDbContext db) { _db = db; }

        [HttpGet]
        public async Task<IActionResult> GetAll() => Ok(new { success = true, data = await _db.Quotas.ToListAsync() });

        [HttpPut("{moderatorId}")]
        public async Task<IActionResult> Update(int moderatorId, [FromBody] Quota quota)
        {
            var existing = await _db.Quotas.FirstOrDefaultAsync(q => q.ModeratorUserId == moderatorId);
            if (existing == null) { quota.ModeratorUserId = moderatorId; _db.Quotas.Add(quota); }
            else { existing.MessagesQuota = quota.MessagesQuota; existing.QueuesQuota = quota.QueuesQuota; existing.UpdatedAt = DateTime.UtcNow; }
            await _db.SaveChangesAsync();
            return Ok(new { success = true });
        }
    }
}
