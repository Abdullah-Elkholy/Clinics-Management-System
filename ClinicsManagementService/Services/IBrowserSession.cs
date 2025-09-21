using Microsoft.Playwright;

public interface IBrowserSession : IAsyncDisposable
{
    Task InitializeAsync();
    Task NavigateToAsync(string url);
    // Wait for a selector to appear and be visible. If visibleOnly is false, waits for presence in DOM.
    Task WaitForSelectorAsync(string selector, int timeout = 0, bool visibleOnly = true);
    Task<IElementHandle?> QuerySelectorAsync(string selector);
    // Add more as needed for abstraction
}
