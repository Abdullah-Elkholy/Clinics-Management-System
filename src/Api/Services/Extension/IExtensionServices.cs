using Clinics.Domain;

namespace Clinics.Api.Services.Extension
{
    /// <summary>
    /// Result of sending a message through any WhatsApp provider.
    /// </summary>
    public class WhatsAppSendResult
    {
        public bool Success { get; init; }
        public string? ProviderId { get; init; }
        public string? ProviderResponse { get; init; }
        
        /// <summary>
        /// Result status code for handling specific error types.
        /// Values: "success", "pendingQR", "pendingNET", "waiting", "failed"
        /// </summary>
        public string ResultStatus { get; init; } = "failed";
        
        /// <summary>
        /// Error message in Arabic for UI display.
        /// </summary>
        public string? ErrorMessage { get; init; }
        
        /// <summary>
        /// Whether this error should trigger a global pause.
        /// True for PendingQR, PendingNET, BrowserClosure.
        /// </summary>
        public bool ShouldPauseGlobally { get; init; }
        
        /// <summary>
        /// The pause reason if ShouldPauseGlobally is true.
        /// </summary>
        public string? PauseReason { get; init; }

        public static WhatsAppSendResult SuccessResult(string? providerId = null, string? providerResponse = null) => new()
        {
            Success = true,
            ProviderId = providerId ?? "Extension",
            ProviderResponse = providerResponse,
            ResultStatus = ExtensionResultStatuses.Success
        };

        public static WhatsAppSendResult FailedResult(string errorMessage, string? providerResponse = null) => new()
        {
            Success = false,
            ProviderId = "Extension",
            ProviderResponse = providerResponse,
            ResultStatus = ExtensionResultStatuses.Failed,
            ErrorMessage = errorMessage
        };

        public static WhatsAppSendResult PendingQR(string errorMessage) => new()
        {
            Success = false,
            ProviderId = "Extension",
            ResultStatus = ExtensionResultStatuses.PendingQR,
            ErrorMessage = errorMessage,
            ShouldPauseGlobally = true,
            PauseReason = "PendingQR"
        };

        public static WhatsAppSendResult PendingNET(string errorMessage) => new()
        {
            Success = false,
            ProviderId = "Extension",
            ResultStatus = ExtensionResultStatuses.PendingNET,
            ErrorMessage = errorMessage,
            ShouldPauseGlobally = true,
            PauseReason = "PendingNET"
        };

        /// <summary>
        /// P2.9: Extension command timed out but may still complete.
        /// Message stays in 'sending' state - no retry triggered.
        /// </summary>
        public static WhatsAppSendResult ExtensionTimeout(string errorMessage, Guid? commandId = null) => new()
        {
            Success = false,
            ProviderId = "Extension",
            ResultStatus = ExtensionResultStatuses.ExtensionTimeout,
            ErrorMessage = errorMessage,
            ProviderResponse = commandId.HasValue ? $"CommandId={commandId}" : null
        };

        /// <summary>
        /// P2.9: No active extension lease for the moderator.
        /// </summary>
        public static WhatsAppSendResult NoActiveLease(string errorMessage) => new()
        {
            Success = false,
            ProviderId = "Extension",
            ResultStatus = ExtensionResultStatuses.NoActiveLease,
            ErrorMessage = errorMessage
        };

        public static WhatsAppSendResult Waiting(string errorMessage) => new()
        {
            Success = false,
            ProviderId = "Extension",
            ResultStatus = ExtensionResultStatuses.Waiting,
            ErrorMessage = errorMessage
        };
    }

    /// <summary>
    /// Abstraction for WhatsApp message sending providers.
    /// Allows switching between server-side Playwright and extension-based automation.
    /// </summary>
    public interface IWhatsAppProvider
    {
        /// <summary>
        /// Provider name for identification (e.g., "ServerPlaywright", "ExtensionRunner").
        /// </summary>
        string ProviderName { get; }

        /// <summary>
        /// Check if this provider is available for the given moderator.
        /// For extension provider: checks if an active lease exists.
        /// For server provider: always returns true.
        /// </summary>
        Task<bool> IsAvailableAsync(int moderatorUserId);

        /// <summary>
        /// Send a message through this provider.
        /// </summary>
        Task<WhatsAppSendResult> SendMessageAsync(Message message, CancellationToken cancellationToken = default);

