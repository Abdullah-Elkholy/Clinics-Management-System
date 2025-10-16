using System.ComponentModel.DataAnnotations;

namespace Clinics.Api.DTOs
{
    public class PatientCreateRequest
    {
        [Required]
        public string FullName { get; set; } = null!;

        [Required]
        [Phone]
        public string PhoneNumber { get; set; } = null!;
        // Optional desired position (1-based). When provided, existing patients at or after this
        // position will be shifted up by one to make room.
        public int? DesiredPosition { get; set; }
    }

    public class PatientDto
    {
        public int Id { get; set; }
        public int QueueId { get; set; }
        public string FullName { get; set; } = null!;
        public string PhoneNumber { get; set; } = null!;
        public int Position { get; set; }
        public string Status { get; set; } = null!;
    }
}
