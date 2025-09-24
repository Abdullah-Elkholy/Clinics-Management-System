using ClinicsManagementService.Models;
using System.Collections.Generic;
using System.Threading.Tasks;

public interface IMessageSender
{
    Task<bool> SendMessageAsync(string phoneNumber, string message);
    Task<bool> SendMessagesAsync(string phoneNumber, IEnumerable<string> messages);
    Task<List<MessageSendResult>> SendBulkWithThrottlingAsync(IEnumerable<(string Phone, string Message)> items, int minDelayMs, int maxDelayMs);
}
