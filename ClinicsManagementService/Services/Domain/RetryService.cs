using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.Models;
using Microsoft.Playwright;

namespace ClinicsManagementService.Services.Domain
{
    public class RetryService : IRetryService
    {
        private readonly INotifier _notifier;
        public RetryService(INotifier notifier)
        {
            _notifier = notifier;
        }
        public bool IsBrowserClosedException(Exception ex)
        {
            return (ex is PlaywrightException || ex is ObjectDisposedException) &&
                   (ex.Message.Contains("Target page, context or browser has been closed") ||
                    ex.Message.Contains("Browser has been disconnected") ||
                    ex.Message.Contains("Session was closed") ||
                    ex.Message.Contains("Cannot access a disposed object"));
        }
        public async Task<OperationResult<T>> ExecuteWithRetryAsync<T>(Func<Task<OperationResult<T>>> operation, int maxAttempts = 3, Func<OperationResult<T>, bool>? shouldRetryResult = null, Func<Exception, bool>? isRetryable = null)
        {
            var operationName = operation.Method.Name;
            _notifier.Notify($"🔄 Starting operation {operationName} with up to {maxAttempts} attempts...");
            int attempt = 0;
            OperationResult<T>? lastResult = null;
            while (true)
            {
                try
                {
                    var res = await operation();
                    lastResult = res;
                    // If caller provided a predicate to decide retries based on result, use it
                    if (shouldRetryResult != null && shouldRetryResult(res) && attempt < maxAttempts - 1)
                    {
                        attempt++;
                        continue; // retry
                    }
                    // Otherwise return the result as is
                    _notifier.Notify($"✅ Done operation {operationName} after " + (attempt + 1) + " attempts.");
                    return res;
                }
                catch (Exception ex)
                {
                    attempt++;
                    if (attempt >= maxAttempts || (isRetryable != null && !isRetryable(ex))) throw;
                    // otherwise loop and retry
                }
            }
        }
    }
}
