public interface IMessageSender
{
    Task<bool> SendMessageAsync(string phoneNumber, string message);
    Task<bool> SendMessagesAsync(string phoneNumber, IEnumerable<string> messages);
}
