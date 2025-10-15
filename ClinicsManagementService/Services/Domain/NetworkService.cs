using ClinicsManagementService.Services.Interfaces;

namespace ClinicsManagementService.Services.Domain
{
    public class NetworkService : INetworkService
    {
        public async Task<bool> CheckInternetConnectivityAsync()
        {
            // Simple connectivity check (could be improved)
            try
            {
                using var client = new HttpClient();
                var response = await client.GetAsync("https://www.google.com");
                return response.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }
    }
}
