using System.ComponentModel.DataAnnotations;
using Clinics.Api.Validation;

namespace Clinics.Api.DTOs
{
    /// <summary>
    /// DTO for returning a patient to the client.
    /// </summary>
    public class PatientDto
    {
        public int Id { get; set; }

        public string FullName { get; set; } = null!;

        public string PhoneNumber { get; set; } = null!;

        /// <summary>
        /// Optional phone extension (e.g., "123" from "+201234567890 ext. 123").
        /// Extracted during normalization if present.
        /// </summary>
        public string? PhoneExtension { get; set; }

        public int Position { get; set; }

        public string Status { get; set; } = "waiting";
    }

    /// <summary>
    /// DTO for creating a new patient in a queue.
    /// </summary>
    public class CreatePatientRequest
    {
        [Required(ErrorMessage = "Queue ID is required")]
        public int QueueId { get; set; }

        [Required(ErrorMessage = "Full name is required")]
        [StringLength(100, MinimumLength = 2, ErrorMessage = "Full name must be between 2 and 100 characters")]
        public string FullName { get; set; } = null!;

        [Required(ErrorMessage = "Phone number is required")]
        [StringLength(35, MinimumLength = 5, ErrorMessage = "Phone number must be between 5 and 35 characters")]
        [CountryCodeRequired(ErrorMessage = "Phone number must include country code (e.g., +201234567890)")]
        public string PhoneNumber { get; set; } = null!;

        /// <summary>
        /// Optional phone extension (e.g., "123" from "+201234567890 ext. 123").
        /// Will be extracted during normalization if present in PhoneNumber.
        /// </summary>
        [StringLength(10, ErrorMessage = "Phone extension must not exceed 10 characters")]
        public string? PhoneExtension { get; set; }

        /// <summary>
        /// Optional desired position in queue. If not provided or 0, appends to end.
        /// If provided, patient is inserted at that position and existing patients shift +1.
        /// </summary>
        public int? Position { get; set; }
    }

    /// <summary>
    /// DTO for updating an existing patient.
    /// </summary>
    public class UpdatePatientRequest
    {
        [StringLength(100, MinimumLength = 2, ErrorMessage = "Full name must be between 2 and 100 characters")]
        public string? FullName { get; set; }

        [Phone(ErrorMessage = "Invalid phone number format")]
        [StringLength(35)]
        public string? PhoneNumber { get; set; }

        /// <summary>
        /// Optional phone extension to update.
        /// </summary>
        [StringLength(10, ErrorMessage = "Phone extension must not exceed 10 characters")]
        public string? PhoneExtension { get; set; }

        [StringLength(20)]
        public string? Status { get; set; }
    }

    /// <summary>
    /// DTO for reordering patients in a queue.
    /// If a position conflict occurs, the conflicting patient and all with greater positions shift +1.
    /// </summary>
    public class ReorderPatientsRequest
    {
        [Required(ErrorMessage = "Queue ID is required")]
        public int QueueId { get; set; }

        [Required(ErrorMessage = "Items list is required")]
        public List<ReorderItem> Items { get; set; } = new();

        public class ReorderItem
        {
            [Required]
            public int Id { get; set; }

            [Required]
            public int Position { get; set; }
        }
    }

    /// <summary>
    /// DTO for updating a patient's position in their queue.
    /// Position must be >= 1. If moved, conflicting patients shift accordingly.
    /// </summary>
    public class UpdatePatientPositionRequest
    {
        [Required(ErrorMessage = "Position is required")]
        [Range(1, int.MaxValue, ErrorMessage = "Position must be greater than or equal to 1")]
        public int Position { get; set; }
    }

    // Legacy DTO - kept for backward compatibility if needed
    public class PatientCreateRequest
    {
        [Required]
        public string FullName { get; set; } = null!;

        [Required]
        [Phone]
        public string PhoneNumber { get; set; } = null!;

        public int? DesiredPosition { get; set; }
    }
}

