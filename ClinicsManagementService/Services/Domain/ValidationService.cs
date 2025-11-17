using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.Models;
using System.Linq;

namespace ClinicsManagementService.Services.Domain
{
    public class ValidationService : IValidationService
    {
        public ValidationResult ValidatePhoneNumber(string phoneNumber)
        {
            if (string.IsNullOrWhiteSpace(phoneNumber))
                return ValidationResult.Failure("Phone number is required.");
            
            // Remove leading + if present, then validate remaining characters are all digits
            var digitsOnly = phoneNumber.StartsWith("+") 
                ? phoneNumber.Substring(1) 
                : phoneNumber;
            
            // Check all remaining characters are digits
            if (!digitsOnly.All(char.IsDigit))
                return ValidationResult.Failure("Phone number must be digits or start with '+' followed by digits only.");
            
            return ValidationResult.Success();
        }

        public ValidationResult ValidateMessage(string message)
        {
            if (string.IsNullOrWhiteSpace(message))
                return ValidationResult.Failure("Message cannot be empty.");
            if (message.Length > 4096)
                return ValidationResult.Failure("Message is too long.");
            return ValidationResult.Success();
        }

        public ValidationResult ValidateBulkRequest(BulkPhoneMessageRequest request)
        {
            if (request == null || request.Items == null || !request.Items.Any())
                return ValidationResult.Failure("Bulk request must contain at least one item.");
            foreach (var item in request.Items)
            {
                var phoneResult = ValidatePhoneNumber(item.Phone);
                if (!phoneResult.IsValid)
                    return ValidationResult.Failure($"Invalid phone: {phoneResult.ErrorMessage}");
                var msgResult = ValidateMessage(item.Message);
                if (!msgResult.IsValid)
                    return ValidationResult.Failure($"Invalid message: {msgResult.ErrorMessage}");
            }
            return ValidationResult.Success();
        }

        public ValidationResult ValidateDelayParameters(int minDelayMs, int maxDelayMs)
        {
            if (minDelayMs < 0 || maxDelayMs < 0)
                return ValidationResult.Failure("Delay values must be non-negative.");
            if (minDelayMs > maxDelayMs)
                return ValidationResult.Failure("minDelayMs cannot be greater than maxDelayMs.");
            if (maxDelayMs > 60000)
                return ValidationResult.Failure("maxDelayMs is too large (max 60000 ms).");
            return ValidationResult.Success();
        }
    }
}
