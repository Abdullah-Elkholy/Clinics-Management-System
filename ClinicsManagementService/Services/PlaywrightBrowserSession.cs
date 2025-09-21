using Microsoft.Playwright;

public class PlaywrightBrowserSession : IBrowserSession
{
    private IPlaywright? _playwright;
    private IBrowserContext? _browser;
    private IPage? _page;
    private readonly string _sessionDir;

    public PlaywrightBrowserSession(string sessionDir)
    {
        _sessionDir = sessionDir;
    }

    public async Task InitializeAsync()
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

    public async Task NavigateToAsync(string url)
    {
        if (_page == null) throw new InvalidOperationException("Browser not initialized");
        await _page.GotoAsync(url);
    }

    public async Task WaitForSelectorAsync(string selector, int timeout = 0, bool visibleOnly = true)
    {
        if (_page == null) throw new InvalidOperationException("Browser not initialized");
        await _page.WaitForSelectorAsync(
            selector,
            new PageWaitForSelectorOptions
            {
                Timeout = timeout > 0 ? timeout : 30000, // default 30s if not specified
                State = visibleOnly ? WaitForSelectorState.Visible : WaitForSelectorState.Attached
            }
        );
    }

    public async Task<IElementHandle?> QuerySelectorAsync(string selector)
    {
        if (_page == null) throw new InvalidOperationException("Browser not initialized");
        return await _page.QuerySelectorAsync(selector);
    }

    public async ValueTask DisposeAsync()
    {
        if (_browser != null)
            await _browser.CloseAsync();
        _playwright?.Dispose();
    }
}
