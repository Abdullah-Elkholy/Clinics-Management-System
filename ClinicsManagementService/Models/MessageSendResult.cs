namespace ClinicsManagementService.Models
{
    public class MessageSendResult
    {
        public string Phone { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public bool Sent { get; set; } = false;
        public string? Error { get; set; }
        public string? IconType { get; set; }
        public MessageOperationStatus Status { get; set; }
    }
}