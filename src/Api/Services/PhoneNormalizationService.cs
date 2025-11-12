using System;
using System.Text.RegularExpressions;

namespace Clinics.Api.Services
{
    /// <summary>
    /// Phone number normalization service.
    /// Enforces international format with country codes.
    /// Removes leading zeros and ensures + prefix.
    /// </summary>
    public interface IPhoneNormalizationService
    {
        /// <summary>
        /// Normalize a phone number to international format.
        /// </summary>
        /// <param name="phoneNumber">Raw phone number</param>
        /// <param name="normalized">Normalized phone number or null if invalid</param>
        /// <returns>True if normalization succeeded, false otherwise</returns>
        bool TryNormalize(string? phoneNumber, out string? normalized);

        /// <summary>
        /// Normalize a phone number and extract extension if present.
        /// </summary>
        /// <param name="phoneNumber">Raw phone number (may contain extension)</param>
        /// <param name="normalized">Normalized phone number or null if invalid</param>
        /// <param name="extension">Extracted extension (e.g., "123" from "+20123 ext. 123"), or null if none</param>
        /// <returns>True if normalization succeeded, false otherwise</returns>
        bool TryNormalizeWithExtension(string? phoneNumber, out string? normalized, out string? extension);

        /// <summary>
        /// Validate that a phone number has a country code prefix.
        /// </summary>
        /// <param name="phoneNumber">Phone number to validate</param>
        /// <returns>True if has country code, false otherwise</returns>
        bool HasCountryCode(string? phoneNumber);
    }

    public class PhoneNormalizationService : IPhoneNormalizationService
    {
        /// <summary>
        /// Validates phone number format and normalizes it.
        /// Rules:
        /// - Must start with + (country code indicator) or convertible digit sequence
        /// - Must have 1-3 digit country code
        /// - Must have 6-14 digit national number
        /// - Total 10-18 digits (excluding +)
        /// 
        /// Handles international format variations:
        /// - Parentheses: +20 (10) 1234567 or (+20) 1012345678
        /// - Spaces: +20 10 1234 5678 or +20-10-1234-5678
        /// - Dashes and periods: +20.10.1234.5678
        /// </summary>
        public bool TryNormalize(string? phoneNumber, out string? normalized)
        {
            return TryNormalizeWithExtension(phoneNumber, out normalized, out _);
        }

        /// <summary>
        /// Normalize a phone number and extract extension if present.
        /// Handles extension patterns: "ext", "x", or "#" followed by optional separator and digits.
        /// Examples:
        /// - "+201234567890 ext. 123" → normalized: "+201234567890", extension: "123"
        /// - "+20 123 456 7890 x 456" → normalized: "+201234567890", extension: "456"
        /// - "+20(123) 456-7890#789" → normalized: "+201234567890", extension: "789"
        /// </summary>
        public bool TryNormalizeWithExtension(string? phoneNumber, out string? normalized, out string? extension)
        {
            normalized = null;
            extension = null;

            if (string.IsNullOrWhiteSpace(phoneNumber))
                return false;

            // Stage 0: Extract extension if present
            // Patterns: "ext", "x", "#" (case-insensitive for "ext" and "x")
            // Matches: "ext. 123", "ext: 123", "ext 123", "x123", "x 123", "#123"
            var extensionMatch = Regex.Match(phoneNumber, @"(?:ext|x)\s*[\.:]*\s*(\d+)|#(\d+)", RegexOptions.IgnoreCase);
            if (extensionMatch.Success)
            {
                extension = extensionMatch.Groups[1].Value ?? extensionMatch.Groups[2].Value;
                // Remove extension from phone number for normalization
                phoneNumber = Regex.Replace(phoneNumber, @"(?:ext|x)\s*[\.:]*\s*\d+|#\d+", "", RegexOptions.IgnoreCase);
            }

            // Stage 1: Clean formatting characters (parentheses, spaces, dashes, dots)
            // Remove: ( ) [ ] { } spaces - . /
            var cleaned = Regex.Replace(phoneNumber, @"[\s\-\(\)\[\]\{\}\.\/]", "");

            if (string.IsNullOrEmpty(cleaned))
                return false;

            // Add + if missing
            if (!cleaned.StartsWith("+"))
            {
                // Check if it looks like a valid number without +
                // Only accept if starting with digit
                if (!char.IsDigit(cleaned[0]))
                    return false;

                cleaned = "+" + cleaned;
            }

            // Validate format: +[1-3 digits country code][6-14 digit number]
            // Total digits (excluding +): 7-17
            var match = Regex.Match(cleaned, @"^\+(\d{1,3})(\d{6,14})$");

            if (!match.Success)
                return false;

            // Check for leading zeros in the national part and remove them
            // but only if the national part starts with 0 and country code allows it
            // For Egypt (+20), numbers often start with 0 which should be removed
            var countryCode = match.Groups[1].Value;
            var nationalNumber = match.Groups[2].Value;

            // Remove leading zero from national number (common in many countries)
            if (nationalNumber.StartsWith("0"))
            {
                nationalNumber = nationalNumber.TrimStart('0');
                if (string.IsNullOrEmpty(nationalNumber))
                    return false;
            }

            normalized = $"+{countryCode}{nationalNumber}";
            return true;
        }

        /// <summary>
        /// Check if phone number has a country code (starts with +).
        /// </summary>
        public bool HasCountryCode(string? phoneNumber)
        {
            return !string.IsNullOrWhiteSpace(phoneNumber) && phoneNumber.StartsWith("+");
        }
    }
}
