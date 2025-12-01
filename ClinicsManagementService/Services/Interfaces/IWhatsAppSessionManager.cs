using ClinicsManagementService.Services.Domain;

namespace ClinicsManagementService.Services.Interfaces
{
    /// <summary>
    /// Session manager for WhatsApp browser sessions - manages multiple sessions per moderator
    /// </summary>
    public interface IWhatsAppSessionManager
    {
        Task<IBrowserSession> GetOrCreateSessionAsync(int moderatorId);
        Task<bool> IsSessionReadyAsync(int moderatorId);
        Task DisposeSessionAsync(int moderatorId);
        Task<IBrowserSession?> GetCurrentSessionAsync(int moderatorId);
        Task DisposeAllSessionsAsync();
        string? GetProviderSessionId(int moderatorId);
        
        /// <summary>
        /// Acquires an exclusive operation lock for a moderator.
        /// Use this to ensure only one operation (restore, send, check) runs at a time.
        /// Returns an IDisposable that releases the lock when disposed.
        /// </summary>
        /// <param name="moderatorId">Moderator ID to lock</param>
        /// <param name="timeoutMs">Timeout in milliseconds (default 60000 = 60 seconds)</param>
        /// <returns>IDisposable lock handle, or null if lock could not be acquired</returns>
        Task<IDisposable?> AcquireOperationLockAsync(int moderatorId, int timeoutMs = 60000);
    }
}
