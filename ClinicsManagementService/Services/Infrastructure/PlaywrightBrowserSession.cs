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
        private readonly SemaphoreSlim _lock = new(1, 1); // For operation thread safety
        private readonly SemaphoreSlim _initLock = new(1, 1); // For initialization/recreation safety

        // Helper that runs an operation under the page lock and retries once if the page/target was closed during the operation.
        private async Task<T> WithPageRetryAsync<T>(Func<Task<T>> operation)
        {
            // Ensure page is ready before trying
            await EnsurePageInitializedAsync();

            bool lockTaken = false;
            try
            {
                await _lock.WaitAsync();
                lockTaken = true;
                return await operation();
            }
            catch (Exception ex) when (ex is PlaywrightException)
            {
                Console.Error.WriteLine($"Playwright target/page closed during operation: {ex.Message}");
                // Release lock if held
                if (lockTaken)
                {
                    try { _lock.Release(); } catch { }
                    lockTaken = false;
                }

                // Try to recreate page and retry once
                try
                {
                    await EnsurePageInitializedAsync();
                    await _lock.WaitAsync();
                    lockTaken = true;
                    return await operation();
                }
                catch (Exception retryEx)
                {
                    Console.Error.WriteLine($"Retry after page recreation failed: {retryEx.Message}");
                    throw;
                }
            }
            finally
            {
                if (lockTaken)
                {
                    try { _lock.Release(); } catch { }
                }
            }
        }

        private async Task WithPageRetryAsync(Func<Task> operation)
        {
            await WithPageRetryAsync<object>(async () => { await operation(); return null!; });
        }

        public async Task InitializeAsync()
        {
            await EnsurePageInitializedAsync();
        }

        private async Task EnsurePageInitializedAsync()
        {
            await _initLock.WaitAsync();
            try
            {
                if (_playwright == null)
                {
                    _playwright = await Playwright.CreateAsync();
                }

                if (_browser == null)
                {
                    Directory.CreateDirectory(WhatsAppConfiguration.SessionDirectory);
                    _browser = await _playwright.Chromium.LaunchPersistentContextAsync(
                        WhatsAppConfiguration.SessionDirectory,
                        new BrowserTypeLaunchPersistentContextOptions
                        {
                            Headless = false,
                            Args = new[]
                            {
                                "--disable-blink-features=AutomationControlled",
                                "--window-size=1280,800",
                                "--start-maximized",
                            }
                        }
                    );
                }

                // If browser exists but pages closed or page is null/closed, create a new page
                bool needNewPage = false;
                if (_page == null) needNewPage = true;
                else
                {
                    try { if (_page.IsClosed) needNewPage = true; } catch { needNewPage = true; }
                }

                if (needNewPage)
                {
                    _page = _browser.Pages.Count > 0 ? _browser.Pages[0] : await _browser.NewPageAsync();
                    // Log and instrument page close
                    try
                    {
                        _page.Close += (_, _) => Console.Error.WriteLine($"Playwright page closed event at {DateTime.UtcNow:O}");
                    }
                    catch { /* ignore if attach fails */ }
                    Console.Error.WriteLine($"Playwright page recreated at {DateTime.UtcNow:O}");
                }
            }
            finally
            {
                _initLock.Release();
            }
        }

        public async Task NavigateToAsync(string url)
        {
            await WithPageRetryAsync(async () =>
            {
                await EnsurePageInitializedAsync();
                if (_page == null) throw new InvalidOperationException("Browser not initialized");
                await _page.GotoAsync(url);
            });
        }
        // Waits for a selector to reach a specific state (Visible, Attached, Detached).
        public async Task WaitForSelectorAsync(string selector, int? timeout = null, WaitForSelectorState state = WaitForSelectorState.Visible)
        {
            await WithPageRetryAsync(async () =>
            {
                await EnsurePageInitializedAsync();
                if (_page == null) throw new InvalidOperationException("Browser not initialized");
                try
                {
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
                    try
                    {
                        url = _page?.Url ?? "unavailable";
                        if (_page != null)
                            await _page.ScreenshotAsync(new PageScreenshotOptions { Path = $"Screenshots/timeout_{DateTime.Now:yyyyMMdd_HHmmss}.png" });
                    }
                    catch { url = "unavailable"; }
                    Console.Error.WriteLine($"Timeout waiting for selector '{selector}' (state: {state}) on URL: {url}. {ex.Message}");
                    throw;
                }
                catch (Exception ex)
                {
                    string url = "unknown";
                    try
                    {
                        url = _page?.Url ?? "unavailable";
                        if (_page != null)
                            await _page.ScreenshotAsync(new PageScreenshotOptions { Path = $"Screenshots/error_{DateTime.Now:yyyyMMdd_HHmmss}.png" });
                    }
                    catch { url = "unavailable"; }
                    Console.Error.WriteLine($"Error waiting for selector '{selector}' (state: {state}) on URL: {url}. {ex.Message}");
                    throw;
                }
            });
        }

        public async Task<IElementHandle?> QuerySelectorAsync(string selector)
        {
            return await WithPageRetryAsync(async () =>
            {
                await EnsurePageInitializedAsync();
                if (_page == null) throw new InvalidOperationException("Browser not initialized");
                try
                {
                    return await _page.QuerySelectorAsync(selector);
                }
                catch (PlaywrightException ex)
                {
                    Console.Error.WriteLine($"Error querying selector '{selector}': {ex.Message}");
                    throw;
                }
            });
        }

        // Returns all elements matching the selector as a list of IElementHandle.
        public async Task<IReadOnlyList<IElementHandle>> QuerySelectorAllAsync(string selector)
        {
            return await WithPageRetryAsync(async () =>
            {
                await EnsurePageInitializedAsync();
                if (_page == null) throw new InvalidOperationException("Browser not initialized");
                return await _page.QuerySelectorAllAsync(selector);
            });
        }

        public async Task<string> GetUrlAsync()
        {
            return await WithPageRetryAsync(async () =>
            {
                await EnsurePageInitializedAsync();
                if (_page == null)
                    throw new InvalidOperationException("Browser session not initialized");

                return _page.Url;
            });
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
                // Log disposal errors but don't rethrow; disposal should be best-effort
                Console.Error.WriteLine($"Error disposing Playwright session (ignored): {ex.Message}");
            }
            finally
            {
                _lock.Release();
            }
        }
    }
}
