using ClinicsManagementService.Models;

namespace ClinicsManagementService.Services.Interfaces
{
    public interface IWhatsAppService
    {
        Task<bool> CheckInternetConnectivityAsync();
        Task<IBrowserSession> PrepareSessionAsync(string sessionDir, IBrowserSession browserSession);
        Task<(bool Success, string? Error)> NavigateAndCheckRecipientAsync(
            IBrowserSession browserSession, string phoneNumber);
        Task<(bool Sent, string? IconType, string? Error)> DeliverMessageAsync(
            IBrowserSession browserSession, string message, string? phoneNumber, int msgTimeRetryCount, int maxMsgTimeoutRetryCount);
        Task TrackWhatsAppLoadingScreensAsync(IBrowserSession browserSession);
        Task WaitForWhatsAppReadyAsync(IBrowserSession browserSession);
        Task<(bool Sent, string? IconType, string? Error)> SendMessageWithIconTypeAsync(
            string phoneNumber, string message, IBrowserSession browserSession);
        Task<(bool Sent, string? IconType, string? Error)> ExecuteWithRetryAsync(
            Func<Task<(bool Sent, string? IconType, string? Error)>> taskFunc, int maxAttempts,
            Func<Exception, bool>? treatAsRetryable);
        Task EnsureAuthenticatedAsync(IBrowserSession browserSession, int pollIntervalMs, int maxWaitMs);
        string SanitizeSelector(string selector);
        Task TakeScreenshotAsync(IBrowserSession browserSession, string path);
        Task DisposeBrowserSessionAsync(IBrowserSession browserSession);
    }
}