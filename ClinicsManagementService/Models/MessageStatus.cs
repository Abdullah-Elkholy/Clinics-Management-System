using System.Runtime.Serialization;
using Microsoft.Playwright;

namespace ClinicsManagementService.Models
{
    /// <summary>
    /// Represents the status of a message operation
    /// </summary>
    public enum MessageOperationStatus
    {
        [EnumMember(Value = "Success")]
        Success,
        [EnumMember(Value = "Failure")]
        Failure,
        [EnumMember(Value = "Waiting")]
        Waiting,
        [EnumMember(Value = "PendingQR")]
        PendingQR,
        [EnumMember(Value = "PendingNET")]
        PendingNET,
        [EnumMember(Value = "BrowserClosure")]
        BrowserClosure
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


