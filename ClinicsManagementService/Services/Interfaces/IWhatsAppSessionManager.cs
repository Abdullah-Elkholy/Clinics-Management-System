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
    }
}
