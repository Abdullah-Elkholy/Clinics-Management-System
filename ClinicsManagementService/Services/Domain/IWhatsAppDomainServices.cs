using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.Models;
using ClinicsManagementService.Configuration;
using Microsoft.Playwright;

namespace ClinicsManagementService.Services.Domain
{
    /// <summary>
    /// Handles WhatsApp authentication and session management
    /// </summary>
    public interface IWhatsAppAuthenticationService
    {
        Task EnsureAuthenticatedAsync(IBrowserSession browserSession);
        Task TrackLoadingScreensAsync(IBrowserSession browserSession);
    }

    /// <summary>
    /// Handles WhatsApp UI interactions and element detection
    /// </summary>
    public interface IWhatsAppUIService
    {
        Task WaitForUIReadyAsync(IBrowserSession browserSession);
        Task<NavigationResult> NavigateToRecipientAsync(IBrowserSession browserSession, string phoneNumber);
        Task<MessageDeliveryResult> DeliverMessageAsync(IBrowserSession browserSession, string message, string? phoneNumber = null);
        Task<MessageStatus> GetLastOutgoingMessageStatusAsync(IBrowserSession browserSession, string messageText);
        // Task<IElementHandle?> FindRetryButtonAsync(IBrowserSession browserSession);
    }

    /// <summary>
    /// Handles screenshot capture and debugging utilities
    /// </summary>
    public interface IScreenshotService
    {
        Task TakeScreenshotAsync(IBrowserSession browserSession, string path);
        string SanitizeSelector(string selector);
    }

    /// <summary>
    /// Handles retry logic and error recovery
    /// </summary>
    public interface IRetryService
    {
        Task<T> ExecuteWithRetryAsync<T>(Func<Task<T>> operation, int maxAttempts = WhatsAppConfiguration.DefaultMaxRetryAttempts, Func<Exception, bool>? isRetryable = null);
    }

    /// <summary>
    /// Handles network connectivity checks
    /// </summary>
    public interface INetworkService
    {
        Task<bool> CheckInternetConnectivityAsync();
    }
}
