namespace ClinicsManagementService.Services.Interfaces
{
    public interface IValidationService
    {
        ValidationResult ValidatePhoneNumber(string phoneNumber);
        ValidationResult ValidateMessage(string message);
        ValidationResult ValidateBulkRequest(ClinicsManagementService.Models.BulkPhoneMessageRequest request);
        ValidationResult ValidateDelayParameters(int minDelayMs, int maxDelayMs);
    }

    public class ValidationResult
    {
        public bool IsValid { get; set; }
        public string? ErrorMessage { get; set; }
        public static ValidationResult Success() => new ValidationResult { IsValid = true };
        public static ValidationResult Failure(string error) => new ValidationResult { IsValid = false, ErrorMessage = error };
    }
}
