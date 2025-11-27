namespace Clinics.Api.DTOs
{
    public class SendMessageRequest
    {
        public int TemplateId { get; set; }
        public int[] PatientIds { get; set; } = new int[0];
        public string? Channel { get; set; }
        public string? OverrideContent { get; set; }
    }

    public class SendMessageResponse
    {
        public bool Success { get; set; }
        public int Queued { get; set; }
        public string? SessionId { get; set; }
        public string? Error { get; set; }
        public string? Code { get; set; }
        public string? Message { get; set; }
        public bool? Warning { get; set; }
    }
}
