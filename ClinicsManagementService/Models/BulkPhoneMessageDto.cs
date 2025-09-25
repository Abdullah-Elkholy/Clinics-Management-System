namespace ClinicsManagementService.Models
{
    public class BulkPhoneMessageRequest
    {
        public required IEnumerable<PhoneMessageDto> Items { get; set; }
    }
}