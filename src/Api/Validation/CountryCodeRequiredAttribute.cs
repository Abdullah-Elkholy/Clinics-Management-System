using System.ComponentModel.DataAnnotations;

namespace Clinics.Api.Validation
{
    /// <summary>
    /// Validates that a phone number includes a country code (starts with +).
    /// </summary>
    public class CountryCodeRequiredAttribute : ValidationAttribute
    {
        public override string FormatErrorMessage(string name)
        {
            return ErrorMessage ?? $"{name} must include a country code (e.g., +201234567890)";
        }

        protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
        {
            if (value == null || string.IsNullOrWhiteSpace(value.ToString()))
                return ValidationResult.Success; // Let [Required] handle null

            var phoneNumber = value.ToString() ?? string.Empty;

            if (!phoneNumber.StartsWith("+"))
            {
                return new ValidationResult(
                    FormatErrorMessage(validationContext.DisplayName),
                    new[] { validationContext.MemberName ?? string.Empty }
                );
            }

            return ValidationResult.Success;
        }
    }
}
