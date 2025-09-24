using Microsoft.Playwright;
using System.Collections.Generic;
using System.Threading.Tasks;

public interface IBrowserSession : IAsyncDisposable
{
    Task InitializeAsync();
    Task NavigateToAsync(string url);
    // Wait for a selector to reach a specific state (Visible, Attached, Detached, etc).
    Task WaitForSelectorAsync(string selector, int? timeout = null, WaitForSelectorState state = WaitForSelectorState.Visible);
    Task<IElementHandle?> QuerySelectorAsync(string selector);
    Task<IReadOnlyList<IElementHandle>> QuerySelectorAllAsync(string selector);
}