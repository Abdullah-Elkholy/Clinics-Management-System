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
    }
}
