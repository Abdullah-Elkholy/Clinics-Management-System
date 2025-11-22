using ClinicsManagementService.Models;

namespace ClinicsManagementService.Services.Interfaces
{
    /// <summary>
    /// Service for optimizing and managing WhatsApp session storage
    /// </summary>
    public interface IWhatsAppSessionOptimizer
    {
        /// <summary>
        /// Optimizes session after authentication by cleaning caches and creating backup
        /// </summary>
        Task OptimizeAuthenticatedSessionAsync();

        /// <summary>
        /// Optimizes current session by cleaning caches only (no backup creation)
        /// </summary>
        Task OptimizeCurrentSessionOnlyAsync();

        /// <summary>
        /// Restores session from compressed backup
        /// </summary>
        Task RestoreFromBackupAsync();

        /// <summary>
        /// Gets current session health metrics
        /// </summary>
        Task<SessionHealthMetrics> GetHealthMetricsAsync();

        /// <summary>
        /// Checks session size and auto-restores if threshold exceeded
        /// </summary>
        Task CheckAndAutoRestoreIfNeededAsync();
    }
}
