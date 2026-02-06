namespace Clinics.Api.DTOs
{
    public class SendMessageRequest
    {
        public int TemplateId { get; set; }
        public int[] PatientIds { get; set; } = new int[0];

        /// <summary>
        /// Optional: Moderator ID for admin users to specify which WhatsApp session to use.
        /// Required if the current user is an admin (not a moderator).
        /// </summary>
        public int? ModeratorId { get; set; }

        public string? Channel { get; set; }
        public string? OverrideContent { get; set; }

        /// <summary>
        /// Optional correlation ID for request tracking and idempotency.
        /// If not provided, a new Guid will be generated.
        /// </summary>
        public Guid? CorrelationId { get; set; }
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

        /// <summary>
        /// Correlation ID for tracking this request through logs and retry flows
        /// </summary>
        public Guid? CorrelationId { get; set; }
    }
}
