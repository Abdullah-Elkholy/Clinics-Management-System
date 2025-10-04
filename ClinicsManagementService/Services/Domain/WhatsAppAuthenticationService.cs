using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.Models;
using ClinicsManagementService.Configuration;
using Microsoft.Playwright;

namespace ClinicsManagementService.Services.Domain
{
    /// <summary>
    /// Handles WhatsApp authentication and session management
    /// </summary>
    public class WhatsAppAuthenticationService : IWhatsAppAuthenticationService
    {
        private readonly INotifier _notifier;
        private readonly IScreenshotService _screenshotService;

        public WhatsAppAuthenticationService(INotifier notifier, IScreenshotService screenshotService)
        {
            _notifier = notifier;
            _screenshotService = screenshotService;
        }

        public async Task EnsureAuthenticatedAsync(IBrowserSession browserSession)
        {
            await TrackLoadingScreensAsync(browserSession);

            bool screenshotTakenUI = false;
            bool screenshotTakenText = false;
            int elapsed = 0;

            while (elapsed < WhatsAppConfiguration.DefaultAuthenticationMaxWaitMs)
            {
                // Run continuous monitoring during authentication
                var monitoringResult = await ContinuousMonitoringAsync(browserSession, WhatsAppConfiguration.DefaultAuthenticationPollIntervalMs);
                if (monitoringResult != null)
                {
                    _notifier.Notify($"Authentication interrupted: {monitoringResult.Error}");
                    return; // Authentication or progress bar issue detected
                }

                var (needsAuth, updatedScreenshotTakenUI, updatedScreenshotTakenText) = await CheckForAuthenticationRequiredAsync(browserSession, screenshotTakenUI, screenshotTakenText);
                screenshotTakenUI = updatedScreenshotTakenUI;
                screenshotTakenText = updatedScreenshotTakenText;

                if (!needsAuth)
                {
                    await TrackLoadingScreensAsync(browserSession);
                    _notifier.Notify("WhatsApp session is authenticating...");

                    // Use ChatUIReadySelectors from configuration
                    bool chatReady = false;
                    foreach (var headerSelector in WhatsAppConfiguration.ChatUIReadySelectors)
                    {
                        var header = await browserSession.QuerySelectorAsync(headerSelector);
                        if (header != null)
                        {
                            chatReady = true;
                            break;
                        }
                    }
                    if (chatReady)
                    {
                        _notifier.Notify("WhatsApp session is authenticated and ready.");
                        return;
                    }
                }

                await Task.Delay(WhatsAppConfiguration.DefaultAuthenticationPollIntervalMs);
                elapsed += WhatsAppConfiguration.DefaultAuthenticationPollIntervalMs;
            }

            throw new TimeoutException("Authentication (QR code scan) not completed in time. User did not scan QR code or session did not become ready.");
        }

        public async Task TrackLoadingScreensAsync(IBrowserSession browserSession)
        {
            // Progress bar detection using configuration selectors
            foreach (var selector in WhatsAppConfiguration.ProgressBarSelectors)
            {
                var progressBar = await browserSession.QuerySelectorAsync(selector);
                if (progressBar != null)
                {
                    _notifier.Notify($"WhatsApp loading progress detected ({selector}). Please be patient...");
                }
            }

            // Loading text detection using configuration
            foreach (var prompt in WhatsAppConfiguration.LoginPromptTexts)
            {
                var loadingTextElem = await browserSession.QuerySelectorAsync($"text={prompt}");
                if (loadingTextElem != null)
                {
                    var loadingText = await loadingTextElem.InnerTextAsync();
                    _notifier.Notify($"WhatsApp loading: {loadingText}. Please be patient...");
                }
            }

            // ARIA-label based loading detection using configuration
            foreach (var selector in WhatsAppConfiguration.ProgressBarSelectors.Where(s => s.Contains("aria-label")))
            {
                var ariaLoadingElem = await browserSession.QuerySelectorAsync(selector);
                if (ariaLoadingElem != null)
                {
                    var ariaLabel = await ariaLoadingElem.GetAttributeAsync("aria-label");
                    _notifier.Notify($"WhatsApp loading (ARIA): {ariaLabel}. Please be patient...");
                }
            }
        }

