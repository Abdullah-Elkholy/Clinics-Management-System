using ClinicsManagementService.Models;

namespace ClinicsManagementService.Services.Interfaces
{
    /// <summary>
    /// Service for optimizing and managing WhatsApp session storage
    /// </summary>
    public interface IWhatsAppSessionOptimizer
    {
        /// <summary>
        /// Optimizes a moderator's session after authentication by cleaning caches and creating backup
        /// </summary>
        Task OptimizeAuthenticatedSessionAsync(int moderatorId);

        /// <summary>
        /// Optimizes a moderator's current session by cleaning caches only (no backup creation)
        /// </summary>
        Task OptimizeCurrentSessionOnlyAsync(int moderatorId);

        /// <summary>
        /// Restores a moderator's session from compressed backup
        /// </summary>
        Task RestoreFromBackupAsync(int moderatorId);

        /// <summary>
        /// Gets a moderator's session health metrics
        /// </summary>
        Task<SessionHealthMetrics> GetHealthMetricsAsync(int moderatorId);

        /// <summary>
        /// Checks a moderator's session size and auto-restores if threshold exceeded
        /// </summary>
        Task CheckAndAutoRestoreIfNeededAsync(int moderatorId);
    }
}
