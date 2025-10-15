using ClinicsManagementService.Models;

namespace ClinicsManagementService.Services.Interfaces
{
    public interface IWhatsAppService
    {
        Task<bool> CheckInternetConnectivityAsync();
        Task<IBrowserSession> PrepareSessionAsync();
        Task<OperationResult<string?>> SendMessageWithIconTypeAsync(
            string phoneNumber, string message, IBrowserSession browserSession);
        Task<OperationResult<string?>> ExecuteWithRetryAsync(
            Func<Task<OperationResult<string?>>> taskFunc,
            int maxAttempts,
            Func<OperationResult<string?>, bool>? shouldRetryResult = null,
            Func<Exception, bool>? isRetryable = null);
        string SanitizeSelector(string selector);
        Task TakeScreenshotAsync(IBrowserSession browserSession, string path);
        Task DisposeBrowserSessionAsync(IBrowserSession browserSession);

        // New utility methods
        Task<OperationResult<bool>> CheckWhatsAppNumberAsync(string phoneNumber, IBrowserSession browserSession);
        Task<OperationResult<bool>> CheckInternetConnectivityDetailedAsync();
    }
}