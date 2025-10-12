namespace ClinicsManagementService.Models
{
    public class BulkPhoneMessageRequest
    {
        public List<PhoneMessageDto> Items { get; set; } = new();
    }
}