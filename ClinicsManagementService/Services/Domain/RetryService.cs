using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.Models;
using ClinicsManagementService.Configuration;

namespace ClinicsManagementService.Services.Domain
{
    /// <summary>
    /// Handles retry logic and error recovery
    /// </summary>
    public class RetryService : IRetryService
    {
        private readonly INotifier _notifier;

        public RetryService(INotifier notifier)
        {
            _notifier = notifier;
        }

        public async Task<T> ExecuteWithRetryAsync<T>(
            Func<Task<T>> operation, 
            int maxAttempts = WhatsAppConfiguration.DefaultMaxRetryAttempts, 
            Func<Exception, bool>? isRetryable = null)
        {
            int attempt = 0;
            Exception? lastException = null;

            while (attempt < maxAttempts)
            {
                try
                {
                    _notifier.Notify($"🔄 Executing operation (attempt {attempt + 1}/{maxAttempts})...");
                    var result = await operation();
                    _notifier.Notify($"✅ Operation completed successfully on attempt {attempt + 1}.");
                    return result;
                }
                catch (TimeoutException ex)
                {
                    attempt++;
                    lastException = ex;
                    _notifier.Notify($"⏰ Timeout exception occurred (attempt {attempt}/{maxAttempts}): {ex.Message}");

                    if (attempt >= maxAttempts)
                    {
                        _notifier.Notify($"❌ Max timeout retries reached ({maxAttempts}). Operation failed.");
                        throw new InvalidOperationException($"Timeout after {maxAttempts} attempts: {ex.Message}", ex);
                    }

                    // Special handling for timeout exceptions
                    _notifier.Notify($"🔄 Retrying after timeout (attempt {attempt}/{maxAttempts})...");
                    var delay = Math.Min(2000 * Math.Pow(2, attempt - 1), 15000); // Longer delays for timeouts
                    _notifier.Notify($"⏳ Waiting {delay}ms before retry...");
                    await Task.Delay((int)delay);
                }
                catch (Exception ex)
                {
                    attempt++;
                    lastException = ex;

                    if (isRetryable != null && !isRetryable(ex))
                    {
                        _notifier.Notify($"❌ Non-retryable error occurred: {ex.Message}");
                        throw;
                    }

                    _notifier.Notify($"⚠️ Error occurred (attempt {attempt}/{maxAttempts}): {ex.Message}");

                    if (attempt >= maxAttempts)
                    {
                        _notifier.Notify($"❌ All attempts failed. Please check your internet connection or WhatsApp Web availability.");
                        throw new InvalidOperationException($"Failed after {maxAttempts} attempts: {ex.Message}", ex);
                    }

                    // Wait before retry (exponential backoff)
                    var delay = Math.Min(1000 * Math.Pow(2, attempt - 1), 10000);
                    _notifier.Notify($"⏳ Waiting {delay}ms before retry...");
                    await Task.Delay((int)delay);
                }
            }

            throw new InvalidOperationException($"Failed after {maxAttempts} attempts: {lastException?.Message}", lastException);
        }
    }
}
