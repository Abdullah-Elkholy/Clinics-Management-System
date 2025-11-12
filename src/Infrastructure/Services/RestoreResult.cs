using System;

namespace Clinics.Infrastructure.Services
{
    /// <summary>
    /// Result of a restore operation, indicating success or specific failure reason.
    /// Used to distinguish between TTL expiration, business rule violations, and other errors.
    /// </summary>
    public class RestoreResult
    {
        /// <summary>
        /// Indicates whether the restore operation succeeded.
        /// </summary>
        public bool Success { get; set; }

        /// <summary>
        /// HTTP status code to return to the client.
        /// 200 = success, 404 = not found, 409 = conflict (TTL expired or rule violation).
        /// </summary>
        public int StatusCode { get; set; }

        /// <summary>
        /// Machine-readable error code for client-side handling.
        /// Examples: restore_window_expired, quota_insufficient, default_template_replacement_required.
        /// </summary>
        public string? ErrorCode { get; set; }

        /// <summary>
        /// Human-readable error message.
        /// </summary>
        public string? Message { get; set; }

        /// <summary>
        /// Optional metadata (e.g., days elapsed, quota needed, etc.)
        /// </summary>
        public object? Metadata { get; set; }

        /// <summary>
        /// Static factory for successful restore.
        /// </summary>
        public static RestoreResult SuccessResult()
            => new() { Success = true, StatusCode = 200 };

        /// <summary>
        /// Static factory for TTL-expired restore attempt.
        /// </summary>
        public static RestoreResult RestoreWindowExpired(int daysElapsed, int ttlDays = 30)
            => new()
            {
                Success = false,
                StatusCode = 409,
                ErrorCode = "restore_window_expired",
                Message = $"Restore window has expired. Item was deleted {daysElapsed} days ago; restore is allowed within {ttlDays} days.",
                Metadata = new { daysElapsed, ttlDays }
            };

        /// <summary>
        /// Static factory for quota insufficient error.
        /// </summary>
        public static RestoreResult QuotaInsufficient(string quotaType, int available, int required)
            => new()
            {
                Success = false,
                StatusCode = 409,
                ErrorCode = "quota_insufficient",
                Message = $"{quotaType} quota insufficient: {available} available, {required} required.",
                Metadata = new { quotaType, available, required }
            };

        /// <summary>
        /// Static factory for default template replacement required.
        /// </summary>
        public static RestoreResult DefaultTemplateReplacementRequired()
            => new()
            {
                Success = false,
                StatusCode = 409,
                ErrorCode = "default_template_replacement_required",
                Message = "Cannot restore a default template without providing a replacement.",
                Metadata = null
            };

        /// <summary>
        /// Static factory for moderator protection (admin deletion blocked).
        /// </summary>
        public static RestoreResult AdminProtectionViolation(string reason)
            => new()
            {
                Success = false,
                StatusCode = 409,
                ErrorCode = "admin_protection_violation",
                Message = reason,
                Metadata = null
            };

        /// <summary>
        /// Static factory for not found.
        /// </summary>
        public static RestoreResult NotFound(string entityType, int id)
            => new()
            {
                Success = false,
                StatusCode = 404,
                ErrorCode = "entity_not_found",
                Message = $"{entityType} with ID {id} not found.",
                Metadata = null
            };

        /// <summary>
        /// Static factory for generic error.
        /// </summary>
        public static RestoreResult Error(string message)
            => new()
            {
                Success = false,
                StatusCode = 500,
                ErrorCode = "restore_failed",
                Message = message,
                Metadata = null
            };
    }
}
