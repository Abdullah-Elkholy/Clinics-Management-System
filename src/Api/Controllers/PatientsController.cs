using Microsoft.AspNetCore.Mvc;
using Clinics.Infrastructure;
using Clinics.Domain;
using Clinics.Api.DTOs;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;

namespace Clinics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class PatientsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly ILogger<PatientsController> _logger;

        public PatientsController(ApplicationDbContext db, ILogger<PatientsController> logger)
        {
            _db = db;
            _logger = logger;
        }

        /// <summary>
        /// GET /api/patients?queueId=1
        /// Get all patients for a queue, ordered by position.
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<ListResponse<PatientDto>>> GetByQueue([FromQuery] int queueId)
        {
            try
            {
                var patients = await _db.Patients
                    .Where(p => p.QueueId == queueId)
                    .OrderBy(p => p.Position)
                    .Select(p => new PatientDto
                    {
                        Id = p.Id,
                        FullName = p.FullName,
                        PhoneNumber = p.PhoneNumber,
                        Position = p.Position,
                        Status = p.Status
                    })
                    .ToListAsync();

                return Ok(new ListResponse<PatientDto>
                {
                    Items = patients,
                    TotalCount = patients.Count,
                    PageNumber = 1,
                    PageSize = patients.Count
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching patients");
                return StatusCode(500, new { message = "Error fetching patients" });
            }
        }

        /// <summary>
        /// POST /api/patients
        /// Create a new patient in a queue.
        /// If DesiredPosition is provided, insert at that position and shift conflicts +1.
        /// </summary>
        [HttpPost]
        [Authorize(Roles = "primary_admin,secondary_admin,moderator")]
        public async Task<ActionResult<PatientDto>> Create([FromBody] CreatePatientRequest req)
        {
            try
            {
                if (!ModelState.IsValid)
                    return BadRequest(ModelState);

                // Determine insertion position. If DesiredPosition provided, shift existing patients at/after that position.
                var maxPos = await _db.Patients
                    .Where(p => p.QueueId == req.QueueId)
                    .MaxAsync(p => (int?)p.Position) ?? 0;

                var insertPos = req.Position.HasValue && req.Position.Value > 0
                    ? Math.Min(req.Position.Value, maxPos + 1)
                    : maxPos + 1;

                using (var transaction = await _db.Database.BeginTransactionAsync())
                {
                    try
                    {
                        // Shift positions by +1 for patients with Position >= insertPos
                        if (insertPos <= maxPos)
                        {
                            var toShift = await _db.Patients
                                .Where(p => p.QueueId == req.QueueId && p.Position >= insertPos)
                                .ToListAsync();
                            foreach (var p in toShift)
                                p.Position = p.Position + 1;
                        }

                        var patient = new Patient
                        {
                            QueueId = req.QueueId,
                            FullName = req.FullName,
                            PhoneNumber = req.PhoneNumber,
                            Position = insertPos,
                            Status = "waiting"
                        };

                        _db.Patients.Add(patient);
                        await _db.SaveChangesAsync();
                        await transaction.CommitAsync();

                        var dto = new PatientDto
                        {
                            Id = patient.Id,
                            FullName = patient.FullName,
                            PhoneNumber = patient.PhoneNumber,
                            Position = patient.Position,
                            Status = patient.Status
                        };

                        return CreatedAtAction(nameof(GetByQueue), new { queueId = req.QueueId }, dto);
                    }
                    catch
                    {
                        await transaction.RollbackAsync();
                        throw;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating patient");
                return StatusCode(500, new { message = "Error creating patient" });
            }
        }

        /// <summary>
        /// PUT /api/patients/{id}
        /// Update patient details.
        /// </summary>
        [HttpPut("{id}")]
        [Authorize(Roles = "primary_admin,secondary_admin,moderator")]
        public async Task<ActionResult<PatientDto>> Update(int id, [FromBody] UpdatePatientRequest req)
        {
            try
            {
                var patient = await _db.Patients.FindAsync(id);
                if (patient == null)
                    return NotFound(new { message = "Patient not found" });

                if (!string.IsNullOrEmpty(req.FullName))
                    patient.FullName = req.FullName;

                if (!string.IsNullOrEmpty(req.PhoneNumber))
                    patient.PhoneNumber = req.PhoneNumber;

                if (!string.IsNullOrEmpty(req.Status))
                    patient.Status = req.Status;

                await _db.SaveChangesAsync();

                var dto = new PatientDto
                {
                    Id = patient.Id,
                    FullName = patient.FullName,
                    PhoneNumber = patient.PhoneNumber,
                    Position = patient.Position,
                    Status = patient.Status
                };

                return Ok(dto);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating patient");
                return StatusCode(500, new { message = "Error updating patient" });
            }
        }

        /// <summary>
        /// DELETE /api/patients/{id}
        /// Delete a patient and shift remaining patients' positions.
        /// </summary>
        [HttpDelete("{id}")]
        [Authorize(Roles = "primary_admin,secondary_admin,moderator")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var patient = await _db.Patients.FindAsync(id);
                if (patient == null)
                    return NotFound(new { message = "Patient not found" });

                using (var transaction = await _db.Database.BeginTransactionAsync())
                {
                    try
                    {
                        int queueId = patient.QueueId;
                        int deletedPosition = patient.Position;

                        // Shift down all patients with position > deletedPosition
                        var toShift = await _db.Patients
                            .Where(p => p.QueueId == queueId && p.Position > deletedPosition)
                            .ToListAsync();
                        foreach (var p in toShift)
                            p.Position = p.Position - 1;

                        _db.Patients.Remove(patient);
                        await _db.SaveChangesAsync();
                        await transaction.CommitAsync();

                        return NoContent();
                    }
                    catch
                    {
                        await transaction.RollbackAsync();
                        throw;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting patient");
                return StatusCode(500, new { message = "Error deleting patient" });
            }
        }

        /// <summary>
        /// POST /api/patients/reorder
        /// Atomically reorder patients in a queue.
        /// Input: queueId, items: [{ id, position }...]
        /// If position conflicts occur, shifts the conflicting patient and all with greater positions +1.
        /// </summary>
        [HttpPost("reorder")]
        [Authorize(Roles = "primary_admin,secondary_admin,moderator")]
        public async Task<IActionResult> Reorder([FromBody] ReorderPatientsRequest req)
        {
            try
            {
                if (!ModelState.IsValid)
                    return BadRequest(ModelState);

                if (req.Items == null || req.Items.Count == 0)
                    return BadRequest(new { message = "Items list cannot be empty" });

                using (var transaction = await _db.Database.BeginTransactionAsync())
                {
                    try
                    {
                        // Load all patients in the queue
                        var allPatients = await _db.Patients
                            .Where(p => p.QueueId == req.QueueId)
                            .ToListAsync();

                        var patientMap = allPatients.ToDictionary(p => p.Id);

                        // Process reorder requests in order
                        foreach (var item in req.Items)
                        {
                            if (!patientMap.TryGetValue(item.Id, out var patient))
                                continue; // Skip if patient not found

                            var requestedPos = item.Position;

                            // If position is already taken by another patient, shift it and all greater positions +1
                            var conflicting = allPatients.FirstOrDefault(p => p.Id != patient.Id && p.Position == requestedPos);
                            if (conflicting != null)
                            {
                                // Shift conflicting and all with greater positions
                                var toShift = allPatients.Where(p => p.Position >= requestedPos && p.Id != patient.Id).OrderByDescending(p => p.Position);
                                foreach (var p in toShift)
                                    p.Position = p.Position + 1;
                            }

                            // Set the patient to the requested position
                            patient.Position = requestedPos;
                        }

                        await _db.SaveChangesAsync();
                        await transaction.CommitAsync();

                        return Ok(new { message = "Patients reordered successfully" });
                    }
                    catch
                    {
                        await transaction.RollbackAsync();
                        throw;
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reordering patients");
                return StatusCode(500, new { message = "Error reordering patients" });
            }
        }
    }
}
