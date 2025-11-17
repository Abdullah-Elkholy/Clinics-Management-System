using System.Linq;

namespace ClinicsManagementService.Services.Domain
{
    /// <summary>
    /// Normalizes phone numbers for WhatsApp URL construction.
    /// Handles both formats:
    /// - Phone number only (without country code) - from main system
    /// - Phone number with country code (combined format)
    /// </summary>
    public static class PhoneNumberNormalizer
    {
        /// <summary>
        /// Normalizes a phone number for WhatsApp URL construction.
        /// Extracts all digits and combines with country code if provided separately.
        /// </summary>
        /// <param name="phoneNumber">Phone number (may or may not include country code)</param>
        /// <param name="countryCode">Optional country code (e.g., "+20", "20", "+966")</param>
        /// <returns>Normalized phone number with digits only (e.g., "201234567890")</returns>
        public static string NormalizeForWhatsApp(string phoneNumber, string? countryCode = null)
        {
            // Extract digits from phone number
            var phoneDigits = new string(phoneNumber.Where(char.IsDigit).ToArray());
            
            // If country code is provided separately, extract its digits and prepend
            if (!string.IsNullOrWhiteSpace(countryCode))
            {
                var countryCodeDigits = new string(countryCode.Where(char.IsDigit).ToArray());
                
                // Only prepend if phone number doesn't already start with country code
                if (!string.IsNullOrWhiteSpace(countryCodeDigits) && 
                    !phoneDigits.StartsWith(countryCodeDigits))
                {
                    phoneDigits = countryCodeDigits + phoneDigits;
                }
            }
            
            return phoneDigits;
        }
        
        /// <summary>
        /// Normalizes a phone number that may already include country code.
        /// Just extracts digits - handles both formats gracefully.
        /// </summary>
        /// <param name="phoneNumber">Phone number (may include country code or formatting)</param>
        /// <returns>Normalized phone number with digits only</returns>
        public static string NormalizeDigitsOnly(string phoneNumber)
        {
            return new string(phoneNumber.Where(char.IsDigit).ToArray());
        }
    }
}

