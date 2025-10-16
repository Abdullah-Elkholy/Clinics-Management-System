using System;

namespace Clinics.Domain
{
    public class Role
    {
        public int Id { get; set; }
        public string Name { get; set; } = null!;
        public string DisplayName { get; set; } = null!;
    }

    public class User
    {
        public int Id { get; set; }
        public string Username { get; set; } = null!;
        public string? PasswordHash { get; set; }
        public string FullName { get; set; } = null!;
        public int RoleId { get; set; }
        public Role? Role { get; set; }
        public string? PhoneNumber { get; set; }
        public string? Email { get; set; }
    }

    public class Queue
    {
        public int Id { get; set; }
        public string DoctorName { get; set; } = null!;
        public string? Description { get; set; }
        public int CreatedBy { get; set; }
        public int CurrentPosition { get; set; }
        public int? EstimatedWaitMinutes { get; set; }
    }

    public class Patient
    {
        public int Id { get; set; }
        public int QueueId { get; set; }
        public string FullName { get; set; } = null!;
        public string PhoneNumber { get; set; } = null!;
        public int Position { get; set; }
        public string Status { get; set; } = "waiting";
    }

    public class MessageTemplate
    {
        public int Id { get; set; }
        public string Title { get; set; } = null!;
        public string Content { get; set; } = null!;
        public int CreatedBy { get; set; }
        public string? Moderator { get; set; }
        public bool IsShared { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class Message
    {
        public long Id { get; set; }
        public int? PatientId { get; set; }
        public int? TemplateId { get; set; }
        public int? QueueId { get; set; }
        public int? SenderUserId { get; set; }
        public string? ProviderMessageId { get; set; }
        public string Channel { get; set; } = "whatsapp";
        public string RecipientPhone { get; set; } = null!;
        public string Content { get; set; } = null!;
        public string Status { get; set; } = "queued";
        public int Attempts { get; set; }
        public DateTime? LastAttemptAt { get; set; }
        public DateTime? SentAt { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class FailedTask
    {
        public long Id { get; set; }
        public long? MessageId { get; set; }
        public int? PatientId { get; set; }
        public int? QueueId { get; set; }
        public string? Reason { get; set; }
        public string? ProviderResponse { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? LastRetryAt { get; set; }
        public int RetryCount { get; set; }
    }

    public class Quota
    {
        public int Id { get; set; }
        public int ModeratorUserId { get; set; }
        public int MessagesQuota { get; set; }
        public int ConsumedMessages { get; set; }
        public int QueuesQuota { get; set; }
        public int ConsumedQueues { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

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

    public class Session
    {
        public Guid Id { get; set; }
        public int UserId { get; set; }
        public string RefreshToken { get; set; } = null!;
        public DateTime ExpiresAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public string? IpAddress { get; set; }
        public string? UserAgent { get; set; }
    }

    public class WhatsAppSession
    {
        public int Id { get; set; }
        public int ModeratorUserId { get; set; }
        public string? SessionName { get; set; }
        public string? ProviderSessionId { get; set; }
        public string? Status { get; set; }
        public DateTime? LastSyncAt { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
