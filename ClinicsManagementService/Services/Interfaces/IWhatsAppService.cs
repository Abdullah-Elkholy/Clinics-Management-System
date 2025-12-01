using ClinicsManagementService.Models;
using System.Threading;

namespace ClinicsManagementService.Services.Interfaces
{
    public interface IWhatsAppService
    {
        Task<bool> CheckInternetConnectivityAsync();
        Task<IBrowserSession> PrepareSessionAsync(int moderatorId);
        Task<OperationResult<string?>> SendMessageWithIconTypeAsync(
            string phoneNumber, string message, IBrowserSession browserSession, CancellationToken cancellationToken = default);
        string SanitizeSelector(string selector);
        Task TakeScreenshotAsync(IBrowserSession browserSession, string path);
        Task DisposeBrowserSessionAsync(IBrowserSession browserSession);

        // New utility methods
        Task<OperationResult<bool>> CheckWhatsAppNumberAsync(string phoneNumber, IBrowserSession browserSession, CancellationToken cancellationToken = default);
        Task<OperationResult<bool>> CheckInternetConnectivityDetailedAsync();
    }
}
