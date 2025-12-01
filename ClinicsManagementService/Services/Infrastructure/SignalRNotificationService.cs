using ClinicsManagementService.Services.Interfaces;
using Microsoft.Extensions.Configuration;
using System.Text;
using System.Text.Json;

namespace ClinicsManagementService.Services.Infrastructure
{
    /// <summary>
    /// Service for notifying the main API about WhatsAppSession updates via HTTP
    /// The main API will then broadcast these updates via SignalR to connected clients
    /// </summary>
    public class SignalRNotificationService : ISignalRNotificationService
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly INotifier _notifier;
        private readonly string _apiBaseUrl;

        public SignalRNotificationService(IHttpClientFactory httpClientFactory, INotifier notifier, IConfiguration configuration)
        {
            _httpClientFactory = httpClientFactory;
            _notifier = notifier;
            // Get API URL from configuration (default to localhost:5000 for development)
            _apiBaseUrl = configuration.GetValue<string>("ApiBaseUrl") ?? "http://localhost:5000";
        }

        /// <summary>
        /// Notify the main API that a WhatsAppSession has been updated
        /// </summary>
        public async Task NotifyWhatsAppSessionUpdateAsync(int moderatorUserId, string? status = null, bool? isPaused = null, string? pauseReason = null)
        {
            try
            {
                var payload = new
                {
                    moderatorUserId,
                    status,
                    isPaused,
                    pauseReason,
                    timestamp = DateTime.UtcNow
                };

                var json = JsonSerializer.Serialize(payload);
                var content = new StringContent(json, Encoding.UTF8, "application/json");

                var client = _httpClientFactory.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(5); // Short timeout for notifications

                var response = await client.PostAsync($"{_apiBaseUrl}/api/notifications/whatsapp-session-update", content);

                if (response.IsSuccessStatusCode)
                {
                    _notifier.Notify($"📢 [SignalR Notification] Successfully notified API of WhatsAppSession update for moderator {moderatorUserId}");
                }
                else
                {
                    _notifier.Notify($"⚠️ [SignalR Notification] Failed to notify API of WhatsAppSession update for moderator {moderatorUserId}: {response.StatusCode}");
                }
            }
            catch (Exception ex)
            {
                // Don't throw - notification failures shouldn't break the main flow
                _notifier.Notify($"❌ [SignalR Notification] Error notifying API of WhatsAppSession update for moderator {moderatorUserId}: {ex.Message}");
            }
        }
    }
}
