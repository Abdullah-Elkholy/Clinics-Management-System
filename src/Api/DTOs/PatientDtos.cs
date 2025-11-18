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

    // PhoneExtension removed: phone numbers now treated as a single E.164 value.

        /// <summary>
        /// Country code for the phone number (e.g., "+20", "+966")
        /// </summary>
        public string? CountryCode { get; set; }

        /// <summary>
        /// Indicates whether the phone number has been validated for WhatsApp.
        /// null = not checked yet, true = valid WhatsApp number, false = invalid WhatsApp number.
        /// </summary>
        public bool? IsValidWhatsAppNumber { get; set; }

        public int Position { get; set; }

        public string Status { get; set; } = "waiting";
        
        public DateTime CreatedAt { get; set; }
        
        public DateTime? UpdatedAt { get; set; }
        
        public int? CreatedBy { get; set; }
        
        public int? UpdatedBy { get; set; }
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

    // PhoneExtension removed from create request.

        /// <summary>
        /// Optional country code (e.g., "+20", "+966"). If not provided, will be extracted from PhoneNumber.
        /// </summary>
        [StringLength(10)]
        public string? CountryCode { get; set; }

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

    // PhoneExtension removed from update request.

        /// <summary>
        /// Optional country code (e.g., "+20", "+966"). If not provided, will be extracted from PhoneNumber.
        /// </summary>
        [StringLength(10)]
        public string? CountryCode { get; set; }

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

