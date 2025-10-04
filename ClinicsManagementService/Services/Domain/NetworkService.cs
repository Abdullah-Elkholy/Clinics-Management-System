using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.Models;
using ClinicsManagementService.Configuration;

namespace ClinicsManagementService.Services.Domain
{
    /// <summary>
    /// Handles network connectivity checks
    /// </summary>
    public class NetworkService : INetworkService
    {
        private readonly INotifier _notifier;

        public NetworkService(INotifier notifier)
        {
            _notifier = notifier;
        }

        public async Task<bool> CheckInternetConnectivityAsync()
        {
            try
            {
                using var client = new HttpClient();
                var response = await client.GetAsync(WhatsAppConfiguration.WhatsAppBaseUrl);
                return response.IsSuccessStatusCode;
            }
            catch (Exception ex)
            {
                _notifier.Notify($"Internet connectivity check failed: {ex.Message}");
                return false;
            }
        }
    }
}
