using Microsoft.Extensions.Options;
using Clinics.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Clinics.Domain;

namespace Clinics.Api.Services.Extension
{
    /// <summary>
    /// Factory for selecting the appropriate WhatsApp provider based on configuration and availability.
    /// </summary>
    public interface IWhatsAppProviderFactory
    {
        /// <summary>
        /// Get the appropriate provider for the given moderator.
        /// </summary>
        Task<(IWhatsAppProvider provider, string providerName)> GetProviderAsync(int moderatorUserId);
    }

    /// <summary>
    /// Implementation of WhatsApp provider factory.
    /// Selects between Extension and Playwright based on configuration and extension availability.
    /// </summary>
    public class WhatsAppProviderFactory : IWhatsAppProviderFactory
    {
        private readonly WhatsAppProviderOptions _options;
        private readonly IWhatsAppProvider _extensionProvider;
        private readonly IExtensionLeaseService _leaseService;
        private readonly ApplicationDbContext _db;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;
        private readonly ILogger<WhatsAppProviderFactory> _logger;

        public WhatsAppProviderFactory(
            IOptions<WhatsAppProviderOptions> options,
            IWhatsAppProvider extensionProvider,
            IExtensionLeaseService leaseService,
            ApplicationDbContext db,
            IHttpClientFactory httpClientFactory,
            IConfiguration configuration,
            ILogger<WhatsAppProviderFactory> logger)
        {
            _options = options.Value;
            _extensionProvider = extensionProvider;
            _leaseService = leaseService;
            _db = db;
            _httpClientFactory = httpClientFactory;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<(IWhatsAppProvider provider, string providerName)> GetProviderAsync(int moderatorUserId)
        {
            // If extension mode is enabled, check if moderator has an active extension session
            if (_options.UseExtension)
            {
                var hasActiveLease = await HasActiveExtensionLeaseAsync(moderatorUserId);
                
                if (hasActiveLease)
                {
                    _logger.LogDebug("Using Extension provider for moderator {ModeratorId}", moderatorUserId);
                    return (_extensionProvider, "Extension");
                }
                
                // Extension enabled but no active lease
                if (!_options.FallbackToPlaywright)
                {
                    _logger.LogWarning("Extension enabled but no active lease for moderator {ModeratorId}, no fallback configured", 
                        moderatorUserId);
                    // Return extension provider anyway - it will handle the error appropriately
                    return (_extensionProvider, "Extension");
                }
                
                _logger.LogDebug("Falling back to Playwright for moderator {ModeratorId} (no active extension lease)", 
                    moderatorUserId);
            }

            // Use Playwright provider (via HTTP to ClinicsManagementService)
            // Note: This returns a wrapper that calls the existing WhatsAppServiceSender
            _logger.LogDebug("Using Playwright provider for moderator {ModeratorId}", moderatorUserId);
            return (new PlaywrightProviderWrapper(_httpClientFactory, _configuration, _logger), "Playwright");
        }

        private async Task<bool> HasActiveExtensionLeaseAsync(int moderatorUserId)
        {
            var lease = await _leaseService.GetActiveLeaseAsync(moderatorUserId);
            return lease != null;
        }
    }

    /// <summary>
    /// Wrapper around the existing Playwright-based service (WhatsAppServiceSender).
    /// Calls the ClinicsManagementService via HTTP.
    /// </summary>
    internal class PlaywrightProviderWrapper : IWhatsAppProvider
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly string _baseUrl;
        private readonly ILogger _logger;

        public PlaywrightProviderWrapper(
            IHttpClientFactory httpClientFactory,
            IConfiguration configuration,
            ILogger logger)
        {
            _httpClientFactory = httpClientFactory;
            _baseUrl = configuration["WhatsAppServiceUrl"] ?? "http://localhost:5185";
            _logger = logger;
        }

        public string ProviderName => "Playwright";

        public Task<bool> IsAvailableAsync(int moderatorUserId)
        {
            // Playwright is always available (it will handle its own errors)
            return Task.FromResult(true);
        }

        public async Task<WhatsAppSendResult> SendMessageAsync(Message message, CancellationToken cancellationToken = default)
        {
            try
            {
                var client = _httpClientFactory.CreateClient();
                client.BaseAddress = new Uri(_baseUrl);
                client.Timeout = TimeSpan.FromSeconds(300); // 5 minute timeout

                // Build the full phone number from country code and patient phone
                var phoneNumber = $"{message.CountryCode}{message.PatientPhone?.TrimStart('0')}";

                var payload = new
                {
                    moderatorId = message.ModeratorId,
                    phoneNumber = phoneNumber,
                    text = message.Content
                };

                var response = await client.PostAsJsonAsync("/api/whatsapp/send", payload, cancellationToken);
                var content = await response.Content.ReadAsStringAsync(cancellationToken);

                if (response.IsSuccessStatusCode)
                {
                    return WhatsAppSendResult.SuccessResult("Playwright", content);
                }

                // Handle specific error states
                if (content.Contains("PendingQR", StringComparison.OrdinalIgnoreCase))
                {
                    return WhatsAppSendResult.PendingQR("Playwright service requires QR scan");
                }
                
                if (content.Contains("PendingNET", StringComparison.OrdinalIgnoreCase))
                {
                    return WhatsAppSendResult.FailedResult("Playwright service has network issues");
                }

                return WhatsAppSendResult.FailedResult($"Playwright service error: {content}");
            }
            catch (TaskCanceledException)
            {
                return WhatsAppSendResult.FailedResult("Playwright service timeout");
            }
            catch (HttpRequestException ex)
            {
                _logger.LogError(ex, "HTTP error calling Playwright service for message {MessageId}", message.Id);
                return WhatsAppSendResult.FailedResult($"Playwright service connection error: {ex.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error calling Playwright service for message {MessageId}", message.Id);
                return WhatsAppSendResult.FailedResult($"Playwright service error: {ex.Message}");
            }
        }

        public async Task<string> GetSessionStatusAsync(int moderatorUserId)
        {
            try
            {
                var client = _httpClientFactory.CreateClient();
                client.BaseAddress = new Uri(_baseUrl);

                var response = await client.GetAsync($"/api/whatsapp/session/{moderatorUserId}/status");
                
                if (response.IsSuccessStatusCode)
                {
                    var content = await response.Content.ReadAsStringAsync();
                    return content.Contains("connected", StringComparison.OrdinalIgnoreCase) ? "connected" : "disconnected";
                }

                return "unknown";
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error getting session status for moderator {ModeratorId}", moderatorUserId);
                return "error";
            }
        }
    }
}