        /// <summary>
        /// Continuous monitoring for progress bars and authentication issues
        /// This method runs as a side job to interrupt waiting operations
        /// </summary>
        private async Task<WhatsAppAuthenticationResult?> ContinuousMonitoringAsync(IBrowserSession browserSession, int timeoutMs = 5000)
        {
            try
            {
                // Check for progress bars using configuration
                foreach (var progressSelector in WhatsAppConfiguration.ProgressBarSelectors)
                {
                    try
                    {
                        var progress = await browserSession.QuerySelectorAsync(progressSelector);
                        if (progress != null)
                        {
                            _notifier.Notify($"⏳ Progress bar detected during monitoring ({progressSelector}) - waiting for completion");

                            // Wait for progress bar to disappear with shorter timeout
                            try
                            {
                                await browserSession.WaitForSelectorAsync(progressSelector, timeoutMs, WaitForSelectorState.Detached);
                                _notifier.Notify($"✅ Progress bar disappeared ({progressSelector})");
                            }
                            catch (Exception progressEx)
                            {
                                _notifier.Notify($"⚠️ Progress bar wait timeout: {progressEx.Message}");
                            }
                            break;
                        }
                    }
                    catch (Exception ex)
                    {
                        _notifier.Notify($"⚠️ Error checking progress selector {progressSelector}: {ex.Message}");
                    }
                }

                // Check for authentication issues using configuration
                foreach (var selector in WhatsAppConfiguration.QrCodeSelectors)
                {
                    try
                    {
                        var authElement = await browserSession.QuerySelectorAsync(selector);
                        if (authElement != null)
                        {
                            _notifier.Notify($"🔐 Authentication issue detected during monitoring ({selector})");
                            return WhatsAppAuthenticationResult.PendingQR("WhatsApp authentication required. Please scan QR code.");
                        }
                    }
                    catch (Exception ex)
                    {
                        _notifier.Notify($"⚠️ Error checking auth selector {selector}: {ex.Message}");
                    }
                }

                // Check for logout indicators in URL
                try
                {
                    var currentUrl = await browserSession.GetUrlAsync();
                    if (currentUrl.Contains("post_logout") || currentUrl.Contains("logout_reason"))
                    {
                        _notifier.Notify("🔐 Logout detected during monitoring - session needs authentication");
                        return WhatsAppAuthenticationResult.PendingQR("WhatsApp session expired. Please scan QR code.");
                    }
                }
                catch (Exception ex)
                {
                    _notifier.Notify($"⚠️ Error checking URL during monitoring: {ex.Message}");
                }

                return null; // No issues detected
            }
            catch (Exception ex)
            {
                _notifier.Notify($"⚠️ Error in continuous monitoring: {ex.Message}");
                return null;
            }
        }

        private async Task<(bool needsAuth, bool screenshotTakenUI, bool screenshotTakenText)> CheckForAuthenticationRequiredAsync(IBrowserSession browserSession, bool screenshotTakenUI, bool screenshotTakenText)
        {
            // Check UI-based selectors
            foreach (var qrSelector in WhatsAppConfiguration.QrCodeSelectors)
            {
                var qrElem = await browserSession.QuerySelectorAsync(qrSelector);
                if (qrElem != null)
                {
                    var boundingBox = await qrElem.BoundingBoxAsync();
                    if (boundingBox != null)
                    {
                        _notifier.Notify("QR code captured. Please scan it using your WhatsApp mobile app.");

                        if (!screenshotTakenUI)
                        {
                            string screenshotPath = $"Screenshots/qr_login_UI_{DateTime.Now:yyyyMMdd_HHmmss}.png";
                            await _screenshotService.TakeScreenshotAsync(browserSession, screenshotPath);
                            screenshotTakenUI = true;
                            _notifier.Notify($"WhatsApp session is expired or unavailable. QR code/login page detected (selector: {qrSelector}). Please scan the QR code to log in. Screenshot: {screenshotPath}");
                        }
                        return (true, screenshotTakenUI, screenshotTakenText);
                    }
                }
            }

            // Check text-based selectors
            foreach (var prompt in WhatsAppConfiguration.LoginPromptTexts)
            {
                var elem = await browserSession.QuerySelectorAsync($"text={prompt}");
                if (elem != null)
                {
                    if (!screenshotTakenText)
                    {
                        string screenshotPath = $"Screenshots/qr_login_text_{DateTime.Now:yyyyMMdd_HHmmss}.png";
                        await _screenshotService.TakeScreenshotAsync(browserSession, screenshotPath);
                        screenshotTakenText = true;
                        _notifier.Notify($"WhatsApp session is expired or unavailable. Login prompt detected (text: '{prompt}'). Please scan the QR code to log in. Screenshot: {screenshotPath}");
                    }
                    return (true, screenshotTakenUI, screenshotTakenText);
                }
            }

            return (false, screenshotTakenUI, screenshotTakenText);
        }
    }
}
