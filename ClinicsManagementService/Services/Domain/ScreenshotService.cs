using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.Models;
using ClinicsManagementService.Configuration;

namespace ClinicsManagementService.Services.Domain
{
    /// <summary>
    /// Handles screenshot capture and debugging utilities
    /// </summary>
    public class ScreenshotService : IScreenshotService
    {
        private readonly INotifier _notifier;

        public ScreenshotService(INotifier notifier)
        {
            _notifier = notifier;
        }

        public async Task TakeScreenshotAsync(IBrowserSession browserSession, string path)
        {
            try
            {
                if (browserSession is ClinicsManagementService.Services.PlaywrightBrowserSession pbs)
                {
                    var pageField = typeof(ClinicsManagementService.Services.PlaywrightBrowserSession)
                        .GetField("_page", System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance);
                    
                    if (pageField?.GetValue(pbs) is Microsoft.Playwright.IPage page)
                    {
                        Directory.CreateDirectory(System.IO.Path.GetDirectoryName(path)!);
                        await page.ScreenshotAsync(new Microsoft.Playwright.PageScreenshotOptions { Path = path });
                    }
                }
            }
            catch (Exception ex)
            {
                _notifier.Notify($"Failed to take screenshot: {ex.Message}");
            }
        }

        public string SanitizeSelector(string selector)
        {
            foreach (var c in System.IO.Path.GetInvalidFileNameChars())
                selector = selector.Replace(c, '_');
            return selector.Replace(" ", "_").Replace("[", "_").Replace("]", "_").Replace("'", "").Replace("\"", "");
        }
    }
}
