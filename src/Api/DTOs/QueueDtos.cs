using System.ComponentModel.DataAnnotations;
using Clinics.Domain;

namespace Clinics.Api.DTOs
{
    public class QueueCreateRequest
    {
        [Required]
        [StringLength(200, MinimumLength = 1, ErrorMessage = "DoctorName must be between 1 and 200 characters")]
        public string DoctorName { get; set; } = null!;

        // optional: who created this queue (client may pass current user id)
        public int? CreatedBy { get; set; }

        // optional estimated wait in minutes - must be non-negative
        [Range(0, int.MaxValue, ErrorMessage = "EstimatedWaitMinutes must be non-negative")]
        public int? EstimatedWaitMinutes { get; set; }
    }

    public class QueueUpdateRequest
    {
        [Required]
        public string DoctorName { get; set; } = null!;
        [Range(0, int.MaxValue, ErrorMessage = "EstimatedWaitMinutes must be non-negative")]
        public int? EstimatedWaitMinutes { get; set; }
        public int? CurrentPosition { get; set; }
    }

    public class QueueDto
    {
        public int Id { get; set; }
        public string DoctorName { get; set; } = null!;
        public int CreatedBy { get; set; }
        public int ModeratorId { get; set; }  // Add moderator ID so frontend can group by moderator
        public int CurrentPosition { get; set; }
        public int? EstimatedWaitMinutes { get; set; }
        public int PatientCount { get; set; }
    }
}
