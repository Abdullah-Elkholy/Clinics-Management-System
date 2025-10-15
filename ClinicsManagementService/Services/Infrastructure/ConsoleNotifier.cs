// using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.Services.Interfaces;

namespace ClinicsManagementService.Services.Infrastructure
{
    public class ConsoleNotifier : INotifier
    {
        public void Notify(string message)
        {
            Console.WriteLine(message);
        }
    }
}