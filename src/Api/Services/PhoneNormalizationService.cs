using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;

namespace Clinics.Api.Services
{
    /// <summary>
    /// Country-specific phone number rules
    /// </summary>
    public class CountryPhoneRule
    {
        public int MinLength { get; set; }
        public int MaxLength { get; set; }
        public bool RemoveLeadingZero { get; set; }
        public string Placeholder { get; set; } = string.Empty;
    }

    /// <summary>
    /// Phone number normalization service.
    /// Enforces international format with country codes.
    /// Removes leading zeros and ensures + prefix.
    /// Supports country-specific validation with digit ranges.
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
        /// Normalize a phone number with country-specific rules.
        /// </summary>
        /// <param name="phoneNumber">Raw phone number</param>
        /// <param name="countryCode">Country code (e.g., "+20", "+966")</param>
        /// <param name="normalized">Normalized phone number or null if invalid</param>
        /// <returns>True if normalization succeeded, false otherwise</returns>
        bool TryNormalizeWithCountryCode(string? phoneNumber, string? countryCode, out string? normalized);

        /// <summary>
        /// Validate that a phone number has a country code prefix.
        /// </summary>
        /// <param name="phoneNumber">Phone number to validate</param>
        /// <returns>True if has country code, false otherwise</returns>
        bool HasCountryCode(string? phoneNumber);

        /// <summary>
        /// Extract country code from a phone number.
        /// </summary>
        /// <param name="phoneNumber">Phone number in E.164 format (e.g., +201234567890)</param>
        /// <returns>Country code with + prefix (e.g., "+20") or null if not found</returns>
        string? ExtractCountryCode(string? phoneNumber);

