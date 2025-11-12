using System;
using System.ComponentModel.DataAnnotations;

namespace Clinics.Api.DTOs
{
    /// <summary>
    /// DTO for creating a new message template (per-queue).
    /// </summary>
    public class CreateTemplateRequest
    {
        [Required(ErrorMessage = "Template title is required")]
        [StringLength(100, MinimumLength = 3, ErrorMessage = "Title must be between 3 and 100 characters")]
        public string Title { get; set; } = null!;

        [Required(ErrorMessage = "Template content is required")]
        [StringLength(2000, MinimumLength = 10, ErrorMessage = "Content must be between 10 and 2000 characters")]
        public string Content { get; set; } = null!;

        [Required(ErrorMessage = "Queue ID is required")]
        public int QueueId { get; set; }

        public bool IsShared { get; set; } = true;

        public bool IsActive { get; set; } = true;
    }

    /// <summary>
    /// DTO for updating an existing message template.
    /// </summary>
    public class UpdateTemplateRequest
    {
        [StringLength(100, MinimumLength = 3, ErrorMessage = "Title must be between 3 and 100 characters")]
        public string? Title { get; set; }

        [StringLength(2000, MinimumLength = 10, ErrorMessage = "Content must be between 10 and 2000 characters")]
        public string? Content { get; set; }

        public bool? IsShared { get; set; }

        public bool? IsActive { get; set; }
    }

    /// <summary>
    /// DTO for returning a message template to the client.
    /// Template state is encoded via its associated Condition.Operator:
    ///   - DEFAULT: This template is the queue default.
    ///   - UNCONDITIONED: Template has no custom criteria ("بدون شرط").
    ///   - EQUAL/GREATER/LESS/RANGE: Active condition rules.
    /// </summary>
    public class TemplateDto
    {
        public int Id { get; set; }

        public string Title { get; set; } = null!;

        public string Content { get; set; } = null!;

        public int ModeratorId { get; set; }

        public int QueueId { get; set; }

        public bool IsShared { get; set; }

        public bool IsActive { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime? UpdatedAt { get; set; }

        /// <summary>
        /// Associated condition for this template. 
        /// Operator encodes state: DEFAULT=queue default, UNCONDITIONED=no criteria, or an active operator.
        /// </summary>
        public ConditionDto? Condition { get; set; }
    }

    /// <summary>
    /// DTO for creating a message condition (defines when a template is selected).
    /// 
    /// Operators:
    /// - UNCONDITIONED: No selection criteria (values must be null).
    /// - DEFAULT: Queue default template (unique per queue, values must be null).
    /// - EQUAL/GREATER/LESS/RANGE: Active conditions with numeric comparison.
    /// </summary>
    public class CreateConditionRequest
    {
        [Required(ErrorMessage = "Template ID is required")]
        public int TemplateId { get; set; }

        [Required(ErrorMessage = "Queue ID is required")]
        public int QueueId { get; set; }

        [Required(ErrorMessage = "Operator is required")]
        [RegularExpression("^(UNCONDITIONED|DEFAULT|EQUAL|GREATER|LESS|RANGE)$", ErrorMessage = "Operator must be UNCONDITIONED, DEFAULT, EQUAL, GREATER, LESS, or RANGE")]
        public string Operator { get; set; } = "UNCONDITIONED";

        /// <summary>
        /// For EQUAL, GREATER, LESS operators.
        /// </summary>
        public int? Value { get; set; }

        /// <summary>
        /// For RANGE operator: minimum boundary (inclusive).
        /// </summary>
        public int? MinValue { get; set; }

        /// <summary>
        /// For RANGE operator: maximum boundary (inclusive).
        /// </summary>
        public int? MaxValue { get; set; }
    }

    /// <summary>
    /// DTO for updating a message condition.
    /// Supports transitioning between UNCONDITIONED, DEFAULT, and active operators.
    /// </summary>
    public class UpdateConditionRequest
    {
        [RegularExpression("^(UNCONDITIONED|DEFAULT|EQUAL|GREATER|LESS|RANGE)$", ErrorMessage = "Operator must be UNCONDITIONED, DEFAULT, EQUAL, GREATER, LESS, or RANGE")]
        public string? Operator { get; set; }

        public int? Value { get; set; }

        public int? MinValue { get; set; }

        public int? MaxValue { get; set; }
    }

    /// <summary>
    /// DTO for returning a message condition to the client.
    /// </summary>
    public class ConditionDto
    {
        public int Id { get; set; }

        public int? TemplateId { get; set; }

        public int QueueId { get; set; }

        public string Operator { get; set; } = "EQUAL";

        public int? Value { get; set; }

        public int? MinValue { get; set; }

        public int? MaxValue { get; set; }

        public DateTime CreatedAt { get; set; }

        public DateTime? UpdatedAt { get; set; }
    }

    /// <summary>
    /// Generic response for list operations.
    /// </summary>
    public class ListResponse<T>
    {
        public List<T> Items { get; set; } = new();

        public int TotalCount { get; set; }

        public int PageNumber { get; set; }

        public int PageSize { get; set; }

        // Guard against divide-by-zero when PageSize is not provided
        public int TotalPages => PageSize <= 0
            ? (TotalCount > 0 ? 1 : 0)
            : (TotalCount + PageSize - 1) / PageSize;

        public bool HasPreviousPage => PageNumber > 1;

        public bool HasNextPage => PageNumber < TotalPages;
    }
}
