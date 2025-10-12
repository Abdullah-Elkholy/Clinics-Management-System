using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Playwright;

namespace ClinicsManagementService.Services
{
    public class PlaywrightBrowserSession : IBrowserSession
    {
        private IPlaywright? _playwright;
        private IBrowserContext? _browser;
        private IPage? _page;
        private readonly string _sessionDir;
        private readonly SemaphoreSlim _lock = new(1, 1); // For thread safety

        public PlaywrightBrowserSession(string sessionDir)
        {
            _sessionDir = sessionDir;
        }

        public async Task InitializeAsync()
        {
            await _lock.WaitAsync();
            try
            {
                _playwright = await Playwright.CreateAsync();
                Directory.CreateDirectory(_sessionDir);
                _browser = await _playwright.Chromium.LaunchPersistentContextAsync(
                    _sessionDir,
                    new BrowserTypeLaunchPersistentContextOptions
                    {
                        Headless = false,
                        ViewportSize = null,
                        Args = new[] { "--start-maximized" }
                    }
                );
                _page = _browser.Pages.Count > 0 ? _browser.Pages[0] : await _browser.NewPageAsync();
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Error initializing Playwright session: {ex.Message}");
                throw;
            }
            finally
            {
                _lock.Release();
            }
        }
        // WaitForAuthenticationAsync removed; logic will be handled by EnsureAuthenticatedAsync in WhatsAppService

        public async Task NavigateToAsync(string url)
        {
            await _lock.WaitAsync();
            try
            {
                if (_page == null) throw new InvalidOperationException("Browser not initialized");
                await _page.GotoAsync(url);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Error navigating to '{url}': {ex.Message}");
                throw;
            }
            finally
            {
                _lock.Release();
            }
        }
        /// <summary>
        /// Waits for a selector to reach a specific state (Visible, Attached, Detached).
        /// </summary>
        public async Task WaitForSelectorAsync(string selector, int? timeout = null, WaitForSelectorState state = WaitForSelectorState.Visible)
        {
            await _lock.WaitAsync();
            try
            {
                if (_page == null) throw new InvalidOperationException("Browser not initialized");
                await _page.WaitForSelectorAsync(
                    selector,
                    new PageWaitForSelectorOptions
                    {
                        Timeout = (timeout.HasValue && timeout > 0) ? timeout : null,
                        State = state
                    }
                );
            }
            catch (TimeoutException ex)
            {
                string url = "unknown";
                if (_page != null)
                {
                    try { url = _page.Url; } catch { url = "unavailable"; }
                }
                if (_page != null)
                {
                    try { await _page.ScreenshotAsync(new PageScreenshotOptions { Path = $"Screenshots/timeout_{DateTime.Now:yyyyMMdd_HHmmss}.png" }); } catch { }
                }
                Console.Error.WriteLine($"Timeout waiting for selector '{selector}' (state: {state}) on URL: {url}. {ex.Message}");
                throw;
            }
            catch (Exception ex)
            {
                string url = "unknown";
                if (_page != null)
                {
                    try { url = _page.Url; } catch { url = "unavailable"; }
                }
                Console.Error.WriteLine($"Error waiting for selector '{selector}' (state: {state}) on URL: {url}. {ex.Message}");
                throw;
            }
            finally
            {
                _lock.Release();
            }
        }
        /// <summary>
        /// Waits for WhatsApp Web to be fully ready: loading bar gone, and chat/message UI visible.
        /// </summary>
        public async Task WaitForWhatsAppReadyAsync(int timeoutMs = 60000)
        {
            // Wait for loading/progress bar to disappear (if present)
            await WaitForSelectorAsync("div[role='progressbar']", timeout: timeoutMs, state: WaitForSelectorState.Detached);
            // Wait for message input box to be visible (main UI ready)
            await WaitForSelectorAsync("div[role='textbox']", timeout: timeoutMs, state: WaitForSelectorState.Visible);
            // Optionally, also wait for chat list container
            // await WaitForSelectorAsync("div[aria-label='Chat list']", timeout: timeoutMs, state: WaitForSelectorState.Visible);
        }

        public async Task<IElementHandle?> QuerySelectorAsync(string selector)
        {
            await _lock.WaitAsync();
            try
            {
                if (_page == null) throw new InvalidOperationException("Browser not initialized");
                return await _page.QuerySelectorAsync(selector);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Error querying selector '{selector}': {ex.Message}");
                throw;
            }
            finally
            {
                _lock.Release();
            }
        }

        /// <summary>
        /// Returns all elements matching the selector as a list of IElementHandle.
        /// </summary>
        public async Task<IReadOnlyList<IElementHandle>> QuerySelectorAllAsync(string selector)
        {
            await _lock.WaitAsync();
            try
            {
                if (_page == null) throw new InvalidOperationException("Browser not initialized");
                return await _page.QuerySelectorAllAsync(selector);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Error querying all selectors '{selector}': {ex.Message}");
                throw;
            }
            finally
            {
                _lock.Release();
            }
        }

        public async ValueTask DisposeAsync()
        {
            await _lock.WaitAsync();
            try
            {
                if (_browser != null)
                    await _browser.CloseAsync();
                _playwright?.Dispose();
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Error disposing Playwright session: {ex.Message}");
                throw;
            }
            finally
            {
                _lock.Release();
            }
        }
    }
}
