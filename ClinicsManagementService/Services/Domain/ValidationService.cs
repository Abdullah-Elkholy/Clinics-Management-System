using ClinicsManagementService.Models;

namespace ClinicsManagementService.Services.Domain
{
    /// <summary>
    /// Handles input validation and business rules
    /// </summary>
    public interface IValidationService
    {
        ValidationResult ValidatePhoneNumber(string phoneNumber);
        ValidationResult ValidateMessage(string message);
        ValidationResult ValidateBulkRequest(BulkPhoneMessageRequest request);
        ValidationResult ValidateDelayParameters(int minDelayMs, int maxDelayMs);
    }

    /// <summary>
    /// Represents the result of a validation operation
    /// </summary>
    public class ValidationResult
    {
        public bool IsValid { get; set; }
        public string? ErrorMessage { get; set; }

        public static ValidationResult Success() => new() { IsValid = true };
        public static ValidationResult Failure(string errorMessage) => new() { IsValid = false, ErrorMessage = errorMessage };
    }

    /// <summary>
    /// Handles input validation and business rules
    /// </summary>
    public class ValidationService : IValidationService
    {
        private const int MinMessageLength = 1;
        private const int MaxMessageLength = 4096;
        private const int MinDelayMs = 0;
        private const int MaxDelayMs = 60000; // 1 minute max delay
        private const int MaxBulkItems = 1000;

        public ValidationResult ValidatePhoneNumber(string phoneNumber)
        {
            if (string.IsNullOrWhiteSpace(phoneNumber))
                return ValidationResult.Failure("Phone number is required.");

            // Basic phone number validation (can be enhanced)
            var cleanPhone = phoneNumber.Trim().Replace(" ", "").Replace("-", "").Replace("(", "").Replace(")", "");
            
            if (cleanPhone.Length < 7 || cleanPhone.Length > 15)
                return ValidationResult.Failure("Phone number must be between 7 and 15 digits.");

            if (!cleanPhone.All(c => char.IsDigit(c) || c == '+'))
                return ValidationResult.Failure("Phone number contains invalid characters.");

            return ValidationResult.Success();
        }

        public ValidationResult ValidateMessage(string message)
        {
            if (string.IsNullOrWhiteSpace(message))
                return ValidationResult.Failure("Message is required.");

            if (message.Length < MinMessageLength)
                return ValidationResult.Failure($"Message must be at least {MinMessageLength} character long.");

            if (message.Length > MaxMessageLength)
                return ValidationResult.Failure($"Message cannot exceed {MaxMessageLength} characters.");

            return ValidationResult.Success();
        }

        public ValidationResult ValidateBulkRequest(BulkPhoneMessageRequest request)
        {
            if (request.Items == null)
                return ValidationResult.Failure("Items collection is required.");

            var items = request.Items.ToList();
            if (items.Count == 0)
                return ValidationResult.Failure("At least one phone/message pair is required.");

            if (items.Count > MaxBulkItems)
                return ValidationResult.Failure($"Cannot send more than {MaxBulkItems} messages at once.");

            var invalidItems = new List<string>();
            for (int i = 0; i < items.Count; i++)
            {
                var phoneValidation = ValidatePhoneNumber(items[i].Phone);
                var messageValidation = ValidateMessage(items[i].Message);

                if (!phoneValidation.IsValid || !messageValidation.IsValid)
                {
                    var errors = new List<string>();
                    if (!phoneValidation.IsValid) errors.Add($"Phone: {phoneValidation.ErrorMessage}");
                    if (!messageValidation.IsValid) errors.Add($"Message: {messageValidation.ErrorMessage}");
                    invalidItems.Add($"Item {i + 1}: {string.Join(", ", errors)}");
                }
            }

            if (invalidItems.Any())
                return ValidationResult.Failure($"Invalid items found: {string.Join("; ", invalidItems)}");

            return ValidationResult.Success();
        }

        public ValidationResult ValidateDelayParameters(int minDelayMs, int maxDelayMs)
        {
            if (minDelayMs < MinDelayMs)
                return ValidationResult.Failure($"Minimum delay cannot be less than {MinDelayMs}ms.");

            if (maxDelayMs > MaxDelayMs)
                return ValidationResult.Failure($"Maximum delay cannot exceed {MaxDelayMs}ms.");

            if (minDelayMs > maxDelayMs)
                return ValidationResult.Failure("Minimum delay cannot be greater than maximum delay.");

            return ValidationResult.Success();
        }
    }
}
