namespace Clinics.Api.DTOs
{
    public class SendMessageRequest
    {
        public int TemplateId { get; set; }
        public int[] PatientIds { get; set; } = new int[0];
        public string? Channel { get; set; }
        public string? OverrideContent { get; set; }
    }
}
