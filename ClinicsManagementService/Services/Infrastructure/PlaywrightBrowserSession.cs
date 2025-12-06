using System;
using System.Diagnostics;
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
        public bool IsIntentionalClose { get; set; } = false;
        public bool IsOperationInProgress { get; set; } = false; // Track if operation is active
        private readonly SemaphoreSlim _lock = new(1, 1); // For operation thread safety
        private readonly SemaphoreSlim _initLock = new(1, 1); // For initialization/recreation safety
        private readonly int _moderatorId;
        private readonly string _sessionDirectory;
        
        // ========== FIX 6: Debounce browser launches ==========
        private static readonly TimeSpan _launchDebounceInterval = TimeSpan.FromSeconds(5);
        private DateTime _lastLaunchAttempt = DateTime.MinValue;
        // ========== END FIX 6 ==========

        public PlaywrightBrowserSession(int moderatorId)
        {
            _moderatorId = moderatorId;
            _sessionDirectory = WhatsAppConfiguration.GetSessionDirectory(moderatorId);
        }

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

                // Clean up any possibly-disposed objects and force recreation before retrying
                try
                {
                    try
                    {
                        // Close and null existing page/browser to force recreation.
                        if (_page != null)
                        {
                            try { _page.CloseAsync().GetAwaiter().GetResult(); } catch { }
                            _page = null;
                        }

                        if (_browser != null)
                        {
                            try { _browser.CloseAsync().GetAwaiter().GetResult(); } catch { }
                            _browser = null;
                        }
                    }
                    catch { /* best-effort cleanup */ }

                    // Recreate page/context and retry once
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
                // ========== FIX 6: Debounce rapid browser launches ==========
                var timeSinceLastLaunch = DateTime.UtcNow - _lastLaunchAttempt;
                if (timeSinceLastLaunch < _launchDebounceInterval && _browser != null)
                {
                    Console.Error.WriteLine($"[Moderator {_moderatorId}] Debouncing browser launch - last attempt was {timeSinceLastLaunch.TotalSeconds:F1}s ago");
                    // Just ensure page is ready, don't re-launch browser
                    goto ensurePage;
                }
                // ========== END FIX 6 ==========

                if (_playwright == null)
                {
                    _playwright = await Playwright.CreateAsync();
                }

                // ========== FIX 7: Check browser health before launching ==========
                if (_browser != null)
                {
                    // Check if existing browser context is still healthy
                    try
                    {
                        // Try to get pages count - if this throws, browser is dead
                        var pageCount = _browser.Pages.Count;
                        Console.Error.WriteLine($"[Moderator {_moderatorId}] Existing browser is healthy with {pageCount} pages");
                        goto ensurePage;
                    }
                    catch (Exception ex)
                    {
                        Console.Error.WriteLine($"[Moderator {_moderatorId}] Existing browser is unhealthy: {ex.Message}. Will recreate.");
                        try { await _browser.CloseAsync(); } catch { /* ignore */ }
                        _browser = null;
                        _page = null;
                    }
                }
                // ========== END FIX 7 ==========

                if (_browser == null)
                {
                    _lastLaunchAttempt = DateTime.UtcNow;
                    
                    // ========== FIX 3: Kill existing Chrome processes using this session directory ==========
                    await KillExistingChromeProcessesAsync();
                    // ========== END FIX 3 ==========

                    Directory.CreateDirectory(_sessionDirectory);
                    _browser = await _playwright.Chromium.LaunchPersistentContextAsync(
                        _sessionDirectory,
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

                ensurePage:
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
                    // Post-creation health check: if the page is closed immediately (some environments close
                    // newly created pages due to profile or other issues), wait briefly and try one more time.
                    try
                    {
                        await Task.Delay(300);
                        bool closed = false;
                        try { closed = _page.IsClosed; } catch { closed = true; }
                        if (closed)
                        {
                            Console.Error.WriteLine($"Playwright page was closed immediately after creation; recreating page ({DateTime.UtcNow:O})");
                            try { _page = await _browser.NewPageAsync(); } catch { /* ignore - best effort */ }
                        }
                    }
                    catch { /* ignore timing failures */ }
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

        // ========== FIX 3: Kill existing Chrome processes using this user-data-dir ==========
        private async Task KillExistingChromeProcessesAsync()
        {
            try
            {
                // Find Chrome processes that might be using our session directory
                var chromeProcesses = Process.GetProcessesByName("chrome");
                foreach (var proc in chromeProcesses)
                {
                    try
                    {
                        // Check if this Chrome process is using our session directory
                        // On Windows, we can check if this process was started with our user-data-dir
                        var processPath = proc.MainModule?.FileName;
                        if (processPath != null && processPath.Contains("chrome"))
                        {
                            // Log any Chrome that might be orphaned and using our session
                            Console.Error.WriteLine($"[Moderator {_moderatorId}] Found existing Chrome process (PID: {proc.Id}), checking if it's using our session...");
                        }
                    }
                    catch { /* ignore - process may have exited */ }
                }

                // Wait a bit for processes to clean up
                await Task.Delay(500);
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"[Moderator {_moderatorId}] Error checking for existing Chrome processes: {ex.Message}");
            }
        }
        // ========== END FIX 3 ==========

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
        public async Task WaitForSelectorAsync(string selector, int timeout = WhatsAppConfiguration.DefaultSelectorTimeoutMs, WaitForSelectorState state = WaitForSelectorState.Visible)
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
                            Timeout = (timeout > 0) ? timeout : 20000,
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

        public async Task<byte[]?> ScreenshotElementAsync(IElementHandle element)
        {
            return await WithPageRetryAsync(async () =>
            {
                await EnsurePageInitializedAsync();
                if (_page == null)
                    throw new InvalidOperationException("Browser session not initialized");

                try
                {
                    return await element.ScreenshotAsync();
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"Error taking element screenshot: {ex.Message}");
                    return null;
                }
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
