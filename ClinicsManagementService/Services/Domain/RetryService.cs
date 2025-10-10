using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.Models;

namespace ClinicsManagementService.Services.Domain
{
    public class RetryService : IRetryService
    {
        public async Task<OperationResult<T>> ExecuteWithRetryAsync<T>(Func<Task<OperationResult<T>>> operation, int maxAttempts = 3, Func<OperationResult<T>, bool>? shouldRetryResult = null, Func<Exception, bool>? isRetryable = null)
        {
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
