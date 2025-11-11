/**
 * Patient Position Service
 * File: src/Api/Services/PatientPositionService.cs
 * 
 * Handles patient position updates with atomic conflict resolution.
 * When moving a patient to a position occupied by another patient:
 * - The moved patient takes the target position.
 * - The occupant and all patients with position >= target increment by 1.
 * - All changes occur in a single transaction.
 */

using Clinics.Domain;
using Clinics.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Clinics.Api.Services;

public interface IPatientPositionService
{
    /// <summary>
    /// Update a patient's position with atomic conflict resolution.
    /// Position < 1 is coerced to 1 and conflicts are handled.
    /// </summary>
    Task<(bool Success, string ErrorMessage)> UpdatePatientPositionAsync(int patientId, int targetPosition);
}

public class PatientPositionService : IPatientPositionService
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<PatientPositionService> _logger;

    public PatientPositionService(ApplicationDbContext db, ILogger<PatientPositionService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<(bool Success, string ErrorMessage)> UpdatePatientPositionAsync(int patientId, int targetPosition)
    {
        try
        {
            // Load patient
            var patient = await _db.Patients
                .FirstOrDefaultAsync(p => p.Id == patientId && !p.IsDeleted);

            if (patient == null)
            {
                return (false, "patient_not_found");
            }

            // Coerce position < 1 to 1
            if (targetPosition < 1)
            {
                targetPosition = 1;
            }

            // Check if already at target position (no-op)
            if (patient.Position == targetPosition)
            {
                return (true, "");
            }

            int queueId = patient.QueueId;

            // Capture operation timestamp for consistency
            var operationTimestamp = DateTime.UtcNow;

            // Wrap in transaction for atomicity
            await using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                // Get all active patients in the same queue for comparison
                var activePatients = await _db.Patients
                    .Where(p => p.QueueId == queueId && !p.IsDeleted)
                    .ToListAsync();

                // Determine if we're moving backward (lower position) or forward (higher position)
                int currentPos = patient.Position;
                bool movingBackward = targetPosition < currentPos;

                if (movingBackward)
                {
                    // Moving backward: shift patients from targetPosition to currentPos-1 forward by +1
                    // Example: move from 8 to 2 -> patients at 2,4,5,7 shift to 3,5,6,8
                    var toShift = activePatients
                        .Where(p => p.Id != patientId && p.Position >= targetPosition && p.Position < currentPos)
                        .ToList();

                    foreach (var p in toShift)
                    {
                        p.Position++;
                    }
                }
                else
                {
                    // Moving forward: shift patients from currentPos+1 to targetPosition backward by -1
                    // This isn't typical in your use case but handle it for completeness
                    var toShift = activePatients
                        .Where(p => p.Id != patientId && p.Position > currentPos && p.Position <= targetPosition)
                        .ToList();

                    foreach (var p in toShift)
                    {
                        p.Position--;
                    }
                }

                // Set the moved patient to the target position
                patient.Position = targetPosition;
                patient.UpdatedAt = operationTimestamp;

                await _db.SaveChangesAsync();
                await transaction.CommitAsync();

                _logger.LogInformation(
                    "Patient {PatientId} position updated from {OldPosition} to {NewPosition} in queue {QueueId} at {Timestamp}",
                    patientId, currentPos, targetPosition, queueId, operationTimestamp);

                return (true, "");
            }
            catch
            {
                await transaction.RollbackAsync();
                throw;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error updating patient position for patient {PatientId}", patientId);
            return (false, "error_updating_position");
        }
    }
}
