using ClinicsManagementService.Models;

namespace ClinicsManagementService.UnitTests.Common
{
    public static class TestDataBuilder
    {
        // Valid test data
        public static string ValidPhoneNumber => "+201234567890";
        public static string ValidPhoneNumberWithoutPlus => "201234567890";
        public static string ValidMessage => "Test message content";
        public static string LongValidMessage => new string('A', 1000);

        // Invalid test data
        public static string EmptyPhoneNumber => string.Empty;
        public static string NullPhoneNumber => null!;
        public static string InvalidPhoneNumber => "abc123";
        public static string EmptyMessage => string.Empty;
        public static string NullMessage => null!;
        public static string TooLongMessage => new string('A', 5000); // > 4096 limit

        // Phone message DTOs
        public static PhoneMessageDto ValidPhoneMessage => new()
        {
            Phone = ValidPhoneNumber,
            Message = ValidMessage
        };

        public static PhoneMessageDto InvalidPhoneMessage => new()
        {
            Phone = InvalidPhoneNumber,
            Message = ValidMessage
        };

        public static PhoneMessageDto EmptyPhoneMessage => new()
        {
            Phone = EmptyPhoneNumber,
            Message = ValidMessage
        };

        // Bulk requests
        public static BulkPhoneMessageRequest ValidBulkRequest => new()
        {
            Items = new[]
            {
                new PhoneMessageDto { Phone = ValidPhoneNumber, Message = ValidMessage },
                new PhoneMessageDto { Phone = ValidPhoneNumberWithoutPlus, Message = "Another message" }
            }
        };

        public static BulkPhoneMessageRequest InvalidBulkRequest => new()
        {
            Items = new[]
            {
                new PhoneMessageDto { Phone = InvalidPhoneNumber, Message = ValidMessage }
            }
        };

        public static BulkPhoneMessageRequest EmptyBulkRequest => new()
        {
            Items = Array.Empty<PhoneMessageDto>()
        };

        // Operation results
        public static OperationResult<bool> SuccessResult => OperationResult<bool>.Success(true);
        public static OperationResult<bool> FailureResult => OperationResult<bool>.Failure("Test failure");
        public static OperationResult<bool> PendingQRResult => OperationResult<bool>.PendingQR("Authentication required");
        public static OperationResult<bool> PendingNETResult => OperationResult<bool>.PendingNET("Network unavailable");
        public static OperationResult<bool> WaitingResult => OperationResult<bool>.Waiting("Waiting...");

        public static OperationResult<string?> SuccessStringResult => OperationResult<string?>.Success("msg-check");
        public static OperationResult<string?> FailureStringResult => OperationResult<string?>.Failure("Failed");
    }
}

