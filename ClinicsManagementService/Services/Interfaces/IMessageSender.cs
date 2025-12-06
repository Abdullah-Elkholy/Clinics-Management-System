using ClinicsManagementService.Models;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Threading;

namespace ClinicsManagementService.Services.Interfaces
{
    public interface IMessageSender
    {
        Task<bool> SendMessageAsync(int moderatorUserId, string phoneNumber, string message, CancellationToken cancellationToken = default);
        
        /// <summary>
        /// Send a single message and return detailed result with status (PendingQR, BrowserClosure, etc.)
        /// Use this method when you need to differentiate between different failure types.
        /// </summary>
        Task<MessageSendResult> SendMessageWithResultAsync(int moderatorUserId, string phoneNumber, string message, CancellationToken cancellationToken = default);
        
        Task<List<MessageSendResult>> SendMessagesAsync(int moderatorUserId, string phoneNumber, IEnumerable<string> messages);
        Task<List<MessageSendResult>> SendBulkWithThrottlingAsync(int moderatorUserId, IEnumerable<(string Phone, string Message)> items, int minDelayMs, int maxDelayMs);
    }
}