using Microsoft.Playwright;

namespace ClinicsManagementService.Models
{
    /// <summary>
    /// Represents the status of a message operation
    /// </summary>
    public enum MessageOperationStatus
    {
        Succeeded,
        Failed,
        Waiting,
        PendingQR,
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
}


