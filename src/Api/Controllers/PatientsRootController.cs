using Microsoft.AspNetCore.Mvc;
using Clinics.Infrastructure;
using Clinics.Domain;
using Microsoft.EntityFrameworkCore;

namespace Clinics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class PatientsRootController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        public PatientsRootController(ApplicationDbContext db) { _db = db; }

        // DELETE /api/patients/{id}
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var p = await _db.Patients.FindAsync(id);
            if (p == null) return NotFound(new { success = false });
            _db.Patients.Remove(p);
            await _db.SaveChangesAsync();
            return Ok(new { success = true });
        }

        // Optional: GET /api/patients?queueId=123
        [HttpGet]
        public async Task<IActionResult> Get([FromQuery] int? queueId)
        {
            if (!queueId.HasValue) return BadRequest(new { success = false });
            var list = await _db.Patients.Where(p => p.QueueId == queueId.Value).OrderBy(p => p.Position).ToListAsync();
            return Ok(new { success = true, patients = list });
        }
    }
}
 
