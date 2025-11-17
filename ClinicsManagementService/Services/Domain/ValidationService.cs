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
            
            // Remove all non-numeric characters (spaces, dashes, parentheses, dots, etc.)
            // This aligns with phoneUtils.ts behavior: phone.replace(/[^\d]/g, '')
            var digitsOnly = new string(phoneNumber.Where(char.IsDigit).ToArray());
            
            // Ensure there are actual digits
            if (string.IsNullOrWhiteSpace(digitsOnly))
                return ValidationResult.Failure("Phone number must contain digits.");
            
            // Validate digit length (generic range: 7-15 digits, matching phoneUtils.ts generic validation)
            // WhatsApp accepts international format, so we allow a wide range
            if (digitsOnly.Length < 7 || digitsOnly.Length > 15)
                return ValidationResult.Failure("Phone number must be between 7 and 15 digits.");
            
            // Phone number is valid - accepts + sign, spaces, and other formatting characters gracefully
            // Just like phoneUtils.ts and WhatsApp link format
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
