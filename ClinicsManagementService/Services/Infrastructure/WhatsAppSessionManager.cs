using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.Services.Domain;
using ClinicsManagementService.Models;
using ClinicsManagementService.Configuration;
using Microsoft.Playwright;
using System.Collections.Concurrent;

namespace ClinicsManagementService.Services.Infrastructure
{
    /// <summary>
    /// Disposable lock handle that releases the semaphore when disposed
    /// </summary>
    public sealed class OperationLockHandle : IDisposable
    {
        private readonly SemaphoreSlim _semaphore;
        private readonly int _moderatorId;
        private readonly INotifier _notifier;
        private bool _disposed;

        public OperationLockHandle(SemaphoreSlim semaphore, int moderatorId, INotifier notifier)
        {
            _semaphore = semaphore;
            _moderatorId = moderatorId;
            _notifier = notifier;
        }

        public void Dispose()
        {
            if (!_disposed)
            {
                _disposed = true;
                _semaphore.Release();
                _notifier.Notify($"🔓 [Moderator {_moderatorId}] Operation lock released");
            }
        }
    }

    public class WhatsAppSessionManager : IWhatsAppSessionManager
    {
        private readonly INotifier _notifier;
        private readonly Func<int, IBrowserSession> _browserSessionFactory;
        
        // Dictionary of sessions keyed by moderatorId
        private readonly ConcurrentDictionary<int, IBrowserSession> _sessions = new();
        
        // Dictionary of initialization flags keyed by moderatorId
        private readonly ConcurrentDictionary<int, bool> _isInitialized = new();

        // Provider session identifiers (GUID per session lifetime)
        private readonly ConcurrentDictionary<int, string> _providerSessionIds = new();
        
        // Dictionary of semaphores per moderator for concurrency control
        private readonly ConcurrentDictionary<int, SemaphoreSlim> _sessionLocks = new();
        
        // Dictionary of operation locks per moderator (for entire operation lifecycle)
        private readonly ConcurrentDictionary<int, SemaphoreSlim> _operationLocks = new();
        
        // Global lock for dictionary operations
        private readonly SemaphoreSlim _dictionaryLock = new(1, 1);

        public Task<IBrowserSession?> GetCurrentSessionAsync(int moderatorId)
        {
            _sessions.TryGetValue(moderatorId, out var session);
            return Task.FromResult(session);
        }

        public WhatsAppSessionManager(
            INotifier notifier,
            Func<int, IBrowserSession> browserSessionFactory)
        {
            _notifier = notifier;
            _browserSessionFactory = browserSessionFactory;
        }

        public async Task<IBrowserSession> GetOrCreateSessionAsync(int moderatorId)
        {
            // Get or create moderator-specific lock
            var moderatorLock = _sessionLocks.GetOrAdd(moderatorId, _ => new SemaphoreSlim(1, 1));
            
            // Acquire lock with timeout to prevent deadlock
            bool lockAcquired = await moderatorLock.WaitAsync(TimeSpan.FromSeconds(60));
            if (!lockAcquired)
            {
                throw new TimeoutException($"Failed to acquire session lock for moderator {moderatorId} within 60 seconds");
            }

            try
            {
                // Check if session exists and is initialized
                if (_sessions.TryGetValue(moderatorId, out var existingSession) && 
                    _isInitialized.TryGetValue(moderatorId, out var isInit) && isInit)
                {
                    _notifier.Notify($"🔄 [Moderator {moderatorId}] Using existing WhatsApp session");
                    return existingSession;
                }

                _notifier.Notify($"🆕 [Moderator {moderatorId}] Creating new WhatsApp session");
                var session = _browserSessionFactory(moderatorId);
                _sessions[moderatorId] = session;
                _providerSessionIds.TryAdd(moderatorId, Guid.NewGuid().ToString("N"));

                try
                {
                    await InitializeSessionAsync(moderatorId, session);
                    _isInitialized[moderatorId] = true;
                    return session;
                }
                catch (Exception ex)
                {
                    _notifier.Notify($"❌ [Moderator {moderatorId}] Failed to initialize session: {ex.Message}");
                    _sessions.TryRemove(moderatorId, out _);
                    _isInitialized[moderatorId] = false;
                    _providerSessionIds.TryRemove(moderatorId, out _);
                    throw;
                }
            }
            finally
            {
                moderatorLock.Release();
            }
        }

        private async Task InitializeSessionAsync(int moderatorId, IBrowserSession session)
        {
            _notifier.Notify($"🚀 [Moderator {moderatorId}] Initializing WhatsApp session...");
            await session.InitializeAsync();

            _notifier.Notify($"🌐 [Moderator {moderatorId}] Navigating to WhatsApp Web...");
            await session.NavigateToAsync(WhatsAppConfiguration.WhatsAppBaseUrl);
            _notifier.Notify($"✅ [Moderator {moderatorId}] WhatsApp session initialized successfully");
        }

        public async Task<bool> IsSessionReadyAsync(int moderatorId)
        {
            if (!_sessions.TryGetValue(moderatorId, out var session) || 
                !_isInitialized.TryGetValue(moderatorId, out var isInit) || !isInit)
                return false;

            try
            {
                // Quick check for basic UI elements to determine if session is ready
                // This is a lightweight check, not the full authentication flow
                foreach (var selector in WhatsAppConfiguration.ChatUIReadySelectors)
                {
                    try
                    {
                        var element = await session.QuerySelectorAsync(selector);
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

        public async Task DisposeSessionAsync(int moderatorId)
        {
            var moderatorLock = _sessionLocks.GetOrAdd(moderatorId, _ => new SemaphoreSlim(1, 1));
            await moderatorLock.WaitAsync();
            
            try
            {
                if (_sessions.TryRemove(moderatorId, out var session))
                {
                    _notifier.Notify($"🗑️ [Moderator {moderatorId}] Disposing WhatsApp session");
                    await session.DisposeAsync();
                    _isInitialized[moderatorId] = false;
                    _providerSessionIds.TryRemove(moderatorId, out _);
                }
            }
            finally
            {
                moderatorLock.Release();
            }
        }

        public async Task DisposeAllSessionsAsync()
        {
            _notifier.Notify("🗑️ Disposing all WhatsApp sessions...");
            
            var disposeTasks = _sessions.Keys.Select(moderatorId => DisposeSessionAsync(moderatorId));
            await Task.WhenAll(disposeTasks);
            
            _sessions.Clear();
            _isInitialized.Clear();
            _providerSessionIds.Clear();
            
            _notifier.Notify("✅ All WhatsApp sessions disposed");
        }

        public string? GetProviderSessionId(int moderatorId)
        {
            _providerSessionIds.TryGetValue(moderatorId, out var id);
            return id;
        }

        public async Task<IDisposable?> AcquireOperationLockAsync(int moderatorId, int timeoutMs = 60000)
        {
            var operationLock = _operationLocks.GetOrAdd(moderatorId, _ => new SemaphoreSlim(1, 1));
            
            _notifier.Notify($"🔒 [Moderator {moderatorId}] Attempting to acquire operation lock...");
            
            bool acquired = await operationLock.WaitAsync(timeoutMs);
            if (!acquired)
            {
                _notifier.Notify($"⏱️ [Moderator {moderatorId}] Failed to acquire operation lock - another operation in progress");
                return null;
            }
            
            _notifier.Notify($"🔐 [Moderator {moderatorId}] Operation lock acquired");
            return new OperationLockHandle(operationLock, moderatorId, _notifier);
        }
    }
}
