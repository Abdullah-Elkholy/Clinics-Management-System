using System;
using System.Threading;
using System.Threading.Tasks;
using ClinicsManagementService.Configuration;
using ClinicsManagementService.Services.Interfaces;
using Microsoft.Playwright;

namespace ClinicsManagementService.Services
{
    public class PlaywrightBrowserSession : IBrowserSession
    {
        private IPlaywright? _playwright;
        private IBrowserContext? _browser;
        private IPage? _page;
        private readonly SemaphoreSlim _lock = new(1, 1); // For thread safety

        public async Task InitializeAsync()
        {
            await _lock.WaitAsync();
            try
            {
                _playwright = await Playwright.CreateAsync();
                Directory.CreateDirectory(WhatsAppConfiguration.SessionDirectory);
                _browser = await _playwright.Chromium.LaunchPersistentContextAsync(
                    WhatsAppConfiguration.SessionDirectory,
                    new BrowserTypeLaunchPersistentContextOptions
                    {
                        Headless = false,
                        Args = new[] {
                            "--disable-blink-features=AutomationControlled",
                            "--window-size=1280,800",
                            "--start-maximized",
                            "--no-sandbox",
                        }
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
        // Waits for a selector to reach a specific state (Visible, Attached, Detached).
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
                    try
                    {
                        url = _page.Url;
                        await _page.ScreenshotAsync(new PageScreenshotOptions { Path = $"Screenshots/timeout_{DateTime.Now:yyyyMMdd_HHmmss}.png" });
                    }
                    catch { url = "unavailable"; }
                }
                Console.Error.WriteLine($"Timeout waiting for selector '{selector}' (state: {state}) on URL: {url}. {ex.Message}");
                throw;
            }
            catch (Exception ex)
            {
                string url = "unknown";
                if (_page != null)
                {
                    try
                    {
                        url = _page.Url;
                        await _page.ScreenshotAsync(new PageScreenshotOptions { Path = $"Screenshots/error_{DateTime.Now:yyyyMMdd_HHmmss}.png" });
                    }
                    catch { url = "unavailable"; }
                }
                Console.Error.WriteLine($"Error waiting for selector '{selector}' (state: {state}) on URL: {url}. {ex.Message}");
                throw;
            }
            finally
            {
                _lock.Release();
            }
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

        // Returns all elements matching the selector as a list of IElementHandle.
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

        public async Task<string> GetUrlAsync()
        {
            await _lock.WaitAsync();
            try
            {
                if (_page == null)
                    throw new InvalidOperationException("Browser session not initialized");
                
                return _page.Url;
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Error getting URL: {ex.Message}");
                throw;
            }
            finally
            {
                _lock.Release();
            }
        }

        public async Task ReloadAsync()
        {
            await _lock.WaitAsync();
            try
            {
                if (_page == null)
                    throw new InvalidOperationException("Browser session not initialized");
                
                await _page.ReloadAsync();
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Error reloading page: {ex.Message}");
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
                if (_page != null)
                    await _page.CloseAsync();
                if (_browser != null)
                    await _browser.CloseAsync();
                if (_playwright != null)
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
