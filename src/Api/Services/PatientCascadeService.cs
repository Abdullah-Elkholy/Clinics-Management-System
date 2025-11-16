/**
 * Patient Cascade Service - Soft Delete Handler
 * File: src/Api/Services/PatientCascadeService.cs
 * 
 * Handles soft-deletes for patients
 * Simple cascade - just soft-delete the patient record
 */

using Clinics.Domain;
using Clinics.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Clinics.Api.Services;

public interface IPatientCascadeService
{
    /// <summary>
    /// Soft-delete a patient
    /// </summary>
    Task<(bool Success, string ErrorMessage)> SoftDeletePatientAsync(int patientId, int deletedByUserId);

    /// <summary>
    /// Restore a previously soft-deleted patient
    /// </summary>
    Task<(bool Success, string ErrorMessage)> RestorePatientAsync(int patientId, int? restoredBy = null);

    /// <summary>
    /// Get soft-deleted patients for a queue (trash)
    /// </summary>
    Task<(List<Patient> Items, int TotalCount)> GetTrashPatientsAsync(int queueId, int pageNumber, int pageSize);

    /// <summary>
    /// Get permanently deleted patients (archived - over 30 days)
    /// </summary>
    Task<(List<Patient> Items, int TotalCount)> GetArchivedPatientsAsync(int queueId, int pageNumber, int pageSize);

    /// <summary>
    /// Permanently delete archived patients (cron job)
    /// </summary>
    Task<int> PermanentlyDeleteArchivedPatientsAsync();
}

public class PatientCascadeService : IPatientCascadeService
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<PatientCascadeService> _logger;
    private const int TTL_DAYS = 30;

    public PatientCascadeService(ApplicationDbContext db, ILogger<PatientCascadeService> logger)
    {
        _db = db;
        _logger = logger;
    }

    public async Task<(bool Success, string ErrorMessage)> SoftDeletePatientAsync(int patientId, int deletedByUserId)
    {
        try
        {
            var patient = await _db.Patients
                .FirstOrDefaultAsync(p => p.Id == patientId && !p.IsDeleted);

            if (patient == null)
            {
                return (false, "Patient not found");
            }

            // Mark patient as deleted
            patient.IsDeleted = true;
            patient.DeletedAt = DateTime.UtcNow;
            patient.DeletedBy = deletedByUserId;

            await _db.SaveChangesAsync();

            _logger.LogInformation(
                "Patient {PatientId} soft-deleted by user {UserId} at {Timestamp}",
                patientId, deletedByUserId, DateTime.UtcNow);

            return (true, "");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error soft-deleting patient {PatientId}", patientId);
            return (false, "An error occurred while deleting the patient");
        }
    }

    public async Task<(bool Success, string ErrorMessage)> RestorePatientAsync(int patientId, int? restoredBy = null)
    {
        try
        {
            var patient = await _db.Patients
                .FirstOrDefaultAsync(p => p.Id == patientId && p.IsDeleted);

            if (patient == null)
            {
                return (false, "Deleted patient not found");
            }

            // Check if within 30-day window
            if (!patient.DeletedAt.HasValue)
            {
                return (false, "Deletion timestamp missing");
            }

            var daysDeleted = (DateTime.UtcNow - patient.DeletedAt.Value).TotalDays;
            if (daysDeleted > TTL_DAYS)
            {
                return (false, "restore_window_expired");
            }

            // Capture operation snapshot timestamp to ensure consistency
            var operationTimestamp = DateTime.UtcNow;

            // Restore patient with snapshot timestamp and audit fields
            patient.IsDeleted = false;
            patient.DeletedAt = null;
            patient.DeletedBy = null;
            patient.RestoredAt = operationTimestamp;
            patient.RestoredBy = restoredBy;
            patient.UpdatedAt = operationTimestamp;
            patient.UpdatedBy = restoredBy;

            await _db.SaveChangesAsync();

            _logger.LogInformation(
                "Patient {PatientId} restored at {Timestamp}",
                patientId, DateTime.UtcNow);

            return (true, "");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error restoring patient {PatientId}", patientId);
            return (false, "An error occurred while restoring the patient");
        }
    }

    public async Task<(List<Patient> Items, int TotalCount)> GetTrashPatientsAsync(int queueId, int pageNumber, int pageSize)
    {
        var query = _db.Patients
            .Where(p => p.QueueId == queueId && p.IsDeleted && p.DeletedAt.HasValue && (DateTime.UtcNow - p.DeletedAt.Value).TotalDays <= TTL_DAYS)
            .OrderByDescending(p => p.DeletedAt);

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, totalCount);
    }

    public async Task<(List<Patient> Items, int TotalCount)> GetArchivedPatientsAsync(int queueId, int pageNumber, int pageSize)
    {
        var query = _db.Patients
            .Where(p => p.QueueId == queueId && p.IsDeleted && p.DeletedAt.HasValue && (DateTime.UtcNow - p.DeletedAt.Value).TotalDays > TTL_DAYS)
            .OrderByDescending(p => p.DeletedAt);

        var totalCount = await query.CountAsync();
        var items = await query
            .Skip((pageNumber - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync();

        return (items, totalCount);
    }

    public async Task<int> PermanentlyDeleteArchivedPatientsAsync()
    {
        var archivedPatients = await _db.Patients
            .Where(p => p.IsDeleted && p.DeletedAt.HasValue && (DateTime.UtcNow - p.DeletedAt.Value).TotalDays > TTL_DAYS)
            .ToListAsync();

        _db.Patients.RemoveRange(archivedPatients);
        int deleted = await _db.SaveChangesAsync();
        _logger.LogInformation("Permanently deleted {Count} archived patients", deleted);
        return deleted;
    }
}
