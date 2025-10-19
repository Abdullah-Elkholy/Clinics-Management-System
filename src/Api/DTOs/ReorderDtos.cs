using System.ComponentModel.DataAnnotations;

namespace Clinics.Api.DTOs
{
    public class ReorderPosition
    {
        [Required]
        public int Id { get; set; }

        [Required]
        public int Position { get; set; }
    }

    public class ReorderRequest
    {
        [Required]
        public ReorderPosition[] Positions { get; set; } = new ReorderPosition[0];
    }
}
