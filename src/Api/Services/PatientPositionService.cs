/**
 * Patient Position Service
 * File: src/Api/Services/PatientPositionService.cs
 * 
 * Handles patient position updates with atomic conflict resolution.
 * Business rule: Conflict-first strategy
 * - First checks if target position is already occupied
 * - If not occupied, places patient at target position without shifting
 * - If occupied, shifts ALL active patients at position >= targetPosition by +1
 * - No backward shifting; gaps in positions are allowed
 * - All changes occur in a single transaction for atomicity
 */

using Clinics.Domain;
using Clinics.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Clinics.Api.Services;

public interface IPatientPositionService
{
    /// <summary>
    /// Update a patient's position with atomic conflict resolution.
    /// Position less than 1 is coerced to 1 and conflicts are handled.
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
                // Store original position for logging
                int originalPosition = patient.Position;

                // Check if target position is already occupied by another patient
                var conflictingPatient = await _db.Patients
                    .FirstOrDefaultAsync(p => p.QueueId == queueId && !p.IsDeleted && 
                                               p.Id != patientId && p.Position == targetPosition);

                int shiftedCount = 0;

                if (conflictingPatient == null)
                {
                    // No conflict: simply place patient at target position without shifting
                    patient.Position = targetPosition;
                    patient.UpdatedAt = operationTimestamp;

                    await _db.SaveChangesAsync();
                    await transaction.CommitAsync();

                    _logger.LogInformation(
                        "Patient {PatientId} position updated from {OldPosition} to {NewPosition} in queue {QueueId}. No conflicts, no shifting required.",
                        patientId, originalPosition, targetPosition, queueId);
                }
                else
                {
                    // Conflict exists: apply shift strategy
                    // Shift ALL active patients at position >= targetPosition by +1
                    // This creates an empty slot at targetPosition for the moving patient
                    var patientsToShift = await _db.Patients
                        .Where(p => p.QueueId == queueId && !p.IsDeleted && p.Id != patientId && p.Position >= targetPosition)
                        .OrderByDescending(p => p.Position) // Process from highest to lowest to avoid conflicts
                        .ToListAsync();

                    foreach (var p in patientsToShift)
                    {
                        p.Position++;
                        p.UpdatedAt = operationTimestamp;
                    }

                    shiftedCount = patientsToShift.Count;

                    // Set the moved patient to the target position
                    patient.Position = targetPosition;
                    patient.UpdatedAt = operationTimestamp;

                    await _db.SaveChangesAsync();
                    await transaction.CommitAsync();

                    _logger.LogInformation(
                        "Patient {PatientId} position updated from {OldPosition} to {NewPosition} in queue {QueueId}. Conflict detected, shifted {ShiftedCount} patients forward.",
                        patientId, originalPosition, targetPosition, queueId, shiftedCount);
                }

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
