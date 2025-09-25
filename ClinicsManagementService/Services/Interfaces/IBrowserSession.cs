using Microsoft.Playwright;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace ClinicsManagementService.Services.Interfaces
{
    public interface IBrowserSession : IAsyncDisposable
    {
        Task InitializeAsync(string sessionDir);
        Task NavigateToAsync(string url);
        Task WaitForSelectorAsync(string selector, int? timeout = null, WaitForSelectorState state = WaitForSelectorState.Visible);
        Task<IElementHandle?> QuerySelectorAsync(string selector);
        Task<IReadOnlyList<IElementHandle>> QuerySelectorAllAsync(string selector);
    }
}