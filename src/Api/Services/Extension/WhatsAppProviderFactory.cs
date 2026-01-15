using Microsoft.Extensions.Options;
using Clinics.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Clinics.Domain;

namespace Clinics.Api.Services.Extension
{
    /// <summary>
    /// Factory for selecting the appropriate WhatsApp provider.
    /// Currently only supports the browser extension provider.
    /// </summary>
    public interface IWhatsAppProviderFactory
    {
        /// <summary>
        /// Get the provider for the given moderator.
        /// </summary>
        Task<(IWhatsAppProvider provider, string providerName)> GetProviderAsync(int moderatorUserId);
    }

    /// <summary>
    /// Implementation of WhatsApp provider factory.
    /// Uses the browser extension as the sole provider.
    /// </summary>
    public class WhatsAppProviderFactory : IWhatsAppProviderFactory
    {
        private readonly WhatsAppProviderOptions _options;
        private readonly IWhatsAppProvider _extensionProvider;
        private readonly IExtensionLeaseService _leaseService;
        private readonly ILogger<WhatsAppProviderFactory> _logger;

        public WhatsAppProviderFactory(
            IOptions<WhatsAppProviderOptions> options,
            IWhatsAppProvider extensionProvider,
            IExtensionLeaseService leaseService,
            ILogger<WhatsAppProviderFactory> logger)
        {
            _options = options.Value;
            _extensionProvider = extensionProvider;
            _leaseService = leaseService;
            _logger = logger;
        }

        public async Task<(IWhatsAppProvider provider, string providerName)> GetProviderAsync(int moderatorUserId)
        {
            // Check if moderator has an active extension session
            var hasActiveLease = await HasActiveExtensionLeaseAsync(moderatorUserId);
            
            if (hasActiveLease)
            {
                _logger.LogDebug("Using Extension provider for moderator {ModeratorId}", moderatorUserId);
            }
            else
            {
                _logger.LogWarning("No active extension lease for moderator {ModeratorId}. Extension provider will handle the error.", 
                    moderatorUserId);
            }

            // Always return the extension provider - it will handle missing lease errors appropriately
            return (_extensionProvider, "Extension");
        }

        private async Task<bool> HasActiveExtensionLeaseAsync(int moderatorUserId)
        {
            var lease = await _leaseService.GetActiveLeaseAsync(moderatorUserId);
            return lease != null;
        }
    }
}

