using Clinics.Domain;

namespace ClinicsManagementService.Services.Interfaces
{
    /// <summary>
    /// Interface for synchronizing WhatsApp session status between filesystem and database
    /// </summary>
    public interface IWhatsAppSessionSyncService
    {
        /// <summary>
        /// Update WhatsApp session status in database
        /// </summary>
        /// <param name="moderatorUserId">Moderator user ID</param>
        /// <param name="status">Status: 'connected', 'disconnected', 'pending'</param>
        /// <param name="lastSyncAt">Optional last sync timestamp</param>
        /// <param name="providerSessionId">Optional provider session identifier</param>
        /// <param name="activityUserId">Optional user ID performing this operation for audit trail</param>
        Task UpdateSessionStatusAsync(int moderatorUserId, string status, DateTime? lastSyncAt = null, string? providerSessionId = null, int? activityUserId = null);

        /// <summary>
        /// Get WhatsApp session status from database
        /// </summary>
        /// <param name="moderatorUserId">Moderator user ID</param>
        /// <returns>WhatsApp session or null if not found</returns>
        Task<WhatsAppSession?> GetSessionStatusAsync(int moderatorUserId);

        /// <summary>
        /// Check if session is paused due to PendingQR (authentication required)
        /// Returns true if there are paused messages or sessions with PendingQR reason
        /// </summary>
        /// <param name="moderatorUserId">Moderator user ID</param>
        /// <returns>True if session is paused due to PendingQR</returns>
        Task<bool> CheckIfSessionPausedDueToPendingQRAsync(int moderatorUserId);

        /// <summary>
        /// Pause WhatsAppSession globally for the specified moderator
        /// This sets IsPaused=true on the WhatsAppSession entity with the specified PauseReason
        /// </summary>
        /// <param name="moderatorUserId">Moderator user ID</param>
        /// <param name="pausedBy">Optional user ID who triggered the pause</param>
        /// <param name="pauseReason">Reason for pause (PendingQR, BrowserClosure, PendingNET, etc.)</param>
        /// <returns>True if session was paused successfully</returns>
        Task<bool> PauseSessionDueToPendingQRAsync(int moderatorUserId, int? pausedBy = null, string pauseReason = "PendingQR");
    }
}
