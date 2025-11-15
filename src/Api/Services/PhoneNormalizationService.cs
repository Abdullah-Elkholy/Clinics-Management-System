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

    // TryNormalizeWithExtension removed; extensions are no longer extracted or stored.

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
            normalized = null;

            if (string.IsNullOrWhiteSpace(phoneNumber))
                return false;

            // Stage 1: Clean formatting characters (parentheses, spaces, dashes, dots, slashes, brackets)
            var cleaned = Regex.Replace(phoneNumber, @"[\s\-\(\)\[\]\{\}\.\/]", "");

            if (string.IsNullOrEmpty(cleaned))
                return false;

            // Add + if missing
            if (!cleaned.StartsWith("+"))
            {
                if (!char.IsDigit(cleaned[0]))
                    return false;
                cleaned = "+" + cleaned;
            }

            // Validate format: +[1-3 digits country code][6-14 digit number]
            var match = Regex.Match(cleaned, @"^\+(\d{1,3})(\d{6,14})$");
            if (!match.Success)
                return false;

            var countryCode = match.Groups[1].Value;
            var nationalNumber = match.Groups[2].Value;

            if (nationalNumber.StartsWith("0"))
            {
                nationalNumber = nationalNumber.TrimStart('0');
                if (string.IsNullOrEmpty(nationalNumber))
                    return false;
            }

            normalized = $"+{countryCode}{nationalNumber}";
            return true;
        }

        // Note: TryNormalizeWithExtension removed; normalization now ignores extension tokens entirely.

        /// <summary>
        /// Check if phone number has a country code (starts with +).
        /// </summary>
        public bool HasCountryCode(string? phoneNumber)
        {
            return !string.IsNullOrWhiteSpace(phoneNumber) && phoneNumber.StartsWith("+");
        }
    }
}
