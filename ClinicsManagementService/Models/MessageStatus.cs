using Microsoft.Playwright;

namespace ClinicsManagementService.Models
{
    /// <summary>
    /// Represents the status of a message operation
    /// </summary>
    public enum MessageOperationStatus
    {
        /// <summary>
        /// Message was sent successfully
        /// </summary>
        Succeeded,
        
        /// <summary>
        /// Message failed due to various reasons (no WhatsApp, invalid number, etc.)
        /// </summary>
        Failed,
        
        /// <summary>
        /// Default waiting status for operations
        /// </summary>
        Waiting,
        
        /// <summary>
        /// Pending due to QR code authentication required
        /// </summary>
        PendingQR,
        
        /// <summary>
        /// Pending due to internet connectivity issues
        /// </summary>
        PendingNET
    }

    /// <summary>
    /// Represents message status information
    /// </summary>
    public class MessageStatus
    {
        public string? IconType { get; set; }
        public IElementHandle? StatusIcon { get; set; }

        public static MessageStatus Empty() => new() { IconType = null, StatusIcon = null };
        public static MessageStatus WithIcon(string iconType, IElementHandle? statusIcon) => new()
        {
            IconType = iconType,
            StatusIcon = statusIcon
        };
    }

    /// <summary>
    /// Represents the result of a message delivery operation
    /// </summary>
    public class MessageDeliveryResult
    {
        public bool Sent { get; set; }
        public string? IconType { get; set; }
        public string? Error { get; set; }
        public MessageOperationStatus Status { get; set; }

        public static MessageDeliveryResult Success(string iconType) => new()
        {
            Sent = true,
            IconType = iconType,
            Error = null,
            Status = MessageOperationStatus.Succeeded
        };

        public static MessageDeliveryResult Failure(string error) => new()
        {
            Sent = false,
            IconType = null,
            Error = error,
            Status = MessageOperationStatus.Failed
        };

        public static MessageDeliveryResult Waiting(string error) => new()
        {
            Sent = false,
            IconType = null,
            Error = $"Waiting: {error}",
            Status = MessageOperationStatus.Waiting
        };

        public static MessageDeliveryResult PendingQR(string error) => new()
        {
            Sent = false,
            IconType = null,
            Error = $"PendingQR: {error}",
            Status = MessageOperationStatus.PendingQR
        };

        public static MessageDeliveryResult PendingNET(string error) => new()
        {
            Sent = false,
            IconType = null,
            Error = $"PendingNET: {error}",
            Status = MessageOperationStatus.PendingNET
        };
    }

    /// <summary>
    /// Represents the result of a navigation operation
    /// </summary>
    public class NavigationResult
    {
        public bool Success { get; set; }
        public string? Error { get; set; }

        public static NavigationResult CreateSuccess() => new() { Success = true, Error = null };
        public static NavigationResult CreateFailure(string error) => new() { Success = false, Error = error };
    }

    /// <summary>
    /// Represents the result of a WhatsApp number check
    /// </summary>
    public class WhatsAppNumberCheckResult
    {
        public bool HasWhatsApp { get; set; }
        public string? Error { get; set; }
        public MessageOperationStatus Status { get; set; }

        public static WhatsAppNumberCheckResult Success() => new()
        {
            HasWhatsApp = true,
            Error = null,
            Status = MessageOperationStatus.Succeeded
        };

        public static WhatsAppNumberCheckResult Failure(string error) => new()
        {
            HasWhatsApp = false,
            Error = error,
            Status = MessageOperationStatus.Failed
        };

        public static WhatsAppNumberCheckResult Waiting(string error) => new()
        {
            HasWhatsApp = false,
            Error = $"Waiting: {error}",
            Status = MessageOperationStatus.Waiting
        };

        public static WhatsAppNumberCheckResult PendingQR(string error) => new()
        {
            HasWhatsApp = false,
            Error = $"PendingQR: {error}",
            Status = MessageOperationStatus.PendingQR
        };

        public static WhatsAppNumberCheckResult PendingNET(string error) => new()
        {
            HasWhatsApp = false,
            Error = $"PendingNET: {error}",
            Status = MessageOperationStatus.PendingNET
        };
    }

    /// <summary>
    /// Represents the result of an internet connectivity check
    /// </summary>
    public class InternetConnectivityResult
    {
        public bool IsConnected { get; set; }
        public string? Error { get; set; }
        public MessageOperationStatus Status { get; set; }

        public static InternetConnectivityResult Success() => new()
        {
            IsConnected = true,
            Error = null,
            Status = MessageOperationStatus.Succeeded
        };

        public static InternetConnectivityResult Failure(string error) => new()
        {
            IsConnected = false,
            Error = error,
            Status = MessageOperationStatus.Failed
        };

        public static InternetConnectivityResult PendingQR(string error) => new()
        {
            IsConnected = false,
            Error = $"PendingQR: {error}",
            Status = MessageOperationStatus.PendingQR
        };

        public static InternetConnectivityResult PendingNET(string error) => new()
        {
            IsConnected = false,
            Error = $"PendingNET: {error}",
            Status = MessageOperationStatus.PendingNET
        };
    }

    /// <summary>
    /// Represents the result of a WhatsApp authentication check
    /// </summary>
    public class WhatsAppAuthenticationResult
    {
        public bool IsAuthenticated { get; set; }
        public string? Error { get; set; }
        public MessageOperationStatus Status { get; set; }

        public static WhatsAppAuthenticationResult Success() => new()
        {
            IsAuthenticated = true,
            Error = null,
            Status = MessageOperationStatus.Succeeded
        };

        public static WhatsAppAuthenticationResult Failure(string error) => new()
        {
            IsAuthenticated = false,
            Error = error,
            Status = MessageOperationStatus.Failed
        };

        public static WhatsAppAuthenticationResult Waiting(string error) => new()
        {
            IsAuthenticated = false,
            Error = $"Waiting: {error}",
            Status = MessageOperationStatus.Waiting
        };

        public static WhatsAppAuthenticationResult PendingQR(string error) => new()
        {
            IsAuthenticated = false,
            Error = $"PendingQR: {error}",
            Status = MessageOperationStatus.PendingQR
        };

        public static WhatsAppAuthenticationResult PendingNET(string error) => new()
        {
            IsAuthenticated = false,
            Error = $"PendingNET: {error}",
            Status = MessageOperationStatus.PendingNET
        };
    }
}
