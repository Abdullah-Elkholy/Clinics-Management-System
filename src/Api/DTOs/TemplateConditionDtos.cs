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
        /// Null = template uses default condition (no custom criteria).
        /// Non-null = template has custom condition with these criteria.
        /// </summary>
        public ConditionDto? Condition { get; set; }
    }

    /// <summary>
    /// DTO for creating a message condition (defines when a template is selected).
    /// 
    /// Semantics:
    /// - Null TemplateId = Condition represents "no custom condition" (default template)
    /// - Non-null TemplateId = Condition belongs to this template
    /// </summary>
    public class CreateConditionRequest
    {
        [Required(ErrorMessage = "Template ID is required")]
        public int TemplateId { get; set; }

        [Required(ErrorMessage = "Queue ID is required")]
        public int QueueId { get; set; }

        [Required(ErrorMessage = "Operator is required")]
        [RegularExpression("^(EQUAL|GREATER|LESS|RANGE)$", ErrorMessage = "Operator must be EQUAL, GREATER, LESS, or RANGE")]
        public string Operator { get; set; } = "EQUAL";

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
    /// </summary>
    public class UpdateConditionRequest
    {
        [RegularExpression("^(EQUAL|GREATER|LESS|RANGE)$", ErrorMessage = "Operator must be EQUAL, GREATER, LESS, or RANGE")]
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

        public int TotalPages => (TotalCount + PageSize - 1) / PageSize;

        public bool HasPreviousPage => PageNumber > 1;

        public bool HasNextPage => PageNumber < TotalPages;
    }
}
