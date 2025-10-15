using ClinicsManagementService.Services.Interfaces;

namespace ClinicsManagementService.Services.Domain
{
    public class ScreenshotService : IScreenshotService
    {
        public async Task TakeScreenshotAsync(IBrowserSession browserSession, string path)
        {
            // Dummy implementation for now
            await Task.CompletedTask;
        }
        public string SanitizeSelector(string selector)
        {
            return selector.Replace("/", "_").Replace("\\", "_");
        }
    }
}
