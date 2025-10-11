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
                attempt++;
                _notifier.Notify($"➡️ Attempt {attempt}/{maxAttempts} for operation {operationName}...");
                try
                {
                    var res = await operation();
                    lastResult = res;

                    // Decide whether the caller wants a retry based on the result
                    if (shouldRetryResult != null && shouldRetryResult(res) && attempt < maxAttempts)
                    {
                        _notifier.Notify($"↩️ Attempt {attempt} for {operationName} returned retryable result: {res.ResultMessage}");
                        if (attempt >= maxAttempts)
                        {
                            _notifier.Notify($"❌ Operation {operationName} exhausted {maxAttempts} attempts with retryable results.");
                            return OperationResult<T>.Failure($"Operation {operationName} exhausted attempts: {res.ResultMessage}");
                        }
                        continue; // retry
                    }

                    // Log final result state
                    if (res.IsSuccess == true)
                    {
                        _notifier.Notify($"✅ Operation {operationName} succeeded after {attempt} attempt(s).");
                    }
                    else if (res.IsSuccess == false)
                    {
                        _notifier.Notify($"❌ Operation {operationName} returned failure after {attempt} attempt(s): {res.ResultMessage}");
                    }
                    else
                    {
                        _notifier.Notify($"⏳ Operation {operationName} returned waiting/pending state after {attempt} attempt(s): {res.ResultMessage}");
                    }

                    return res;
                }
                catch (Exception ex)
                {
                    _notifier.Notify($"⚠️ Attempt {attempt} for {operationName} threw: {ex.Message}");

                    // Decide whether to retry based on isRetryable predicate
                    bool willRetry = (isRetryable == null) ? false : isRetryable(ex);
                    if (!willRetry || attempt >= maxAttempts)
                    {
                        _notifier.Notify($"❌ Operation {operationName} failed after {attempt} attempts: {ex.Message}");
                        return OperationResult<T>.Failure($"Operation {operationName} failed: {ex.Message}");
                    }

                    _notifier.Notify($"♻️ Will retry {operationName} due to error: {ex.Message}");
                    // loop and retry
                }
            }
        }
    }
}
