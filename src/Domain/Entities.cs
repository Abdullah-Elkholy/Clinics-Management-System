using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Clinics.Domain
{
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
        public string FirstName { get; set; } = null!;

        [StringLength(100)]
        public string? LastName { get; set; }

        [Required]
        [StringLength(50)]
        public string Role { get; set; } = "user"; // Stores: primary_admin, secondary_admin, moderator, user

        /// <summary>
        /// For 'user' role: References the moderator who supervises this user.
        /// Users share their moderator's quota, queues, WhatsApp session, and all data.
        /// For moderator/admin roles: This should be null.
        /// </summary>
        public int? ModeratorId { get; set; }

        [ForeignKey(nameof(ModeratorId))]
        public User? Moderator { get; set; }

        /// <summary>
        /// For moderator/admin roles: Collection of users managed by this moderator.
        /// </summary>
        public ICollection<User> ManagedUsers { get; set; } = new List<User>();

        // Expose enum representation for server-side logic
        [NotMapped]
        public UserRole RoleEnum => UserRoleExtensions.FromRoleName(Role);

        // Computed FullName for backward compatibility
        [NotMapped]
        public string FullName
        {
            get => string.IsNullOrWhiteSpace(LastName) ? FirstName : $"{FirstName} {LastName}";
            set
            {
                // Parse fullName to firstName and lastName
                var parts = value.Split(' ', System.StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length > 0)
                {
                    FirstName = parts[0];
                    LastName = parts.Length > 1 ? string.Join(" ", parts.Skip(1)) : null;
                }
            }
        }
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

        /// <summary>
        /// The moderator who owns this queue.
        /// All users under this moderator can access and use this queue.
        /// </summary>
        [Required]
        public int ModeratorId { get; set; }

        [ForeignKey(nameof(ModeratorId))]
        public User? Moderator { get; set; }

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

        /// <summary>
        /// The moderator who owns this message template.
        /// All queues under this moderator can use these templates.
        /// </summary>
        public int? ModeratorId { get; set; }

        [ForeignKey(nameof(ModeratorId))]
        public User? Moderator { get; set; }

        /// <summary>
        /// Queue this template belongs to (one-to-many: Queue -> Templates).
        /// This makes templates per-queue instead of moderator-global.
        /// Option A: Each queue can have its own templates.
        /// </summary>
        public int? QueueId { get; set; }

        [ForeignKey(nameof(QueueId))]
        public Queue? Queue { get; set; }

        [Required]
        public bool IsShared { get; set; }

        [Required]
        public bool IsActive { get; set; } = true;

        [Required]
        public DateTime CreatedAt { get; set; }

        /// <summary>
        /// Timestamp when template was last updated (for UI display, optimistic locking).
        /// </summary>
        public DateTime? UpdatedAt { get; set; }

        /// <summary>
        /// Navigation to optional condition (one-to-one).
        /// Null TemplateId in MessageCondition = template has no custom condition (uses default).
        /// Non-null TemplateId in MessageCondition = template has custom condition.
        /// </summary>
        public MessageCondition? Condition { get; set; }
    }

    [Table("Messages")]
    public class Message
    {
        [Key]
        public long Id { get; set; }

        public int? PatientId { get; set; }

        public int? TemplateId { get; set; }

        [ForeignKey(nameof(TemplateId))]
        public MessageTemplate? Template { get; set; }

        public int? QueueId { get; set; }

        [ForeignKey(nameof(QueueId))]
        public Queue? Queue { get; set; }

        public int? SenderUserId { get; set; }

        /// <summary>
        /// The moderator associated with this message.
        /// Tracks quota consumption and session usage per moderator.
        /// </summary>
        public int? ModeratorId { get; set; }

        [ForeignKey(nameof(ModeratorId))]
        public User? Moderator { get; set; }

        [StringLength(100)]
        public string? ProviderMessageId { get; set; }

        [StringLength(20)]
        public string Channel { get; set; } = "whatsapp";

        [Required]
        [StringLength(20)]
        [Phone]
        public string? PatientPhone { get; set; }

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

        [StringLength(500)]
        public string? ErrorMessage { get; set; }

        [Required]
        public int Attempts { get; set; }

        public DateTime? LastAttemptAt { get; set; }

        public DateTime? SentAt { get; set; }

        [Required]
        public DateTime CreatedAt { get; set; }

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }

    [Table("FailedTasks")]
    public class FailedTask
    {
        [Key]
        public long Id { get; set; }

        public long? MessageId { get; set; }

        [ForeignKey(nameof(MessageId))]
        public Message? Message { get; set; }

        public int? PatientId { get; set; }

        [ForeignKey(nameof(PatientId))]
        public Patient? Patient { get; set; }

        public int? QueueId { get; set; }

        [ForeignKey(nameof(QueueId))]
        public Queue? Queue { get; set; }

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

        [ForeignKey(nameof(ModeratorUserId))]
        public User? Moderator { get; set; }

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

        /// <summary>
        /// Remaining messages quota
        /// </summary>
        [NotMapped]
        public int RemainingMessages => MessagesQuota - ConsumedMessages;

        /// <summary>
        /// Remaining queues quota
        /// </summary>
        [NotMapped]
        public int RemainingQueues => QueuesQuota - ConsumedQueues;

        /// <summary>
        /// Check if quota is low (less than 10%)
        /// </summary>
        [NotMapped]
        public bool IsMessagesQuotaLow => MessagesQuota > 0 && (RemainingMessages * 100.0 / MessagesQuota) < 10;

        [NotMapped]
        public bool IsQueuesQuotaLow => QueuesQuota > 0 && (RemainingQueues * 100.0 / QueuesQuota) < 10;
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

    [Table("MessageSessions")]
    public class MessageSession
    {
        [Key]
        public Guid Id { get; set; }

        [Required]
        public int QueueId { get; set; }

        [ForeignKey(nameof(QueueId))]
        public Queue? Queue { get; set; }

        [Required]
        public int UserId { get; set; }

        [Required]
        [StringLength(20)]
        public string Status { get; set; } = "active"; // active, paused, completed, cancelled

        [Required]
        public int TotalMessages { get; set; }

        [Required]
        public int SentMessages { get; set; }

        [Required]
        public DateTime StartTime { get; set; }

        public DateTime? EndTime { get; set; }

        public DateTime? LastUpdated { get; set; }
    }

    /// <summary>
    /// Settings and configuration specific to each moderator
    /// </summary>
    [Table("ModeratorSettings")]
    public class ModeratorSettings
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int ModeratorUserId { get; set; }

        [ForeignKey(nameof(ModeratorUserId))]
        public User? Moderator { get; set; }

        /// <summary>
        /// WhatsApp phone number associated with this moderator
        /// </summary>
        [StringLength(20)]
        [Phone]
        public string? WhatsAppPhoneNumber { get; set; }

        /// <summary>
        /// Whether this moderator's settings are active
        /// </summary>
        public bool IsActive { get; set; } = true;

        [Required]
        public DateTime CreatedAt { get; set; }

        [Required]
        public DateTime UpdatedAt { get; set; }
    }

    /// <summary>
    /// MessageCondition: One-to-one relationship with MessageTemplate.
    /// Represents optional condition criteria for template selection during message sending.
    /// 
    /// Semantics:
    /// - Null TemplateId in MessageCondition = Template has NO condition (default template for queue)
    /// - Non-null TemplateId in MessageCondition = Template has custom condition with this criteria
    /// 
    /// Validation:
    /// - Unique index on TemplateId (max one condition per template)
    /// - QueueId is required (each condition belongs to a specific queue)
    /// - Operator must be one of: EQUAL, GREATER, LESS, RANGE
    /// - Value required for EQUAL/GREATER/LESS; MinValue and MaxValue required for RANGE
    /// </summary>
    [Table("MessageConditions")]
    public class MessageCondition
    {
        [Key]
        public int Id { get; set; }

        /// <summary>
        /// One-to-one relationship with MessageTemplate.
        /// Unique constraint ensures max one condition per template.
        /// Null TemplateId = no condition (use default template for queue).
        /// Non-null TemplateId with this condition object = template has custom condition.
        /// </summary>
        public int? TemplateId { get; set; }

        [ForeignKey(nameof(TemplateId))]
        public MessageTemplate? Template { get; set; }

        /// <summary>
        /// Queue this condition belongs to.
        /// Each queue can have multiple conditions (one per template).
        /// </summary>
        [Required]
        public int QueueId { get; set; }

        [ForeignKey(nameof(QueueId))]
        public Queue? Queue { get; set; }

        /// <summary>
        /// Operator: EQUAL, GREATER, LESS, RANGE
        /// Determines how to compare the Value field(s).
        /// </summary>
        [Required]
        [StringLength(20)]
        public string Operator { get; set; } = "EQUAL";

        /// <summary>
        /// For EQUAL, GREATER, LESS: single comparison value.
        /// Example: EQUAL=42 means "send when field = 42"
        /// </summary>
        public int? Value { get; set; }

        /// <summary>
        /// For RANGE: minimum boundary (inclusive).
        /// Example: MinValue=10 with MaxValue=20 means "send when 10 <= field <= 20"
        /// </summary>
        public int? MinValue { get; set; }

        /// <summary>
        /// For RANGE: maximum boundary (inclusive).
        /// Constraint: MinValue <= MaxValue must be enforced at service level.
        /// </summary>
        public int? MaxValue { get; set; }

        [Required]
        public DateTime CreatedAt { get; set; }

        /// <summary>
        /// Timestamp of last update (for UI, tracking changes).
        /// </summary>
        public DateTime? UpdatedAt { get; set; }
    }
}

