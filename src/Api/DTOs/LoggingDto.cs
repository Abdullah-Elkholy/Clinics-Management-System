namespace Clinics.Api.DTOs
{
    public class AuditLog
    {
        public long Id { get; set; }

        public int? UserId { get; set; }

        public string Action { get; set; } = null!;

        public string? Entity { get; set; }

        public string? EntityId { get; set; }

        public string? Details { get; set; }

        public string? IpAddress { get; set; }

        public DateTime CreatedAt { get; set; }
    }
}