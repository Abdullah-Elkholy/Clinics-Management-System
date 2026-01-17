using System;
using System.ComponentModel.DataAnnotations;

namespace Clinics.Api.DTOs
{
    /// <summary>
    /// Request to create a new moderator
    /// </summary>
    public class CreateModeratorRequest
    {
        public string Username { get; set; } = null!;
        public string FirstName { get; set; } = null!;
        public string? LastName { get; set; }
        public string? Password { get; set; }
    }

    /// <summary>
    /// Request to update a moderator
    /// </summary>
    public class UpdateModeratorRequest
    {
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public bool? IsActive { get; set; }
    }

    /// <summary>
    /// Response for moderator with settings
    /// </summary>
    public class ModeratorDto
    {
        public int Id { get; set; }
        public string Username { get; set; } = null!;
        public string FirstName { get; set; } = null!;
        public string? LastName { get; set; }
        public string FullName => string.IsNullOrEmpty(LastName) ? FirstName : $"{FirstName} {LastName}";
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    /// <summary>
    /// Response for moderator with additional stats
    /// </summary>
    public class ModeratorDetailsDto : ModeratorDto
    {
        public int TotalManagedUsers { get; set; }
        public int TotalQueues { get; set; }
        public int TotalMessageTemplates { get; set; }
        public QuotaDto? Quota { get; set; }
    }

    /// <summary>
    /// Quota information for a moderator (admin list view with renamed fields).
    /// </summary>
    public class QuotaDto
    {
        public int Id { get; set; }

        /// <summary>
        /// Maximum messages quota.
        /// Uses long to support large values up to JavaScript's MAX_SAFE_INTEGER (9007199254740991).
        /// </summary>
        public long Limit { get; set; }

        /// <summary>
        /// Messages consumed so far.
        /// Uses long to match the database schema and support large values.
        /// </summary>
        public long Used { get; set; }

        /// <summary>
        /// Remaining messages (calculated). Returns -1 if Limit is -1 (unlimited).
        /// Can be negative if used exceeds limit.
        /// </summary>
        public long Remaining => Limit == -1 ? -1 : Limit - Used;

        /// <summary>
        /// Percentage of messages quota consumed (0-100). Returns 0 if Limit is -1 (unlimited).
        /// </summary>
        public decimal Percentage => Limit == -1 || Limit <= 0 ? 0 : (decimal)(Used * 100) / Limit;

        /// <summary>
        /// Whether messages quota is low (> 80% consumed). Returns false if Limit is -1 (unlimited).
        /// </summary>
        public bool IsLow => Limit != -1 && Limit > 0 && Percentage > 80;

        /// <summary>
        /// Maximum queues quota. Use -1 for unlimited.
        /// </summary>
        public int QueuesLimit { get; set; }

        /// <summary>
        /// Queues consumed.
        /// </summary>
        public int QueuesUsed { get; set; }

        /// <summary>
        /// Remaining queues (calculated). Returns -1 if QueuesLimit is -1 (unlimited).
        /// Can be negative if used exceeds limit.
        /// </summary>
        public int QueuesRemaining => QueuesLimit == -1 ? -1 : QueuesLimit - QueuesUsed;

        public DateTime UpdatedAt { get; set; }
    }

    /// <summary>
    /// Request to add a user under a moderator
    /// </summary>
    public class AddUserToModeratorRequest
    {
        public string Username { get; set; } = null!;
        public string FirstName { get; set; } = null!;
        public string? LastName { get; set; }
        public string? Password { get; set; }
    }