        /// <summary>
        /// Get phone placeholder for a country code.
        /// </summary>
        /// <param name="countryCode">Country code (e.g., "+20", "+966")</param>
        /// <returns>Placeholder example or empty string if not found</returns>
        string GetPlaceholder(string? countryCode);
    }

    public class PhoneNormalizationService : IPhoneNormalizationService
    {
        /// <summary>
        /// Country-specific phone number rules with digit ranges
        /// </summary>
        private static readonly Dictionary<string, CountryPhoneRule> CountryRules = new()
        {
            // Middle East & North Africa
            { "20", new CountryPhoneRule { MinLength = 9, MaxLength = 11, RemoveLeadingZero = true, Placeholder = "1018542431" } }, // Egypt
            { "966", new CountryPhoneRule { MinLength = 8, MaxLength = 10, RemoveLeadingZero = true, Placeholder = "504858694" } }, // Saudi Arabia
            { "971", new CountryPhoneRule { MinLength = 8, MaxLength = 10, RemoveLeadingZero = true, Placeholder = "501234567" } }, // UAE
            { "965", new CountryPhoneRule { MinLength = 7, MaxLength = 9, RemoveLeadingZero = true, Placeholder = "50123456" } }, // Kuwait
            { "973", new CountryPhoneRule { MinLength = 7, MaxLength = 9, RemoveLeadingZero = true, Placeholder = "36123456" } }, // Bahrain
            { "974", new CountryPhoneRule { MinLength = 7, MaxLength = 9, RemoveLeadingZero = true, Placeholder = "33123456" } }, // Qatar
            { "968", new CountryPhoneRule { MinLength = 7, MaxLength = 9, RemoveLeadingZero = true, Placeholder = "92123456" } }, // Oman
            { "961", new CountryPhoneRule { MinLength = 7, MaxLength = 9, RemoveLeadingZero = true, Placeholder = "3123456" } }, // Lebanon
            { "962", new CountryPhoneRule { MinLength = 8, MaxLength = 10, RemoveLeadingZero = true, Placeholder = "791234567" } }, // Jordan
            { "212", new CountryPhoneRule { MinLength = 8, MaxLength = 10, RemoveLeadingZero = true, Placeholder = "612345678" } }, // Morocco
            { "213", new CountryPhoneRule { MinLength = 8, MaxLength = 10, RemoveLeadingZero = true, Placeholder = "551234567" } }, // Algeria
            { "216", new CountryPhoneRule { MinLength = 7, MaxLength = 9, RemoveLeadingZero = true, Placeholder = "20123456" } }, // Tunisia
            { "218", new CountryPhoneRule { MinLength = 8, MaxLength = 10, RemoveLeadingZero = true, Placeholder = "912345678" } }, // Libya
            { "249", new CountryPhoneRule { MinLength = 8, MaxLength = 10, RemoveLeadingZero = true, Placeholder = "912345678" } }, // Sudan
            { "252", new CountryPhoneRule { MinLength = 7, MaxLength = 10, RemoveLeadingZero = true, Placeholder = "712345678" } }, // Somalia
            { "964", new CountryPhoneRule { MinLength = 8, MaxLength = 11, RemoveLeadingZero = true, Placeholder = "7901234567" } }, // Iraq
            { "961", new CountryPhoneRule { MinLength = 7, MaxLength = 9, RemoveLeadingZero = true, Placeholder = "3123456" } }, // Lebanon
            { "967", new CountryPhoneRule { MinLength = 8, MaxLength = 10, RemoveLeadingZero = true, Placeholder = "712345678" } }, // Yemen
            { "970", new CountryPhoneRule { MinLength = 8, MaxLength = 10, RemoveLeadingZero = true, Placeholder = "591234567" } }, // Palestine
            { "963", new CountryPhoneRule { MinLength = 8, MaxLength = 10, RemoveLeadingZero = true, Placeholder = "931234567" } }, // Syria
            
            // Europe
            { "44", new CountryPhoneRule { MinLength = 9, MaxLength = 11, RemoveLeadingZero = true, Placeholder = "7912345678" } }, // UK
            { "33", new CountryPhoneRule { MinLength = 8, MaxLength = 10, RemoveLeadingZero = true, Placeholder = "612345678" } }, // France
            { "49", new CountryPhoneRule { MinLength = 9, MaxLength = 12, RemoveLeadingZero = true, Placeholder = "15123456789" } }, // Germany
            { "39", new CountryPhoneRule { MinLength = 8, MaxLength = 11, RemoveLeadingZero = true, Placeholder = "3123456789" } }, // Italy
            { "34", new CountryPhoneRule { MinLength = 8, MaxLength = 10, RemoveLeadingZero = true, Placeholder = "612345678" } }, // Spain
            { "31", new CountryPhoneRule { MinLength = 8, MaxLength = 10, RemoveLeadingZero = true, Placeholder = "612345678" } }, // Netherlands
            { "32", new CountryPhoneRule { MinLength = 8, MaxLength = 10, RemoveLeadingZero = true, Placeholder = "471234567" } }, // Belgium
            { "41", new CountryPhoneRule { MinLength = 8, MaxLength = 10, RemoveLeadingZero = true, Placeholder = "781234567" } }, // Switzerland
            { "43", new CountryPhoneRule { MinLength = 8, MaxLength = 12, RemoveLeadingZero = true, Placeholder = "66412345678" } }, // Austria
            { "46", new CountryPhoneRule { MinLength = 8, MaxLength = 10, RemoveLeadingZero = true, Placeholder = "701234567" } }, // Sweden
            { "47", new CountryPhoneRule { MinLength = 7, MaxLength = 9, RemoveLeadingZero = true, Placeholder = "91234567" } }, // Norway
            { "45", new CountryPhoneRule { MinLength = 7, MaxLength = 9, RemoveLeadingZero = true, Placeholder = "20123456" } }, // Denmark
            { "358", new CountryPhoneRule { MinLength = 8, MaxLength = 11, RemoveLeadingZero = true, Placeholder = "501234567" } }, // Finland
            { "7", new CountryPhoneRule { MinLength = 9, MaxLength = 11, RemoveLeadingZero = false, Placeholder = "9123456789" } }, // Russia
            
            // Americas
            { "1", new CountryPhoneRule { MinLength = 9, MaxLength = 11, RemoveLeadingZero = false, Placeholder = "2025551234" } }, // US/Canada
            { "52", new CountryPhoneRule { MinLength = 9, MaxLength = 11, RemoveLeadingZero = true, Placeholder = "5512345678" } }, // Mexico
            { "55", new CountryPhoneRule { MinLength = 9, MaxLength = 12, RemoveLeadingZero = true, Placeholder = "11987654321" } }, // Brazil
            { "54", new CountryPhoneRule { MinLength = 9, MaxLength = 11, RemoveLeadingZero = true, Placeholder = "91123456789" } }, // Argentina
            { "56", new CountryPhoneRule { MinLength = 8, MaxLength = 10, RemoveLeadingZero = true, Placeholder = "912345678" } }, // Chile
            { "57", new CountryPhoneRule { MinLength = 9, MaxLength = 11, RemoveLeadingZero = true, Placeholder = "3001234567" } }, // Colombia
            { "51", new CountryPhoneRule { MinLength = 8, MaxLength = 10, RemoveLeadingZero = true, Placeholder = "987654321" } }, // Peru
            
            // Asia
            { "91", new CountryPhoneRule { MinLength = 9, MaxLength = 11, RemoveLeadingZero = true, Placeholder = "9876543210" } }, // India
            { "86", new CountryPhoneRule { MinLength = 9, MaxLength = 12, RemoveLeadingZero = true, Placeholder = "13800138000" } }, // China
            { "81", new CountryPhoneRule { MinLength = 9, MaxLength = 11, RemoveLeadingZero = true, Placeholder = "9012345678" } }, // Japan
            { "82", new CountryPhoneRule { MinLength = 8, MaxLength = 11, RemoveLeadingZero = true, Placeholder = "1012345678" } }, // South Korea
            { "65", new CountryPhoneRule { MinLength = 7, MaxLength = 9, RemoveLeadingZero = true, Placeholder = "91234567" } }, // Singapore
            { "60", new CountryPhoneRule { MinLength = 8, MaxLength = 11, RemoveLeadingZero = true, Placeholder = "123456789" } }, // Malaysia
            { "66", new CountryPhoneRule { MinLength = 8, MaxLength = 10, RemoveLeadingZero = true, Placeholder = "812345678" } }, // Thailand
            { "84", new CountryPhoneRule { MinLength = 8, MaxLength = 11, RemoveLeadingZero = true, Placeholder = "9123456789" } }, // Vietnam
            { "62", new CountryPhoneRule { MinLength = 8, MaxLength = 12, RemoveLeadingZero = true, Placeholder = "8123456789" } }, // Indonesia
            { "63", new CountryPhoneRule { MinLength = 9, MaxLength = 11, RemoveLeadingZero = true, Placeholder = "9123456789" } }, // Philippines
            { "92", new CountryPhoneRule { MinLength = 9, MaxLength = 11, RemoveLeadingZero = true, Placeholder = "3001234567" } }, // Pakistan
            { "880", new CountryPhoneRule { MinLength = 9, MaxLength = 11, RemoveLeadingZero = true, Placeholder = "1712345678" } }, // Bangladesh
            
            // Africa
            { "234", new CountryPhoneRule { MinLength = 9, MaxLength = 11, RemoveLeadingZero = true, Placeholder = "8021234567" } }, // Nigeria
            { "27", new CountryPhoneRule { MinLength = 8, MaxLength = 10, RemoveLeadingZero = true, Placeholder = "821234567" } }, // South Africa
            { "254", new CountryPhoneRule { MinLength = 8, MaxLength = 10, RemoveLeadingZero = true, Placeholder = "712345678" } }, // Kenya
            { "233", new CountryPhoneRule { MinLength = 8, MaxLength = 10, RemoveLeadingZero = true, Placeholder = "241234567" } }, // Ghana
            { "256", new CountryPhoneRule { MinLength = 8, MaxLength = 10, RemoveLeadingZero = true, Placeholder = "712345678" } }, // Uganda
            
            // Oceania
            { "61", new CountryPhoneRule { MinLength = 8, MaxLength = 10, RemoveLeadingZero = true, Placeholder = "412345678" } }, // Australia
            { "64", new CountryPhoneRule { MinLength = 8, MaxLength = 10, RemoveLeadingZero = true, Placeholder = "211234567" } }, // New Zealand
        };

        private static CountryPhoneRule GetCountryRule(string countryCodeDigits)
        {
            if (CountryRules.TryGetValue(countryCodeDigits, out var rule))
                return rule;
            
            // Default rule for unknown countries
            return new CountryPhoneRule 
            { 
                MinLength = 6, 
                MaxLength = 14, 
                RemoveLeadingZero = true, 
                Placeholder = "123456789" 
            };
        }
        /// <summary>
        /// Validates phone number format and normalizes it (generic validation).
        /// Rules:
        /// - Must start with + (country code indicator) or convertible digit sequence
        /// - Must have 1-3 digit country code
        /// - Must have 6-14 digit national number
        /// - Total 10-18 digits (excluding +)
        /// - No spaces allowed in phone number
        /// 
        /// Handles international format variations:
        /// - Parentheses: +20 (10) 1234567 or (+20) 1012345678
        /// - Spaces: +20 10 1234 5678 or +20-10-1234-5678 (spaces are removed)
        /// - Dashes and periods: +20.10.1234.5678
        /// </summary>
        public bool TryNormalize(string? phoneNumber, out string? normalized)
        {
            normalized = null;

            if (string.IsNullOrWhiteSpace(phoneNumber))
                return false;

            // Stage 1: Clean formatting characters (parentheses, spaces, dashes, dots, slashes, brackets)
            // Spaces are handled (removed) rather than rejected
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

        /// <summary>
        /// Normalize phone number with country-specific validation rules.
        /// Uses country-specific digit ranges (e.g., Egypt: 9-11 digits, Saudi: 8-10 digits).
        /// Spaces in phone number and country code are automatically removed (handled, not rejected).
        /// </summary>
        /// <param name="phoneNumber">Raw phone number (spaces are automatically removed)</param>
        /// <param name="countryCode">Country code (e.g., "+20", "+966") (spaces are automatically removed)</param>
        /// <param name="normalized">Normalized phone number or null if invalid</param>
        /// <returns>True if normalization succeeded, false otherwise</returns>
        public bool TryNormalizeWithCountryCode(string? phoneNumber, string? countryCode, out string? normalized)
        {
            normalized = null;

            if (string.IsNullOrWhiteSpace(phoneNumber))
                return false;

            // If country code is "OTHER", use generic normalization (no country-specific rules)
            if (string.IsNullOrWhiteSpace(countryCode) || countryCode.Equals("OTHER", StringComparison.OrdinalIgnoreCase))
            {
                return TryNormalize(phoneNumber, out normalized);
            }

            // Extract country code digits (without +)
            // Spaces are handled (removed) rather than rejected
            var countryCodeCleaned = countryCode.Replace(" ", "").TrimStart('+');
            if (string.IsNullOrEmpty(countryCodeCleaned))
                return false;

            // Get country-specific rules
            var rule = GetCountryRule(countryCodeCleaned);

            // Clean phone number (remove formatting characters including spaces)
            // Spaces are handled (removed) rather than rejected
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

            // Extract country code and national number
            var match = Regex.Match(cleaned, @"^\+(\d{1,3})(\d+)$");
            if (!match.Success)
                return false;

            var extractedCountryCode = match.Groups[1].Value;
            var nationalNumber = match.Groups[2].Value;

            // Verify extracted country code matches provided country code (after cleaning)
            if (!extractedCountryCode.Equals(countryCodeCleaned, StringComparison.Ordinal))
            {
                // If phone already has country code but it doesn't match, try removing it and using provided code
                if (cleaned.StartsWith($"+{extractedCountryCode}"))
                {
                    nationalNumber = extractedCountryCode + nationalNumber;
                    extractedCountryCode = countryCodeCleaned;
                }
                else
                {
                    return false;
                }
            }

            // Remove leading zero if country rules require it
            if (rule.RemoveLeadingZero && nationalNumber.StartsWith("0"))
            {
                nationalNumber = nationalNumber.TrimStart('0');
                if (string.IsNullOrEmpty(nationalNumber))
                    return false;
            }

            // Validate digit length against country-specific rules
            if (nationalNumber.Length < rule.MinLength || nationalNumber.Length > rule.MaxLength)
                return false;

            normalized = $"+{extractedCountryCode}{nationalNumber}";
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

        /// <summary>
        /// Extract country code from a phone number.
        /// </summary>
        public string? ExtractCountryCode(string? phoneNumber)
        {
            if (string.IsNullOrWhiteSpace(phoneNumber))
                return null;

            // Clean formatting characters (spaces are handled/removed)
            var cleaned = Regex.Replace(phoneNumber, @"[\s\-\(\)\[\]\{\}\.\/]", "");

            if (string.IsNullOrEmpty(cleaned))
                return null;

            // Add + if missing
            if (!cleaned.StartsWith("+"))
            {
                if (!char.IsDigit(cleaned[0]))
                    return null;
                cleaned = "+" + cleaned;
            }

            // Extract country code (1-3 digits after +)
            var match = Regex.Match(cleaned, @"^\+(\d{1,3})");
            if (match.Success)
            {
                return "+" + match.Groups[1].Value;
            }

            return null;
        }

        /// <summary>
        /// Get phone placeholder for a country code.
        /// </summary>
        public string GetPlaceholder(string? countryCode)
        {
            if (string.IsNullOrWhiteSpace(countryCode) || countryCode.Equals("OTHER", StringComparison.OrdinalIgnoreCase))
                return "123456789";

            var countryCodeDigits = countryCode.TrimStart('+');
            if (string.IsNullOrEmpty(countryCodeDigits))
                return "123456789";

            var rule = GetCountryRule(countryCodeDigits);
            return rule.Placeholder;
        }
    }
}
