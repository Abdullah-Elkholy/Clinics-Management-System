using ClinicsManagementService.Services.Domain;

namespace ClinicsManagementService.Services.Interfaces
{
    /// <summary>
    /// Singleton session manager for WhatsApp browser sessions
    /// </summary>
    public interface IWhatsAppSessionManager
    {
        Task<IBrowserSession> GetOrCreateSessionAsync();
        Task<bool> IsSessionReadyAsync();
        Task DisposeSessionAsync();
        Task<bool> IsAuthenticatedAsync();
        Task WaitForAuthenticationAsync();
    }
}
