using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace Clinics.Domain
{
    [Table("Users")]
    public class User : ISoftDeletable
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

        // Audit fields
        [Required]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedAt { get; set; }

        public int? UpdatedBy { get; set; }

        /// <summary>
        /// Last successful login timestamp
        /// </summary>
        public DateTime? LastLogin { get; set; }

        // Soft-delete fields
        [Required]
        public bool IsDeleted { get; set; } = false;

        public DateTime? DeletedAt { get; set; }

        public int? DeletedBy { get; set; }
    }

    [Table("Queues")]
    public class Queue : ISoftDeletable
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [StringLength(100)]
        public string DoctorName { get; set; } = null!;

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
        public int CurrentPosition { get; set; } = 1;

        [Required]
        public int EstimatedWaitMinutes { get; set; } = 15;

        // Audit fields
        [Required]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public DateTime? UpdatedAt { get; set; }

        public int? UpdatedBy { get; set; }

        // Soft-delete fields
        [Required]
        public bool IsDeleted { get; set; } = false;

        public DateTime? DeletedAt { get; set; }

        public int? DeletedBy { get; set; }
    }

    [Table("Patients")]
    public class Patient : ISoftDeletable
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int QueueId { get; set; }

        [ForeignKey(nameof(QueueId))]
        public Queue? Queue { get; set; } // OnDelete: Restrict (handled in ApplicationDbContext)

        [Required]
        [StringLength(100)]
        public string FullName { get; set; } = null!;

        [Required]
        [StringLength(20)]
        [Phone]
        public string PhoneNumber { get; set; } = null!;

    // PhoneExtension removed: all numbers validated and stored as single E.164 phone number.

        /// <summary>
        /// Country code for the phone number (e.g., "+20", "+966")
        /// Stored separately for display and validation purposes
        /// </summary>
        [Required]
        [StringLength(10)]
        public string CountryCode { get; set; } = "+20";

        [Required]
        public int Position { get; set; }

        [Required]
        [StringLength(20)]
        public string Status { get; set; } = "waiting";

        // Audit fields
        [Required]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public int? CreatedBy { get; set; }

        public DateTime? UpdatedAt { get; set; }

        public int? UpdatedBy { get; set; }

        // Soft-delete fields
        [Required]
        public bool IsDeleted { get; set; } = false;

        public DateTime? DeletedAt { get; set; }

        public int? DeletedBy { get; set; }
    }

    [Table("MessageTemplates")]
    public class MessageTemplate : ISoftDeletable
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
        [Required]
        public int ModeratorId { get; set; }

        [ForeignKey(nameof(ModeratorId))]
        public User? Moderator { get; set; }

        /// <summary>
        /// Queue this template belongs to (one-to-many: Queue -> Templates).
        /// This makes templates per-queue instead of moderator-global.
        /// Where each queue can have its own templates.
        /// </summary>
        [Required]
        public int QueueId { get; set; }

        [ForeignKey(nameof(QueueId))]
        public Queue? Queue { get; set; } // OnDelete: Restrict (handled in ApplicationDbContext)

        [Required]
        public DateTime CreatedAt { get; set; }

        /// <summary>
        /// Timestamp when template was last updated (for UI display, optimistic locking).
        /// </summary>
        public DateTime? UpdatedAt { get; set; }

        /// <summary>
        /// Foreign key to the one-to-one condition (REQUIRED relationship at database level).
        /// Every MessageTemplate MUST have exactly one MessageCondition.
        /// 
        /// Database-level enforcement:
        /// - MessageConditionId is [Required] (non-nullable in database)
        /// - Unique index on MessageConditionId ensures exactly one condition per template
        /// - Foreign key with CASCADE delete (deleting template deletes condition)
        /// - ApplicationDbContext configures this as .IsRequired() with .OnDelete(DeleteBehavior.Cascade)
        /// </summary>
        [Required]
        public int MessageConditionId { get; set; }

        /// <summary>
        /// Navigation to one-to-one condition (REQUIRED relationship at database level).
        /// Every MessageTemplate MUST have exactly one MessageCondition.
        /// 
        /// Condition.Operator encodes template state:
        ///   - DEFAULT: This template is the queue default (selected when no active condition matches). Exactly one per queue enforced by filtered unique index.
        ///   - UNCONDITIONED: Template has no custom selection criteria ("بدون شرط"). Used for templates without specific rules.
        ///   - EQUAL/GREATER/LESS/RANGE: Active condition determining when this template is selected.
        /// </summary>
        [ForeignKey(nameof(MessageConditionId))]
        public MessageCondition? Condition { get; set; }

        // Audit fields (UpdatedBy already present; ensure it exists)
        public int? UpdatedBy { get; set; }

        // Soft-delete fields
        [Required]
        public bool IsDeleted { get; set; } = false;

        public DateTime? DeletedAt { get; set; }

        public int? DeletedBy { get; set; }
    }

    [Table("Messages")]
    public class Message : ISoftDeletable
    {
        [Key]
        public long Id { get; set; }

        public int? PatientId { get; set; }

        public int? TemplateId { get; set; }

        [ForeignKey(nameof(TemplateId))]
        public MessageTemplate? Template { get; set; }

        public int? QueueId { get; set; }

        [ForeignKey(nameof(QueueId))]
        public Queue? Queue { get; set; } // OnDelete: Restrict (handled in ApplicationDbContext)

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

        // Audit fields
        public int? CreatedBy { get; set; }

        public int? UpdatedBy { get; set; }

        // Soft-delete fields
        [Required]
        public bool IsDeleted { get; set; } = false;

        public DateTime? DeletedAt { get; set; }

        public int? DeletedBy { get; set; }
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
        public Queue? Queue { get; set; } // OnDelete: Restrict (handled in ApplicationDbContext)

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
        public User? Moderator { get; set; } // OnDelete: Restrict (handled in ApplicationDbContext)

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

        // Audit fields
        [Required]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public int? CreatedBy { get; set; }

        public int? UpdatedBy { get; set; }

        // Soft-delete fields
        [Required]
        public bool IsDeleted { get; set; } = false;

        public DateTime? DeletedAt { get; set; }

        public int? DeletedBy { get; set; }
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
        public Queue? Queue { get; set; } // OnDelete: Restrict (handled in ApplicationDbContext)

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
        public User? Moderator { get; set; } // OnDelete: Restrict (handled in ApplicationDbContext)

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
    /// MessageCondition: One-to-one REQUIRED relationship with MessageTemplate.
    /// Represents condition criteria for template selection during message sending.
    /// 
    /// Relationship:
    /// - The relationship is owned by MessageTemplate (MessageTemplate has MessageConditionId foreign key)
    /// - Every MessageCondition MUST belong to exactly one MessageTemplate
    /// - Every MessageTemplate MUST have exactly one MessageCondition
    /// 
    /// Validation:
    /// - Unique index on MessageTemplate.MessageConditionId (one condition per template)
    /// - QueueId is required (each condition belongs to a specific queue)
    /// - Operator must be one of: DEFAULT, UNCONDITIONED, EQUAL, GREATER, LESS, RANGE
    /// - Value required for EQUAL/GREATER/LESS; MinValue and MaxValue required for RANGE
    /// - DEFAULT operator: Exactly one per queue (enforced by filtered unique index)
    /// </summary>
    [Table("MessageConditions")]
    public class MessageCondition : ISoftDeletable
    {
        [Key]
        public int Id { get; set; }

        /// <summary>
        /// Navigation property to the one-to-one REQUIRED relationship with MessageTemplate.
        /// 
        /// The relationship is now owned by MessageTemplate (MessageTemplate has MessageConditionId foreign key).
        /// Every MessageCondition MUST belong to exactly one MessageTemplate.
        /// 
        /// The Operator encodes the semantic state of the template:
        ///   - DEFAULT: This template is the queue default (fallback when no active condition matches).
        ///              Exactly one per queue enforced by filtered unique index: WHERE Operator = 'DEFAULT'.
        ///   - UNCONDITIONED: No custom criteria; template selection is unconditioned ("بدون شرط").
        ///   - EQUAL/GREATER/LESS/RANGE: Active condition; template selected when patient field matches operator/values.
        /// </summary>
        public MessageTemplate? Template { get; set; }

        /// <summary>
        /// Queue this condition belongs to.
        /// Each queue can have multiple conditions (one per template).
        /// </summary>
        [Required]
        public int QueueId { get; set; }

        [ForeignKey(nameof(QueueId))]
        public Queue? Queue { get; set; } // OnDelete: Restrict (handled in ApplicationDbContext)

        /// <summary>
        /// Operator encodes template state and selection logic:
        ///   - UNCONDITIONED: No values required (all numeric fields null); template has no selection criteria.
        ///   - DEFAULT: No values required; this is queue default (fallback). Unique per queue.
        ///   - EQUAL: Single value required; send when field == Value.
        ///   - GREATER: Single value required; send when field > Value.
        ///   - LESS: Single value required; send when field < Value.
        ///   - RANGE: MinValue and MaxValue required; send when MinValue <= field <= MaxValue.
        /// </summary>
        [Required]
        [StringLength(20)]
        public string Operator { get; set; } = "UNCONDITIONED";

        /// <summary>
        /// For EQUAL, GREATER, LESS: single comparison value.
        /// Example: EQUAL with Value=42 means "send when field = 42"
        /// Must be null for UNCONDITIONED, DEFAULT, or RANGE.
        /// </summary>
        public int? Value { get; set; }

        /// <summary>
        /// For RANGE: minimum boundary (inclusive).
        /// Example: MinValue=10 with MaxValue=20 means "send when 10 <= field <= 20"
        /// Must be null for UNCONDITIONED, DEFAULT, EQUAL, GREATER, LESS.
        /// </summary>
        public int? MinValue { get; set; }

        /// <summary>
        /// For RANGE: maximum boundary (inclusive).
        /// Constraint: MinValue <= MaxValue must be enforced at service level.
        /// Must be null for UNCONDITIONED, DEFAULT, EQUAL, GREATER, LESS.
        /// </summary>
        public int? MaxValue { get; set; }

        [Required]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Timestamp of last update (for UI, tracking changes).
        /// </summary>
        public DateTime? UpdatedAt { get; set; }

        // Audit fields
        public int? CreatedBy { get; set; }

        public int? UpdatedBy { get; set; }

        // Soft-delete fields
        [Required]
        public bool IsDeleted { get; set; } = false;

        public DateTime? DeletedAt { get; set; }

        public int? DeletedBy { get; set; }
    }

    /// <summary>
    /// AuditLog entity tracks all significant operations for compliance and debugging.
    /// Used to log: Create, Update, SoftDelete, Restore, Purge, and quota operations.
    /// </summary>
    [Table("AuditLogs")]
    public class AuditLog
    {
        [Key]
        public int Id { get; set; }

        /// <summary>
        /// The type of action performed (Create, Update, SoftDelete, Restore, Purge, etc.)
        /// </summary>
        [Required]
        public AuditAction Action { get; set; }

        /// <summary>
        /// The entity type being modified (e.g., "Queue", "Patient", "MessageTemplate").
        /// </summary>
        [Required]
        [StringLength(50)]
        public string EntityType { get; set; } = null!;

        /// <summary>
        /// The primary key of the entity being modified.
        /// </summary>
        [Required]
        public int EntityId { get; set; }

        /// <summary>
        /// The ID of the user who performed the action.
        /// </summary>
        public int? ActorUserId { get; set; }

        [ForeignKey(nameof(ActorUserId))]
        public User? Actor { get; set; }

        /// <summary>
        /// Timestamp when the action occurred.
        /// </summary>
        [Required]
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// JSON representation of changes (new values after operation, or reason for deletion).
        /// Stored as string for flexibility across entity types.
        /// Example: {"QueueId":5,"PatientCount":0,"MessageCount":0}
        /// </summary>
        [Column(TypeName = "nvarchar(max)")]
        public string? Changes { get; set; }

        /// <summary>
        /// Optional notes or reason for the operation (e.g., "User requested deletion", "Quota recovery").
        /// </summary>
        [StringLength(500)]
        public string? Notes { get; set; }

        /// <summary>
        /// Optional JSON for additional context (e.g., quota released: 100, cascade impact).
        /// </summary>
        [Column(TypeName = "nvarchar(max)")]
        public string? Metadata { get; set; }
    }
}

