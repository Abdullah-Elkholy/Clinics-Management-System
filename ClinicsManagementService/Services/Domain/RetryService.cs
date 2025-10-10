using ClinicsManagementService.Services.Interfaces;

namespace ClinicsManagementService.Services.Domain
{
    public class RetryService : IRetryService
    {
        public async Task<T> ExecuteWithRetryAsync<T>(Func<Task<T>> operation, int maxAttempts = 3, Func<Exception, bool>? isRetryable = null)
        {
            int attempt = 0;
            while (true)
            {
                try { return await operation(); }
                catch (Exception ex)
                {
                    attempt++;
                    if (attempt >= maxAttempts || (isRetryable != null && !isRetryable(ex))) throw;
                }
            }
        }
    }
}
