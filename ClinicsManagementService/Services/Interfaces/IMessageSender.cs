using ClinicsManagementService.Models;
using System.Collections.Generic;
using System.Threading.Tasks;
namespace ClinicsManagementService.Services.Interfaces
{
    public interface IMessageSender
    {
        Task<bool> SendMessageAsync(string phoneNumber, string message);
        Task<List<MessageSendResult>> SendMessagesAsync(string phoneNumber, IEnumerable<string> messages);
        Task<List<MessageSendResult>> SendBulkWithThrottlingAsync(IEnumerable<(string Phone, string Message)> items, int minDelayMs, int maxDelayMs);
    }
}