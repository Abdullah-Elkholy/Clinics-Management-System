using System.ComponentModel.DataAnnotations;

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
        [Phone(ErrorMessage = "Invalid phone number format")]
        [StringLength(20)]
        public string PhoneNumber { get; set; } = null!;

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
        [StringLength(20)]
        public string? PhoneNumber { get; set; }

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

