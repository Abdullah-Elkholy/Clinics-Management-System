using Microsoft.AspNetCore.Mvc;
using Clinics.Infrastructure;
using Clinics.Domain;
using Clinics.Api.DTOs;
using Clinics.Api.Services;
using Clinics.Infrastructure.Repositories;
using Clinics.Infrastructure.Services;
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
        private readonly ISoftDeleteTTLQueries<Patient> _ttlQueries;
        private readonly IUserContext _userContext;
        private readonly Clinics.Api.Services.IPatientCascadeService _patientCascadeService;
        private readonly IPatientPositionService _patientPositionService;
        public PatientsController(
            ApplicationDbContext db,
            ILogger<PatientsController> logger,
            IGenericUnitOfWork unitOfWork,
            IUserContext userContext,
            Clinics.Api.Services.IPatientCascadeService patientCascadeService,
            IPatientPositionService patientPositionService)
        {
            _db = db;
            _logger = logger;
            _ttlQueries = unitOfWork.TTLQueries<Patient>();
            _userContext = userContext;
            _patientCascadeService = patientCascadeService;
            _patientPositionService = patientPositionService;
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
                    .Where(p => p.QueueId == queueId && !p.IsDeleted)
                    .OrderBy(p => p.Position)
                    .Select(p => new PatientDto
                    {
                        Id = p.Id,
                        FullName = p.FullName,
                        PhoneNumber = p.PhoneNumber,
                        CountryCode = p.CountryCode,
                        IsValidWhatsAppNumber = p.IsValidWhatsAppNumber,
                        Position = p.Position,
                        Status = p.Status,
                        CreatedAt = p.CreatedAt,
                        UpdatedAt = p.UpdatedAt,
                        CreatedBy = p.CreatedBy,
                        UpdatedBy = p.UpdatedBy
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
        /// GET /api/patients/{id}
        /// Get a single patient by ID.
        /// </summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<PatientDto>> Get(int id)
        {
            try
            {
                if (id <= 0)
                    return BadRequest(new { success = false, error = "Invalid patient ID" });

                var patient = await _db.Patients
                    .Where(p => p.Id == id && !p.IsDeleted)
                    .Select(p => new PatientDto
                    {
                        Id = p.Id,
                        FullName = p.FullName,
                        PhoneNumber = p.PhoneNumber,
                        CountryCode = p.CountryCode,
                        IsValidWhatsAppNumber = p.IsValidWhatsAppNumber,
                        Position = p.Position,
                        Status = p.Status,
                        CreatedAt = p.CreatedAt,
                        UpdatedAt = p.UpdatedAt,
                        CreatedBy = p.CreatedBy,
                        UpdatedBy = p.UpdatedBy
                    })
                    .FirstOrDefaultAsync();

                if (patient == null)
                    return NotFound(new { success = false, error = "Patient not found" });

                return Ok(new { success = true, data = patient });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching patient {PatientId}", id);
                return StatusCode(500, new { success = false, error = "Error fetching patient" });
            }
        }

        /// <summary>
        /// POST /api/patients
        /// Create a new patient in a queue.
        /// Position is auto-assigned as max(active)+1. Client position is ignored.
        /// New patients are always inserted at the end of the active queue baseline.
        /// </summary>
        [HttpPost]
        [Authorize(Roles = "primary_admin,secondary_admin,moderator")]
        public async Task<ActionResult<PatientDto>> Create([FromBody] CreatePatientRequest req)
        {
            try
            {
                // Validate request is not null
                if (req == null)
                    return BadRequest(new { success = false, error = "Request body is required" });

                // Validate required fields explicitly
                if (string.IsNullOrWhiteSpace(req.FullName))
                    return BadRequest(new { success = false, error = "Full name is required" });

                if (string.IsNullOrWhiteSpace(req.PhoneNumber))
                    return BadRequest(new { success = false, error = "Phone number is required" });

                if (req.QueueId <= 0)
                    return BadRequest(new { success = false, error = "Valid Queue ID is required" });

                if (!ModelState.IsValid)
                    return BadRequest(new { success = false, errors = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage) });

                // Verify queue exists
                var queueExists = await _db.Queues.AnyAsync(q => q.Id == req.QueueId && !q.IsDeleted);
                if (!queueExists)
                    return BadRequest(new { success = false, error = "Queue does not exist" });

                // Determine insertion position: max(active patients) + 1. Only count active (!IsDeleted) patients.
                // Client-provided position is ignored per business rule (baseline always at end).
                var maxPos = await _db.Patients
                    .Where(p => p.QueueId == req.QueueId && !p.IsDeleted)
                    .MaxAsync(p => (int?)p.Position) ?? 0;

                var insertPos = maxPos + 1;

                try
                {
                    // Handle spaces in phone number (remove them instead of rejecting)
                    var phoneNumberCleaned = req.PhoneNumber?.Replace(" ", "") ?? string.Empty;
                    
                    // Handle spaces in country code (remove them instead of rejecting)
                    var countryCodeCleaned = !string.IsNullOrWhiteSpace(req.CountryCode) 
                        ? req.CountryCode.Replace(" ", "") 
                        : "+20"; // Default to Egypt if not provided

                    // Validate country code format
                    if (!countryCodeCleaned.StartsWith("+"))
                    {
                        return BadRequest(new { success = false, error = "Country code must start with + (e.g., +20)" });
                    }

                    // Get current user ID for audit using IUserContext
                    int userId;
                    try
                    {
                        userId = _userContext.GetUserId();
                    }
                    catch (InvalidOperationException authEx)
                    {
                        _logger.LogError(authEx, "Authentication error: User ID not found in claims");
                        return Unauthorized(new { success = false, error = "Authentication failed. Please log in again." });
                    }

                    // No shift needed: new patients always inserted at end (maxPos + 1)
                    // Store phone number and country code separately - NO NORMALIZATION
                    var patient = new Patient
                    {
                        QueueId = req.QueueId,
                        FullName = req.FullName,
                        PhoneNumber = phoneNumberCleaned, // Store as-is, no normalization
                        CountryCode = countryCodeCleaned,
                        Position = insertPos,
                        Status = "waiting",
                        CreatedBy = userId
                    };

                    _db.Patients.Add(patient);
                    await _db.SaveChangesAsync();

                    var dto = new PatientDto
                    {
                        Id = patient.Id,
                        FullName = patient.FullName,
                        PhoneNumber = patient.PhoneNumber,
                        CountryCode = patient.CountryCode,
                        IsValidWhatsAppNumber = patient.IsValidWhatsAppNumber,
                        Position = patient.Position,
                        Status = patient.Status,
                        CreatedAt = patient.CreatedAt,
                        UpdatedAt = patient.UpdatedAt,
                        CreatedBy = patient.CreatedBy,
                        UpdatedBy = patient.UpdatedBy
                    };

                    return CreatedAtAction(nameof(GetByQueue), new { queueId = req.QueueId }, new { success = true, data = dto });
                }
                catch (DbUpdateException dbEx)
                {
                    _logger.LogError(dbEx, "Database error creating patient");
                    return StatusCode(400, new { success = false, error = "Invalid data or constraint violation", details = dbEx.InnerException?.Message });
                }
            }
            catch (InvalidOperationException authEx) when (authEx.Message.Contains("User ID") || authEx.Message.Contains("HttpContext"))
            {
                _logger.LogError(authEx, "Authentication error creating patient");
                return Unauthorized(new { success = false, error = "Authentication failed. Please log in again." });
            }
            catch (DbUpdateException ex)
            {
                _logger.LogError(ex, "Database constraint error creating patient");
                return StatusCode(400, new { success = false, error = "Invalid data or constraint violation", details = ex.InnerException?.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating patient: {ErrorMessage}", ex.Message);
                _logger.LogError(ex, "Stack trace: {StackTrace}", ex.StackTrace);
                return StatusCode(500, new { success = false, error = "Error creating patient", details = ex.Message });
            }
        }

    // PATCH /api/patients/{id}/position
    // Update a patient's position with atomic conflict resolution.
    // Position less than 1 is coerced to 1. If occupied, shifts occupant and all >= position by +1.
        [HttpPatch("{id}/position")]
        [Authorize(Roles = "primary_admin,secondary_admin,moderator")]
        public async Task<IActionResult> UpdatePosition(int id, [FromBody] UpdatePatientPositionRequest req)
        {
            try
            {
                if (req == null || req.Position < 1)
                {
                    return BadRequest(new { error = "invalid_position", message = "Position must be >= 1" });
                }

                var (success, errorMessage) = await _patientPositionService.UpdatePatientPositionAsync(id, req.Position);

                if (!success)
                {
                    return errorMessage == "patient_not_found"
                        ? NotFound(new { error = "patient_not_found", message = "Patient not found" })
                        : StatusCode(500, new { error = errorMessage, message = "Error updating patient position" });
                }

                return Ok(new { success = true, message = "Patient position updated successfully" });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating patient position for patient {PatientId}", id);
                return StatusCode(500, new { error = "error_updating_position", message = "An error occurred while updating patient position" });
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
                _logger.LogInformation("Update patient request: PatientId={PatientId}, FullName={FullName}, PhoneNumber={PhoneNumber}, CountryCode={CountryCode}, Status={Status}, IsValidWhatsAppNumber={IsValidWhatsAppNumber}", 
                    id, req?.FullName, req?.PhoneNumber, req?.CountryCode, req?.Status, req?.IsValidWhatsAppNumber);
                
                var patient = await _db.Patients.FindAsync(id);
                if (patient == null)
                {
                    _logger.LogWarning("Patient not found: PatientId={PatientId}", id);
                    return NotFound(new { message = "Patient not found" });
                }

                // Validate request is not null
                if (req == null)
                {
                    _logger.LogWarning("Update request body is null for patient {PatientId}", id);
                    return BadRequest(new { success = false, error = "Request body is required" });
                }

                // Check ModelState validation (for data annotations like [Phone], [StringLength])
                if (!ModelState.IsValid)
                {
                    var validationErrors = ModelState.Values
                        .SelectMany(v => v.Errors)
                        .Select(e => e.ErrorMessage)
                        .ToList();
                    _logger.LogWarning("ModelState validation failed for patient {PatientId}: {Errors}", id, string.Join(", ", validationErrors));
                    return BadRequest(new { success = false, error = "Validation failed", errors = validationErrors });
                }

                if (!string.IsNullOrEmpty(req.FullName))
                    patient.FullName = req.FullName;

                // Track if phone number or country code changed to reset WhatsApp validation
                bool phoneOrCountryCodeChanged = false;

                // Update phone number if provided - NO NORMALIZATION, store as-is
                if (!string.IsNullOrEmpty(req.PhoneNumber))
                {
                    // Handle spaces in phone number (remove them instead of rejecting)
                    var phoneNumberCleaned = req.PhoneNumber.Replace(" ", "");
                    
                    // Handle spaces in country code (remove them instead of rejecting)
                    var countryCodeCleaned = !string.IsNullOrWhiteSpace(req.CountryCode) 
                        ? req.CountryCode.Replace(" ", "") 
                        : patient.CountryCode ?? "+20"; // Use existing or default

                    // Validate country code format
                    if (!countryCodeCleaned.StartsWith("+"))
                    {
                        return BadRequest(new { success = false, error = "Country code must start with + (e.g., +20)" });
                    }

                    // Check if phone number or country code actually changed
                    if (patient.PhoneNumber != phoneNumberCleaned || patient.CountryCode != countryCodeCleaned)
                    {
                        phoneOrCountryCodeChanged = true;
                    }

                    patient.PhoneNumber = phoneNumberCleaned; // Store as-is, no normalization
                    patient.CountryCode = countryCodeCleaned;
                }
                else if (!string.IsNullOrWhiteSpace(req.CountryCode))
                {
                    // Only country code changed (phone number not provided in request)
                    var countryCodeCleaned = req.CountryCode.Replace(" ", "");
                    
                    // Validate country code format
                    if (!countryCodeCleaned.StartsWith("+"))
                    {
                        return BadRequest(new { success = false, error = "Country code must start with + (e.g., +20)" });
                    }
                    
                    if (patient.CountryCode != countryCodeCleaned)
                    {
                        phoneOrCountryCodeChanged = true;
                        patient.CountryCode = countryCodeCleaned;
                    }
                }

                // Reset WhatsApp validation if phone number or country code changed
                if (phoneOrCountryCodeChanged)
                {
                    patient.IsValidWhatsAppNumber = null;
                }
                // Otherwise, allow updating IsValidWhatsAppNumber if provided in request
                else if (req.IsValidWhatsAppNumber.HasValue)
                {
                    patient.IsValidWhatsAppNumber = req.IsValidWhatsAppNumber.Value;
                }

                if (!string.IsNullOrEmpty(req.Status))
                    patient.Status = req.Status;

                // Get current user ID for audit using IUserContext
                int userId;
                try
                {
                    userId = _userContext.GetUserId();
                }
                catch (InvalidOperationException authEx)
                {
                    _logger.LogError(authEx, "Authentication error: User ID not found in claims");
                    return Unauthorized(new { success = false, error = "Authentication failed. Please log in again." });
                }

                // Set UpdatedAt and UpdatedBy for audit trail
                patient.UpdatedAt = DateTime.UtcNow;
                patient.UpdatedBy = userId;

                await _db.SaveChangesAsync();

                try
                {
                    var dto = new PatientDto
                    {
                        Id = patient.Id,
                        FullName = patient.FullName,
                        PhoneNumber = patient.PhoneNumber,
                        CountryCode = patient.CountryCode,
                        IsValidWhatsAppNumber = patient.IsValidWhatsAppNumber,
                        Position = patient.Position,
                        Status = patient.Status,
                        CreatedAt = patient.CreatedAt,
                        UpdatedAt = patient.UpdatedAt,
                        CreatedBy = patient.CreatedBy,
                        UpdatedBy = patient.UpdatedBy
                    };

                    _logger.LogInformation("Patient updated successfully: PatientId={PatientId}", id);
                    return Ok(new { success = true, data = dto });
                }
                catch (Exception dtoEx)
                {
                    _logger.LogError(dtoEx, "Error creating DTO for patient {PatientId}", id);
                    return StatusCode(500, new { success = false, error = "Error creating response", details = dtoEx.Message });
                }
            }
            catch (InvalidOperationException authEx) when (authEx.Message.Contains("User ID") || authEx.Message.Contains("HttpContext"))
            {
                _logger.LogError(authEx, "Authentication error updating patient");
                return Unauthorized(new { success = false, error = "Authentication failed. Please log in again." });
            }
            catch (DbUpdateException dbEx)
            {
                _logger.LogError(dbEx, "Database error updating patient");
                return StatusCode(400, new { success = false, error = "Invalid data or constraint violation", details = dbEx.InnerException?.Message });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating patient: {ErrorMessage}", ex.Message);
                _logger.LogError(ex, "Stack trace: {StackTrace}", ex.StackTrace);
                return StatusCode(500, new { success = false, error = "Error updating patient", details = ex.Message });
            }
        }

        /// <summary>
        /// DELETE /api/patients/{id}
        /// Soft-delete a patient
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

                var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
                
                // Soft-delete patient
                var (success, errorMessage) = await _patientCascadeService.SoftDeletePatientAsync(id, userId);
                
                if (!success)
                {
                    return BadRequest(new { success = false, error = errorMessage });
                }

                return NoContent();
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

                // Reorder is a multi-step operation that modifies multiple patients atomically.
                // Must use transaction to prevent race conditions and ensure data consistency.
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
                    catch (Exception ex)
                    {
                        await transaction.RollbackAsync();
                        _logger.LogError(ex, "Error during reorder");
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

    // GET /api/patients/trash?queueId=1&page=1&pageSize=10
    // Get soft-deleted patients (trash) for a queue.
        [HttpGet("trash")]
        [Authorize(Roles = "primary_admin,secondary_admin,moderator")]
        public async Task<IActionResult> GetTrash([FromQuery] int? queueId, [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
        {
            try
            {
                var moderatorId = _userContext.GetModeratorId();
                var isAdmin = _userContext.IsAdmin();

                if (!queueId.HasValue)
                    return BadRequest(new { success = false, error = "queueId is required", statusCode = 400 });

                // Verify queue access
                var queue = await _db.Queues.FindAsync(queueId.Value);
                if (queue == null)
                    return NotFound(new { success = false, error = "Queue not found", statusCode = 404 });

                if (!isAdmin && queue.ModeratorId != moderatorId)
                    return Forbid();

                var query = _ttlQueries.QueryTrash(30)
                    .Where(p => p.QueueId == queueId.Value)
                    .AsQueryable();

                var total = await query.CountAsync();
                var patients = await query
                    .OrderByDescending(p => p.DeletedAt)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(p => new
                    {
                        p.Id,
                        p.FullName,
                        p.PhoneNumber,
                        p.Position,
                        p.Status,
                        p.DeletedAt,
                        DaysRemainingInTrash = _ttlQueries.GetDaysRemainingInTrash(p, 30),
                        p.DeletedBy
                    })
                    .ToListAsync();

                return Ok(new { success = true, data = patients, total, page, pageSize });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching trash patients");
                return StatusCode(500, new { message = "Error fetching trash patients" });
            }
        }

    // GET /api/patients/archived?queueId=1&page=1&pageSize=10
    // Admin-only endpoint to view archived patients (soft-deleted 30+ days ago).
        [HttpGet("archived")]
        [Authorize(Roles = "primary_admin,secondary_admin")]
        public async Task<IActionResult> GetArchived([FromQuery] int? queueId, [FromQuery] int page = 1, [FromQuery] int pageSize = 10)
        {
            try
            {
                if (!queueId.HasValue)
                    return BadRequest(new { success = false, error = "queueId is required", statusCode = 400 });

                var query = _ttlQueries.QueryArchived(30)
                    .Where(p => p.QueueId == queueId.Value)
                    .AsQueryable();

                var total = await query.CountAsync();
                var patients = await query
                    .OrderByDescending(p => p.DeletedAt)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(p => new
                    {
                        p.Id,
                        p.FullName,
                        p.PhoneNumber,
                        p.Position,
                        p.Status,
                        p.DeletedAt,
                        DaysDeleted = p.DeletedAt.HasValue ? (int)(DateTime.UtcNow - p.DeletedAt.Value).TotalDays : 0,
                        p.DeletedBy,
                        Note = "Read-only: Restore window expired"
                    })
                    .ToListAsync();

                return Ok(new { success = true, data = patients, total, page, pageSize });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching archived patients");
                return StatusCode(500, new { message = "Error fetching archived patients" });
            }
        }

        /// <summary>
        /// POST /api/patients/{id}/restore
        /// Restore a soft-deleted patient from trash.
        /// </summary>
        [HttpPost("{id}/restore")]
        [Authorize(Roles = "primary_admin,secondary_admin,moderator")]
        public async Task<IActionResult> Restore(int id)
        {
            try
            {
                var moderatorId = _userContext.GetModeratorId();
                var isAdmin = _userContext.IsAdmin();

                var patient = await _db.Patients.IgnoreQueryFilters().FirstOrDefaultAsync(p => p.Id == id);
                if (patient == null)
                    return NotFound(new { success = false, error = "Patient not found", statusCode = 404 });

                // Verify queue access
                var queue = await _db.Queues.FindAsync(patient.QueueId);
                if (queue == null)
                    return NotFound(new { success = false, error = "Patient's queue not found", statusCode = 404 });

                if (!isAdmin && queue.ModeratorId != moderatorId)
                    return Forbid();

                // Check if patient is not deleted
                if (!patient.IsDeleted)
                    return BadRequest(new { success = false, error = "Patient is not in trash", statusCode = 400 });

                // Check TTL
                if (!_ttlQueries.IsRestoreAllowed(patient, 30))
                {
                    var daysElapsed = patient.DeletedAt.HasValue
                        ? (int)(DateTime.UtcNow - patient.DeletedAt.Value).TotalDays
                        : 0;
                    return Conflict(new
                    {
                        success = false,
                        error = $"Restore window has expired. Patient was deleted {daysElapsed} days ago; restore is allowed within 30 days.",
                        errorCode = "restore_window_expired",
                        statusCode = 409,
                        metadata = new { daysElapsed, ttlDays = 30 }
                    });
                }

                // Get current user ID for audit
                var userId = int.Parse(User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "0");
                var operationTimestamp = DateTime.UtcNow;

                // Restore patient with snapshot timestamp and audit fields
                patient.IsDeleted = false;
                patient.DeletedAt = null;
                patient.DeletedBy = null;
                patient.RestoredAt = operationTimestamp;
                patient.RestoredBy = userId;
                patient.UpdatedAt = operationTimestamp;
                patient.UpdatedBy = userId;
                _db.Patients.Update(patient);
                await _db.SaveChangesAsync();

                return Ok(new { success = true, data = patient, statusCode = 200 });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error restoring patient {PatientId}", id);
                return StatusCode(500, new { message = "Error restoring patient" });
            }
        }
    }
}