        /// <summary>
        /// Get current WhatsApp session status for a moderator.
        /// </summary>
        Task<string> GetSessionStatusAsync(int moderatorUserId);
    }

    /// <summary>
    /// Service for managing extension device pairing.
    /// </summary>
    public interface IExtensionPairingService
    {
        /// <summary>
        /// Start pairing process - generates a short code for the moderator.
        /// </summary>
        Task<ExtensionPairingCode> StartPairingAsync(int moderatorUserId);

        /// <summary>
        /// Complete pairing - extension submits code and receives device token.
        /// </summary>
        /// <returns>Device token (raw) or null if pairing failed.</returns>
        Task<(ExtensionDevice? device, string? token, string? error)> CompletePairingAsync(
            string code, 
            string deviceId, 
            string? deviceName,
            string? extensionVersion,
            string? userAgent);

        /// <summary>
        /// Revoke a device token (logout device).
        /// </summary>
        Task<bool> RevokeDeviceAsync(Guid deviceId, string reason);

        /// <summary>
        /// Permanently delete a device and all its related data (leases, commands).
        /// </summary>
        Task<bool> DeleteDeviceAsync(Guid deviceId);

        /// <summary>
        /// Get all devices for a moderator.
        /// </summary>
        Task<IList<ExtensionDevice>> GetDevicesAsync(int moderatorUserId);
    }

    /// <summary>
    /// Service for managing extension session leases.
    /// </summary>
    public interface IExtensionLeaseService
    {
        /// <summary>
        /// Acquire a lease for the extension.
        /// Returns null if another device already has an active lease.
        /// </summary>
        Task<(ExtensionSessionLease? lease, string? leaseToken, string? error)> AcquireLeaseAsync(
            int moderatorUserId, 
            Guid deviceId,
            bool forceTakeover = false);

        /// <summary>
        /// Renew (heartbeat) an existing lease.
        /// </summary>
        Task<(bool success, string? error)> HeartbeatAsync(
            Guid leaseId, 
            string leaseToken,
            string? currentUrl = null,
            string? whatsAppStatus = null,
            string? lastError = null);

        /// <summary>
        /// Release a lease explicitly.
        /// </summary>
        Task<bool> ReleaseLeaseAsync(Guid leaseId, string leaseToken, string reason = "Released");

        /// <summary>
        /// Get active lease for a moderator.
        /// </summary>
        Task<ExtensionSessionLease?> GetActiveLeaseAsync(int moderatorUserId);

        /// <summary>
        /// Check if lease is valid (for authorization).
        /// </summary>
        Task<bool> ValidateLeaseAsync(Guid leaseId, string leaseToken);

        /// <summary>
        /// Force release lease for a moderator (from web UI).
        /// </summary>
        Task<bool> ForceReleaseLeaseAsync(int moderatorUserId, string reason = "ForceReleased");

        /// <summary>
        /// Expire stale leases (background job).
        /// </summary>
        Task<int> ExpireStaleLeases();
    }

    /// <summary>
    /// Service for managing extension commands.
    /// </summary>
    public interface IExtensionCommandService
    {
        /// <summary>
        /// Create a new command for the extension.
        /// </summary>
        Task<ExtensionCommand> CreateCommandAsync(
            int moderatorUserId,
            string commandType,
            object payload,
            Guid? messageId = null,
            int priority = 100,
            TimeSpan? timeout = null);

        /// <summary>
        /// Get pending commands for a moderator (for dispatch).
        /// </summary>
        Task<IList<ExtensionCommand>> GetPendingCommandsAsync(int moderatorUserId, int maxCount = 10);

        /// <summary>
        /// Mark command as sent to extension.
        /// </summary>
        Task<bool> MarkSentAsync(Guid commandId);

        /// <summary>
        /// Acknowledge command receipt by extension.
        /// </summary>
        Task<bool> AcknowledgeAsync(Guid commandId);

        /// <summary>
        /// Complete command with result.
        /// </summary>
        Task<bool> CompleteAsync(Guid commandId, string resultStatus, object? resultData = null);

        /// <summary>
        /// Fail a command.
        /// </summary>
        Task<bool> FailAsync(Guid commandId, string reason);

        /// <summary>
        /// Expire timed out commands (background job).
        /// </summary>
        Task<int> ExpireTimedOutCommandsAsync();

        /// <summary>
        /// Get command by ID.
        /// </summary>
        Task<ExtensionCommand?> GetCommandAsync(Guid commandId);
    }
}
