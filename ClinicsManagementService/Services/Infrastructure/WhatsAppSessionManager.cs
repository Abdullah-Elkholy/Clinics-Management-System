using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.Services.Domain;
using ClinicsManagementService.Models;
using ClinicsManagementService.Configuration;
using Microsoft.Playwright;

namespace ClinicsManagementService.Services.Infrastructure
{
    public class WhatsAppSessionManager : IWhatsAppSessionManager
    {
        private readonly INotifier _notifier;
        private readonly IWhatsAppAuthenticationService _authenticationService;
        private readonly Func<IBrowserSession> _browserSessionFactory;
        private IBrowserSession? _session;
        private bool _isInitialized = false;
        private readonly object _lock = new object();

        public WhatsAppSessionManager(
            INotifier notifier,
            IWhatsAppAuthenticationService authenticationService,
            Func<IBrowserSession> browserSessionFactory)
        {
            _notifier = notifier;
            _authenticationService = authenticationService;
            _browserSessionFactory = browserSessionFactory;
        }

        public async Task<IBrowserSession> GetOrCreateSessionAsync()
        {
            if (_session != null && _isInitialized)
            {
                _notifier.Notify("🔄 Using existing WhatsApp session");
                return _session;
            }

            lock (_lock)
            {
                if (_session != null && _isInitialized)
                {
                    return _session;
                }

                _notifier.Notify("🆕 Creating new WhatsApp session");
                _session = _browserSessionFactory();
            }

            try
            {
                await InitializeSessionAsync();
                return _session;
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Failed to initialize session: {ex.Message}");
                _session = null;
                _isInitialized = false;
                throw;
            }
        }

        private async Task InitializeSessionAsync()
        {
            if (_session == null) return;

            _notifier.Notify("🚀 Initializing WhatsApp session...");
            await _session.InitializeAsync();
            
            _notifier.Notify("🌐 Navigating to WhatsApp Web...");
            await _session.NavigateToAsync(WhatsAppConfiguration.WhatsAppBaseUrl);
            
            await _authenticationService.TrackLoadingScreensAsync(_session);
            _notifier.Notify("⏳ Waiting for WhatsApp to be ready...");
            
            await _authenticationService.EnsureAuthenticatedAsync(_session);
            _isInitialized = true;
            
            _notifier.Notify("✅ WhatsApp session initialized successfully");
        }

        public async Task<bool> IsSessionReadyAsync()
        {
            if (_session == null || !_isInitialized)
                return false;

            try
            {
                // Quick check for basic UI elements to determine if session is ready
                // This is a lightweight check, not the full authentication flow
                foreach (var selector in WhatsAppConfiguration.ChatUIReadySelectors)
                {
                    try
                    {
                        var element = await _session.QuerySelectorAsync(selector);
                        if (element != null)
                        {
                            return true; // Found at least one UI element, session is ready
                        }
                    }
                    catch
                    {
                        // Continue checking other selectors
                    }
                }

                return false; // No UI elements found, session not ready
            }
            catch
            {
                return false;
            }
        }

        private async Task HandleProgressBarsForCheckAsync(IBrowserSession browserSession)
        {
            try
            {
                _notifier.Notify("🔍 Checking for progress bars and loading indicators...");

                foreach (var progressSelector in WhatsAppConfiguration.ProgressBarSelectors)
                {
                    try
                    {
                        var progress = await browserSession.QuerySelectorAsync(progressSelector);
                        if (progress != null)
                        {
                            _notifier.Notify($"⏳ Progress/loading bar detected ({progressSelector}), waiting for it to disappear...");

                            // Wait for progress bar to disappear with shorter timeout for session check
                            try
                            {
                                await browserSession.WaitForSelectorAsync(progressSelector, 10000, WaitForSelectorState.Detached);
                                _notifier.Notify($"✅ Progress/loading bar disappeared ({progressSelector})");
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

                _notifier.Notify("✅ Progress bar handling completed");
            }
            catch (Exception ex)
            {
                _notifier.Notify($"⚠️ Error in progress bar handling: {ex.Message}");
            }
        }

        public async Task<bool> IsAuthenticatedAsync()
        {
            if (_session == null || !_isInitialized)
                return false;

            try
            {
                // Check if we're on the main WhatsApp page (not QR login)
                string currentUrl = await _session.GetUrlAsync();
                if (currentUrl.Contains("post_logout") || currentUrl.Contains("logout_reason"))
                    return false;

                // Check for QR code presence
                IElementHandle? qrCode = await _session.QuerySelectorAsync("div[data-ref]");
                if (qrCode != null)
                    return false;

                // Check for main UI elements
                IElementHandle? textbox = await _session.QuerySelectorAsync("div[role='textbox']");
                return textbox != null;
            }
            catch
            {
                return false;
            }
        }

        public async Task WaitForAuthenticationAsync()
        {
            if (_session == null || !_isInitialized)
                return;

            _notifier.Notify("⏳ Waiting for WhatsApp authentication...");
            await _authenticationService.EnsureAuthenticatedAsync(_session);
        }

        public async Task DisposeSessionAsync()
        {
            if (_session != null)
            {
                _notifier.Notify("🗑️ Disposing WhatsApp session");
                await _session.DisposeAsync();
                _session = null;
                _isInitialized = false;
            }
        }
    }
}
