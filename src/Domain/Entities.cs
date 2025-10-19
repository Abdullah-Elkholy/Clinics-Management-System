using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Clinics.Domain
{
    [Table("Roles")]
    public class Role
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(50)]
        public string Name { get; set; } = null!;

        [Required]
        [StringLength(100)]
        public string DisplayName { get; set; } = null!;
    }

    [Table("Users")]
    public class User
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(50)]
        public string Username { get; set; } = null!;

        [StringLength(100)]
        public string? PasswordHash { get; set; }

        [Required]
        [StringLength(100)]
        public string FullName { get; set; } = null!;

        [Required]
        public int RoleId { get; set; }

        [ForeignKey(nameof(RoleId))]
        public Role? Role { get; set; }

        [StringLength(20)]
        [Phone]
        public string? PhoneNumber { get; set; }

        [StringLength(100)]
        [EmailAddress]
        public string? Email { get; set; }
    }

    [Table("Queues")]
    public class Queue
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(100)]
        public string DoctorName { get; set; } = null!;

        [StringLength(500)]
        public string? Description { get; set; }

        [Required]
        public int CreatedBy { get; set; }

        [Required]
        public int CurrentPosition { get; set; }

        public int? EstimatedWaitMinutes { get; set; }
    }

    [Table("Patients")]
    public class Patient
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int QueueId { get; set; }

        [ForeignKey(nameof(QueueId))]
        public Queue? Queue { get; set; }

        [Required]
        [StringLength(100)]
        public string FullName { get; set; } = null!;

        [Required]
        [StringLength(20)]
        [Phone]
        public string PhoneNumber { get; set; } = null!;

        [Required]
        public int Position { get; set; }

        [Required]
        [StringLength(20)]
        public string Status { get; set; } = "waiting";
    }

    [Table("MessageTemplates")]
    public class MessageTemplate
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(100)]
        public string Title { get; set; } = null!;

        [Required]
        [StringLength(2000)]
        public string Content { get; set; } = null!;

        [Required]
        public int CreatedBy { get; set; }

        [StringLength(100)]
        public string? Moderator { get; set; }

        [Required]
        public bool IsShared { get; set; }

        [Required]
        public DateTime CreatedAt { get; set; }
    }

    [Table("Messages")]
    public class Message
    {
        [Key]
        public long Id { get; set; }

        public int? PatientId { get; set; }

        public int? TemplateId { get; set; }

        public int? QueueId { get; set; }

        public int? SenderUserId { get; set; }

        [StringLength(100)]
        public string? ProviderMessageId { get; set; }

        [StringLength(20)]
        public string Channel { get; set; } = "whatsapp";

        [Required]
        [StringLength(20)]
        [Phone]
        public string RecipientPhone { get; set; } = null!;

        [Required]
        [StringLength(2000)]
        public string Content { get; set; } = null!;

        [Required]
        [StringLength(20)]
        public string Status { get; set; } = "queued";

        [Required]
        public int Attempts { get; set; }

        public DateTime? LastAttemptAt { get; set; }

        public DateTime? SentAt { get; set; }

        [Required]
        public DateTime CreatedAt { get; set; }
    }

    [Table("FailedTasks")]
    public class FailedTask
    {
        [Key]
        public long Id { get; set; }

        public long? MessageId { get; set; }

        public int? PatientId { get; set; }

        public int? QueueId { get; set; }

        [StringLength(500)]
        public string? Reason { get; set; }

        [StringLength(2000)]
        public string? ProviderResponse { get; set; }

        [Required]
        public DateTime CreatedAt { get; set; }

        public DateTime? LastRetryAt { get; set; }

        [Required]
        public int RetryCount { get; set; }
    }

    [Table("Quotas")]
    public class Quota
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int ModeratorUserId { get; set; }

        [Required]
        public int MessagesQuota { get; set; }

        [Required]
        public int ConsumedMessages { get; set; }

        [Required]
        public int QueuesQuota { get; set; }

        [Required]
        public int ConsumedQueues { get; set; }

        [Required]
        public DateTime UpdatedAt { get; set; }
    }


    [Table("Sessions")]
    public class Session
    {
        [Key]
        public Guid Id { get; set; }

        [Required]
        public int UserId { get; set; }

        [Required]
        [StringLength(100)]
        public string RefreshToken { get; set; } = null!;

        [Required]
        public DateTime ExpiresAt { get; set; }

        [Required]
        public DateTime CreatedAt { get; set; }

        [StringLength(50)]
        public string? IpAddress { get; set; }

        [StringLength(500)]
        public string? UserAgent { get; set; }
    }

    [Table("WhatsAppSessions")]
    public class WhatsAppSession
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int ModeratorUserId { get; set; }

        [StringLength(100)]
        public string? SessionName { get; set; }

        [StringLength(100)]
        public string? ProviderSessionId { get; set; }

        [StringLength(20)]
        public string? Status { get; set; }

        public DateTime? LastSyncAt { get; set; }

        [Required]
        public DateTime CreatedAt { get; set; }
    }
}
