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
        public string? WhatsAppPhoneNumber { get; set; }
    }

    /// <summary>
    /// Request to update a moderator
    /// </summary>
    public class UpdateModeratorRequest
    {
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? WhatsAppPhoneNumber { get; set; }
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
        public string? WhatsAppPhoneNumber { get; set; }
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
        /// </summary>
        public int Limit { get; set; }
        
        /// <summary>
        /// Messages consumed so far.
        /// </summary>
        public int Used { get; set; }
        
        /// <summary>
        /// Remaining messages (calculated).
        /// </summary>
        public int Remaining => Limit - Used;
        
        /// <summary>
        /// Percentage of messages quota consumed (0-100).
        /// </summary>
        public decimal Percentage => Limit > 0 ? (decimal)(Used * 100) / Limit : 0;
        
        /// <summary>
        /// Whether messages quota is low (> 80% consumed).
        /// </summary>
        public bool IsLow => Percentage > 80;
        
        /// <summary>
        /// Maximum queues quota.
        /// </summary>
        public int QueuesLimit { get; set; }
        
        /// <summary>
        /// Queues consumed.
        /// </summary>
        public int QueuesUsed { get; set; }
        
        /// <summary>
        /// Remaining queues (calculated).
        /// </summary>
        public int QueuesRemaining => QueuesLimit - QueuesUsed;
        
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
        public string? SessionName { get; set; }
        public string? Status { get; set; }
        public DateTime? LastSyncAt { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    /// <summary>
    /// Request to link a Queue to a moderator (should happen automatically during creation)
    /// </summary>
    public class CreateQueueRequest
    {
        public string DoctorName { get; set; } = null!;
        public string? Description { get; set; }
        public int? EstimatedWaitMinutes { get; set; }
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
        [Required(ErrorMessage = "Limit (messages quota) is required")]
        [Range(1, int.MaxValue, ErrorMessage = "Limit must be at least 1")]
        public int Limit { get; set; }

        [Required(ErrorMessage = "Queues limit is required")]
        [Range(1, int.MaxValue, ErrorMessage = "Queues limit must be at least 1")]
        public int QueuesLimit { get; set; }
    }

    /// <summary>
    /// Request to update quota.
    /// </summary>
    public class UpdateQuotaRequest
    {
        [Range(1, int.MaxValue, ErrorMessage = "Limit must be at least 1")]
        public int? Limit { get; set; }

        [Range(1, int.MaxValue, ErrorMessage = "Queues limit must be at least 1")]
        public int? QueuesLimit { get; set; }
    }

    /// <summary>
    /// Response for moderator's own quota with renamed fields.
    /// </summary>
    public class MyQuotaDto
    {
        /// <summary>
        /// Maximum messages this moderator can send.
        /// </summary>
        public int Limit { get; set; }

        /// <summary>
        /// Messages consumed so far.
        /// </summary>
        public int Used { get; set; }

        /// <summary>
        /// Remaining messages.
        /// </summary>
        public int Remaining => Limit - Used;

        /// <summary>
        /// Percentage of quota consumed (0-100).
        /// </summary>
        public decimal Percentage => Limit > 0 ? (decimal)(Used * 100) / Limit : 0;

        /// <summary>
        /// Whether quota is low (> 80% consumed).
        /// </summary>
        public bool IsLowQuota => Percentage > 80;

        /// <summary>
        /// Maximum queues.
        /// </summary>
        public int QueuesLimit { get; set; }

        /// <summary>
        /// Queues consumed.
        /// </summary>
        public int QueuesUsed { get; set; }

        /// <summary>
        /// Remaining queues.
        /// </summary>
        public int QueuesRemaining => QueuesLimit - QueuesUsed;
    }
}
