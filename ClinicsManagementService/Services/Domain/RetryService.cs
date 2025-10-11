using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.Models;
using Microsoft.Playwright;
using ClinicsManagementService.Configuration;

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
            bool hasDisposedObjectMessage = false; 
            foreach(var msg in WhatsAppConfiguration.DisposedObjectMessage)
                {
                    if (ex.Message.Contains(msg))
                        hasDisposedObjectMessage = true;
                }
            return (ex is PlaywrightException || ex is ObjectDisposedException) && hasDisposedObjectMessage;
        }
        public async Task<OperationResult<T>> ExecuteWithRetryAsync<T>(Func<Task<OperationResult<T>>> operation, int maxAttempts = 3, Func<OperationResult<T>, bool>? shouldRetryResult = null, Func<Exception, bool>? isRetryable = null)
        {
            var operationName = operation.Method.Name;
            _notifier.Notify($"🔄 Starting operation {operationName} with up to {maxAttempts} attempts...");
            int attempt = 0;
            OperationResult<T>? lastResult = null;
            while (true)
            {
                attempt++;
                _notifier.Notify($"Attempt {attempt}/{maxAttempts}: executing {operationName}...");
                try
                {
                    var res = await operation();
                    lastResult = res;

                    // If caller provided a predicate to decide retries based on result, use it
                    if (shouldRetryResult != null && shouldRetryResult(res))
                    {
                        if (attempt >= maxAttempts)
                        {
                            _notifier.Notify($"❌ Giving up {operationName} after {attempt} attempt(s): last result state {res.State}. Returning last result.");
                            return res;
                        }
                        _notifier.Notify($"Attempt {attempt}/{maxAttempts} for {operationName} returned waiting state; will retry.");
                        continue; // retry
                    }

                    // If the operation succeeded or returned a terminal state, return it and notify
                    _notifier.Notify($"✅ Done operation {operationName} after {attempt} attempt(s). Result state: {res.State}, Success: {res.IsSuccess}");
                    return res;
                }
                catch (Exception ex)
                {
                    // If caller provided an isRetryable predicate and it says not retryable, rethrow
                    bool canRetry = isRetryable == null ? true : isRetryable(ex);
                    _notifier.Notify($"⚠️ Attempt {attempt}/{maxAttempts} for {operationName} failed: {ex.GetType().Name}: {ex.Message}");

                    if (!canRetry || attempt >= maxAttempts)
                    {
                        // If the exception indicates browser/session closed, add a hint
                        if (IsBrowserClosedException(ex))
                        {
                            _notifier.Notify($"❗ Browser closed detected during {operationName}. Consider recreating the browser session before retrying.");
                        }

                        // If we have a last result from the operation, return it as a failure; otherwise rethrow
                        if (lastResult != null)
                        {
                            _notifier.Notify($"❌ Giving up {operationName} after {attempt} attempts. Returning last known result.");
                            return lastResult;
                        }
                        throw;
                    }
                    _notifier.Notify($"Retrying {operationName} after exception (attempt {attempt}/{maxAttempts})...");
                    // otherwise loop and retry
                }
            }
            // Should never reach here because the loop either returns or throws.
        }
    }
}
