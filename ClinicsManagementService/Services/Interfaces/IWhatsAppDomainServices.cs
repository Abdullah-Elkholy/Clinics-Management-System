using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.Models;
using ClinicsManagementService.Configuration;
using Microsoft.Playwright;

namespace ClinicsManagementService.Services.Domain
{
    /// <summary>
    /// Handles WhatsApp UI interactions and element detection
    /// </summary>
    public interface IWhatsAppUIService
    {
    Task<OperationResult<bool>> WaitForPageLoadAsync(IBrowserSession browserSession, string[] selectors, int timeoutMs = WhatsAppConfiguration.DefaultMaxMonitoringWaitMs, int checkIntervalMs = WhatsAppConfiguration.defaultChecksFrequencyDelayMs);
    Task<OperationResult<bool>?> ContinuousMonitoringAsync(IBrowserSession browserSession, int delayMs = WhatsAppConfiguration.defaultChecksFrequencyDelayMs, int maxWaitMs = WhatsAppConfiguration.DefaultMaxMonitoringWaitMs);
    Task<OperationResult<bool>> NavigateToRecipientAsync(IBrowserSession browserSession, string phoneNumber);
    Task<OperationResult<string?>> DeliverMessageAsync(IBrowserSession browserSession, string message, string? phoneNumber = null);
        Task<MessageStatus> GetLastOutgoingMessageStatusAsync(IBrowserSession browserSession, string messageText);
    Task<OperationResult<bool>> WaitWithMonitoringAsync(IBrowserSession browserSession, Func<Task<bool>> waitCondition, int timeoutMs = WhatsAppConfiguration.DefaultMaxMonitoringWaitMs, int checkIntervalMs = WhatsAppConfiguration.defaultChecksFrequencyDelayMs);
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
        // Determines if the exception indicates a closed browser scenario
        bool IsBrowserClosedException(Exception ex);
        // Retry-aware helper for operations that return OperationResult<T>.
        // The shouldRetryResult predicate can inspect the returned OperationResult and decide whether to retry.
        Task<OperationResult<T>> ExecuteWithRetryAsync<T>(Func<Task<OperationResult<T>>> operation, int maxAttempts = WhatsAppConfiguration.DefaultMaxRetryAttempts, Func<OperationResult<T>, bool>? shouldRetryResult = null, Func<Exception, bool>? isRetryable = null);
    }

    /// <summary>
    /// Handles network connectivity checks
    /// </summary>
    public interface INetworkService
    {
        Task<bool> CheckInternetConnectivityAsync();
    }
}
