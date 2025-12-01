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
    }
}
