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
    /// Handles browser exception detection utilities
    /// </summary>
    public interface IBrowserExceptionService
    {
        // Determines if the exception indicates a closed browser scenario
        bool IsBrowserClosedException(Exception ex);
    }

    /// <summary>
    /// Handles network connectivity checks
    /// </summary>
    public interface INetworkService
    {
        Task<bool> CheckInternetConnectivityAsync();
    }
}
