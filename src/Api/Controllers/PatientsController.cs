using Microsoft.AspNetCore.Mvc;
using Clinics.Infrastructure;
using Clinics.Domain;
using Clinics.Api.DTOs;
using Microsoft.EntityFrameworkCore;

namespace Clinics.Api.Controllers
{
    [ApiController]
    [Route("api/queues/{queueId}/[controller]")]
    public class PatientsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        public PatientsController(ApplicationDbContext db) { _db = db; }

        [HttpGet]
        public async Task<IActionResult> Get(int queueId)
        {
            var patients = await _db.Patients.Where(p => p.QueueId == queueId).OrderBy(p => p.Position).ToListAsync();
            return Ok(new { success = true, data = patients });
        }

        [HttpPost]
        public async Task<IActionResult> Create(int queueId, [FromBody] PatientCreateRequest req)
        {
            if (!ModelState.IsValid) return BadRequest(new { success = false, errors = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage) });

            // Determine insertion position. If DesiredPosition provided, shift existing patients at/after that position.
            var maxPos = await _db.Patients.Where(p => p.QueueId == queueId).MaxAsync(p => (int?)p.Position) ?? 0;
            var insertPos = req.DesiredPosition.HasValue && req.DesiredPosition.Value > 0 ? Math.Min(req.DesiredPosition.Value, maxPos + 1) : maxPos + 1;

            if (insertPos <= maxPos)
            {
                // shift positions by +1 for patients with Position >= insertPos
                var toShift = await _db.Patients.Where(p => p.QueueId == queueId && p.Position >= insertPos).ToListAsync();
                foreach (var p in toShift) p.Position = p.Position + 1;
            }

            var patient = new Patient { QueueId = queueId, FullName = req.FullName, PhoneNumber = req.PhoneNumber, Position = insertPos, Status = "waiting" };
            _db.Patients.Add(patient);
            await _db.SaveChangesAsync();
            return Ok(new { success = true, data = patient });
        }
    }
}