    /// <summary>
    /// Response for a user with their moderator info
    /// </summary>
    public class UserWithModeratorDto
    {
        public int Id { get; set; }
        public string Username { get; set; } = null!;
        public string FirstName { get; set; } = null!;
        public string? LastName { get; set; }
        public string FullName => string.IsNullOrEmpty(LastName) ? FirstName : $"{FirstName} {LastName}";
        public string Role { get; set; } = null!;
        public int? ModeratorId { get; set; }
        public string? ModeratorName { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    /// <summary>
    /// Response for list of users managed by a moderator
    /// </summary>
    public class ModeratorUsersListDto
    {
        public int ModeratorId { get; set; }
        public string ModeratorName { get; set; } = null!;
        public int TotalUsers { get; set; }
        public List<UserWithModeratorDto> Users { get; set; } = new();
    }

    /// <summary>
    /// Response for WhatsApp session info
    /// </summary>
    public class WhatsAppSessionDto
    {
        public int Id { get; set; }
        public int ModeratorUserId { get; set; }
        // SessionName, LastSyncAt, ProviderSessionId REMOVED - deprecated columns
        public string? Status { get; set; }
        public DateTime CreatedAt { get; set; }

        // Audit trail fields
        public int? CreatedByUserId { get; set; }
        public int? LastActivityUserId { get; set; }
        public DateTime? LastActivityAt { get; set; }
    }

    /// <summary>
    /// Request to link a Queue to a moderator (should happen automatically during creation)
    /// </summary>
    public class CreateQueueRequest
    {
        public string DoctorName { get; set; } = null!;
        public int? EstimatedWaitMinutes { get; set; }
        public int? CurrentPosition { get; set; }
        public int ModeratorId { get; set; }
    }
    /// <summary>
    /// Request to update a Queue
    /// </summary>
    public class UpdateQueueRequest
    {
        public string? DoctorName { get; set; }
        public int? EstimatedWaitMinutes { get; set; }
        public int? CurrentPosition { get; set; }
    }

    /// <summary>
    /// Request to create a message template for a moderator
    /// </summary>
    public class CreateMessageTemplateRequest
    {
        public string Title { get; set; } = null!;
        public string Content { get; set; } = null!;
        public bool IsShared { get; set; } = true;
    }

    /// <summary>
    /// Response for a message template with moderator info
    /// </summary>
    public class MessageTemplateDto
    {
        public int Id { get; set; }
        public string Title { get; set; } = null!;
        public string Content { get; set; } = null!;
        public int CreatedBy { get; set; }
        public int ModeratorId { get; set; }
        public bool IsShared { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    /// <summary>
    /// Request to add quota to a moderator.
    /// </summary>
    public class AddQuotaRequest
    {
        /// <summary>
        /// Messages quota limit. Use -1 for unlimited, or a positive number for a specific limit.
        /// Uses long to support large values up to JavaScript's MAX_SAFE_INTEGER (9007199254740991).
        /// </summary>
        [Required(ErrorMessage = "Limit (messages quota) is required")]
        public long Limit { get; set; }

        /// <summary>
        /// Queues quota limit. Use -1 for unlimited, or a positive number for a specific limit.
        /// </summary>
        [Required(ErrorMessage = "Queues limit is required")]
        public int QueuesLimit { get; set; }
    }

    /// <summary>
    /// Request to update quota.
    /// Use -1 for unlimited, or a positive number for a specific limit.
    /// </summary>
    public class UpdateQuotaRequest
    {
        /// <summary>
        /// Messages quota limit. Use -1 for unlimited, or a positive number for a specific limit.
        /// Uses long to support large values up to JavaScript's MAX_SAFE_INTEGER (9007199254740991).
        /// </summary>
        public long? Limit { get; set; }

        /// <summary>
        /// Queues quota limit. Use -1 for unlimited, or a positive number for a specific limit.
        /// </summary>
        public int? QueuesLimit { get; set; }
    }

    /// <summary>
    /// Response for moderator's own quota with renamed fields.
    /// </summary>
    public class MyQuotaDto
    {
        /// <summary>
        /// Maximum messages this moderator can send.
        /// Uses long to support large values up to JavaScript's MAX_SAFE_INTEGER (9007199254740991).
        /// </summary>
        public long Limit { get; set; }

        /// <summary>
        /// Messages consumed so far.
        /// Uses long to match the database schema and support large values.
        /// </summary>
        public long Used { get; set; }

        /// <summary>
        /// Remaining messages. Returns -1 if Limit is -1 (unlimited).
        /// Can be negative if used exceeds limit.
        /// </summary>
        public long Remaining => Limit == -1 ? -1 : Limit - Used;

        /// <summary>
        /// Percentage of quota consumed (0-100). Returns 0 if Limit is -1 (unlimited).
        /// </summary>
        public decimal Percentage => Limit == -1 || Limit <= 0 ? 0 : (decimal)(Used * 100) / Limit;

        /// <summary>
        /// Whether quota is low (> 80% consumed). Returns false if Limit is -1 (unlimited).
        /// </summary>
        public bool IsLowQuota => Limit != -1 && Limit > 0 && Percentage > 80;

        /// <summary>
        /// Maximum queues. Use -1 for unlimited.
        /// </summary>
        public int QueuesLimit { get; set; }

        /// <summary>
        /// Queues consumed.
        /// </summary>
        public int QueuesUsed { get; set; }

        /// <summary>
        /// Remaining queues. Returns -1 if QueuesLimit is -1 (unlimited).
        /// Can be negative if used exceeds limit.
        /// </summary>
        public int QueuesRemaining => QueuesLimit == -1 ? -1 : QueuesLimit - QueuesUsed;
    }
}
