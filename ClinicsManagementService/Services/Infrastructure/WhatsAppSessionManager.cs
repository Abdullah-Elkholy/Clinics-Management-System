using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.Services.Domain;
using ClinicsManagementService.Models;
using ClinicsManagementService.Configuration;
using ClinicsManagementService.Services;
using Microsoft.Playwright;

namespace ClinicsManagementService.Services.Infrastructure
{
    public class WhatsAppSessionManager : IWhatsAppSessionManager
    {
        private readonly INotifier _notifier;
        private readonly Func<IBrowserSession> _browserSessionFactory;
        private IBrowserSession? _session;
        private bool _isInitialized = false;
        private readonly object _lock = new object();

        public Task<IBrowserSession?> GetCurrentSessionAsync()
        {
            return Task.FromResult(_session);
        }

        public WhatsAppSessionManager(
            INotifier notifier,
            Func<IBrowserSession> browserSessionFactory)
        {
            _notifier = notifier;
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

            // Reset manual close flag if session supports it (for PlaywrightBrowserSession)
            if (_session is PlaywrightBrowserSession playwrightSession)
            {
                playwrightSession.ResetManualCloseFlag();
            }

            _notifier.Notify("🚀 Initializing WhatsApp session...");
            await _session.InitializeAsync();

            _notifier.Notify("🌐 Navigating to WhatsApp Web...");
            await _session.NavigateToAsync(WhatsAppConfiguration.WhatsAppBaseUrl);
            _notifier.Notify("✅ WhatsApp session initialized successfully");
            _isInitialized = true; // Mark session as initialized after successful setup
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
