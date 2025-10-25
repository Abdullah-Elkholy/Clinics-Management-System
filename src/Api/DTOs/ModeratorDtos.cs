namespace Clinics.Api.DTOs
{
    /// <summary>
    /// Request to create a new moderator
    /// </summary>
    public class CreateModeratorRequest
    {
        public string Username { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public string? Email { get; set; }
        public string? PhoneNumber { get; set; }
        public string? Password { get; set; }
        public string? WhatsAppPhoneNumber { get; set; }
    }

    /// <summary>
    /// Request to update a moderator
    /// </summary>
    public class UpdateModeratorRequest
    {
        public string? FullName { get; set; }
        public string? Email { get; set; }
        public string? PhoneNumber { get; set; }
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
        public string FullName { get; set; } = null!;
        public string? Email { get; set; }
        public string? PhoneNumber { get; set; }
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
    /// Quota information for a moderator
    /// </summary>
    public class QuotaDto
    {
        public int Id { get; set; }
        public int MessagesQuota { get; set; }
        public int ConsumedMessages { get; set; }
        public int RemainingMessages { get; set; }
        public int QueuesQuota { get; set; }
        public int ConsumedQueues { get; set; }
        public int RemainingQueues { get; set; }
        public bool IsMessagesQuotaLow { get; set; }
        public bool IsQueuesQuotaLow { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    /// <summary>
    /// Request to add a user under a moderator
    /// </summary>
    public class AddUserToModeratorRequest
    {
        public string Username { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public string? Email { get; set; }
        public string? PhoneNumber { get; set; }
        public string? Password { get; set; }
    }

    /// <summary>
    /// Response for a user with their moderator info
    /// </summary>
    public class UserWithModeratorDto
    {
        public int Id { get; set; }
        public string Username { get; set; } = null!;
        public string FullName { get; set; } = null!;
        public string Role { get; set; } = null!;
        public string? Email { get; set; }
        public string? PhoneNumber { get; set; }
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
}
