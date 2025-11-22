using System.Threading.Tasks;

namespace Clinics.Application.Interfaces
{
    /// <summary>
    /// Token Service Interface - Enforces dependency inversion principle
    /// Allows multiple implementations (JWT, OAuth, etc.)
    /// </summary>
    public interface ITokenService
    {
        string CreateToken(int userId, string username, string role, string firstName, string? lastName = null);
        Task<bool> ValidateTokenAsync(string token);
    }

    /// <summary>
    /// Session Service Interface
    /// Manages user sessions and refresh tokens
    /// </summary>
    public interface ISessionService
    {
        Task<string> GenerateRefreshTokenAsync();
        Task<bool> ValidateRefreshTokenAsync(string token, int userId);
        Task<bool> InvalidateRefreshTokenAsync(string token);
    }

    /// <summary>
    /// Message Sender Interface
    /// Supports multiple messaging providers (WhatsApp, SMS, Email, etc.)
    /// </summary>
    public interface IMessageSender
    {
        Task<(bool success, string providerId, string providerResponse)> SendAsync(Domain.Message message);
    }

    /// <summary>
    /// Message Processor Interface
    /// Handles queued message processing and retry logic
    /// </summary>
    public interface IMessageProcessor
    {
        Task ProcessQueuedMessagesAsync(int maxBatch = 50);
        Task RetryFailedMessagesAsync(int maxBatch = 50);
    }

    /// <summary>
    /// Quota Service Interface
    /// Manages quota consumption and limits
    /// </summary>
    public interface IQuotaService
    {
        Task<(bool allowed, string message)> CanSendMessageAsync(int userId, int count = 1);
        Task<(bool allowed, string message)> CanCreateQueueAsync(int userId);
        Task<bool> ConsumeMessageQuotaAsync(int userId, int count);
        Task<bool> ConsumeQueueQuotaAsync(int userId);
    }
}
