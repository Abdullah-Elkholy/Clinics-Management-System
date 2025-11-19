using ClinicsManagementService.Models;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Threading;

namespace ClinicsManagementService.Services.Interfaces
{
    public interface IMessageSender
    {
        Task<bool> SendMessageAsync(string phoneNumber, string message, CancellationToken cancellationToken = default);
        Task<List<MessageSendResult>> SendMessagesAsync(string phoneNumber, IEnumerable<string> messages);
        Task<List<MessageSendResult>> SendBulkWithThrottlingAsync(IEnumerable<(string Phone, string Message)> items, int minDelayMs, int maxDelayMs);
    }
}