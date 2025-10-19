using System.ComponentModel.DataAnnotations;
using Clinics.Domain;

namespace Clinics.Api.DTOs
{
    public class QueueCreateRequest
    {
        [Required]
        public string DoctorName { get; set; } = null!;

        public string? Description { get; set; }

        // optional: who created this queue (client may pass current user id)
        public int? CreatedBy { get; set; }

        // optional estimated wait in minutes
        public int? EstimatedWaitMinutes { get; set; }
    }

    public class QueueUpdateRequest
    {
        [Required]
        public string DoctorName { get; set; } = null!;
        public string? Description { get; set; }
        public int? EstimatedWaitMinutes { get; set; }
        public int? CurrentPosition { get; set; }
    }

    public class QueueDto
    {
        public int Id { get; set; }
        public string DoctorName { get; set; } = null!;
        public string? Description { get; set; }
        public int CreatedBy { get; set; }
        public int CurrentPosition { get; set; }
        public int? EstimatedWaitMinutes { get; set; }
        public int PatientCount { get; set; }
    }
}
