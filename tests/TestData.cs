namespace ClinicsManagement.Tests
{
    public static class TestData
    {
        public const string InvalidPhoneNumber = "+201557121962555";
        public const string ValidPhoneNumber = "+201557121962";
        public const string DummyMessage = "Hello, this is a test message.";
        public const string DummySender = "TestSender";
        public const string DummyRecipient = "TestRecipient";

        // For single message endpoints
        public static ClinicsManagementService.Models.PhoneMessageDto ValidSingleMessage => new()
        {
            Phone = ValidPhoneNumber,
            Message = DummyMessage
        };
        public static ClinicsManagementService.Models.PhoneMessageDto InvalidSingleMessage => new()
        {
            Phone = InvalidPhoneNumber,
            Message = DummyMessage
        };

        // For bulk message endpoints
        public static ClinicsManagementService.Models.BulkPhoneMessageRequest ValidBulkRequest => new()
        {
            Items = new[]
            {
                new ClinicsManagementService.Models.PhoneMessageDto { Phone = ValidPhoneNumber, Message = DummyMessage },
                new ClinicsManagementService.Models.PhoneMessageDto { Phone = ValidPhoneNumber, Message = "Another test message." }
            }
        };
        public static ClinicsManagementService.Models.BulkPhoneMessageRequest InvalidBulkRequest => new()
        {
            Items = new[]
            {
                new ClinicsManagementService.Models.PhoneMessageDto { Phone = InvalidPhoneNumber, Message = DummyMessage },
                new ClinicsManagementService.Models.PhoneMessageDto { Phone = ValidPhoneNumber, Message = "Another test message." }
            }
        };
    }
}
