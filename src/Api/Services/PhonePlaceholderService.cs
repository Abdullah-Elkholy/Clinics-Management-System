using System;
using System.Collections.Generic;

namespace Clinics.Api.Services
{
    /// <summary>
    /// Service for getting phone number placeholders by country code.
    /// No normalization logic - just placeholder suggestions.
    /// </summary>
    public interface IPhonePlaceholderService
    {
        /// <summary>
        /// Get phone placeholder for a country code.
        /// </summary>
        /// <param name="countryCode">Country code (e.g., "+20", "+966")</param>
        /// <returns>Placeholder example or default placeholder</returns>
        string GetPlaceholder(string? countryCode);
    }

    public class PhonePlaceholderService : IPhonePlaceholderService
    {
        /// <summary>
        /// Country-specific phone number placeholders
        /// </summary>
        private static readonly Dictionary<string, string> CountryPlaceholders = new()
        {
            // Middle East & North Africa
            { "20", "1018542431" }, // Egypt
            { "966", "504858694" }, // Saudi Arabia
            { "971", "501234567" }, // UAE
            { "965", "50123456" }, // Kuwait
            { "973", "36123456" }, // Bahrain
            { "974", "33123456" }, // Qatar
            { "968", "92123456" }, // Oman
            { "961", "3123456" }, // Lebanon
            { "962", "791234567" }, // Jordan
            { "212", "612345678" }, // Morocco
            { "213", "551234567" }, // Algeria
            { "216", "20123456" }, // Tunisia
            { "218", "912345678" }, // Libya
            { "249", "912345678" }, // Sudan
            { "252", "712345678" }, // Somalia
            { "964", "7901234567" }, // Iraq
            { "967", "712345678" }, // Yemen
            { "970", "591234567" }, // Palestine
            { "963", "931234567" }, // Syria
            
            // Europe
            { "44", "7912345678" }, // UK
            { "33", "612345678" }, // France
            { "49", "15123456789" }, // Germany
            { "39", "3123456789" }, // Italy
            { "34", "612345678" }, // Spain
            { "31", "612345678" }, // Netherlands
            { "32", "471234567" }, // Belgium
            { "41", "781234567" }, // Switzerland
            { "43", "66412345678" }, // Austria
            { "46", "701234567" }, // Sweden
            { "47", "91234567" }, // Norway
            { "45", "20123456" }, // Denmark
            { "358", "501234567" }, // Finland
            { "7", "9123456789" }, // Russia
            
            // Americas
            { "1", "2025551234" }, // US/Canada
            { "52", "5512345678" }, // Mexico
            { "55", "11987654321" }, // Brazil
            { "54", "91123456789" }, // Argentina
            { "56", "912345678" }, // Chile
            { "57", "3001234567" }, // Colombia
            { "51", "987654321" }, // Peru
            
            // Asia
            { "91", "9876543210" }, // India
            { "86", "13800138000" }, // China
            { "81", "9012345678" }, // Japan
            { "82", "1012345678" }, // South Korea
            { "65", "91234567" }, // Singapore
            { "60", "123456789" }, // Malaysia
            { "66", "812345678" }, // Thailand
            { "84", "9123456789" }, // Vietnam
            { "62", "8123456789" }, // Indonesia
            { "63", "9123456789" }, // Philippines
            { "92", "3001234567" }, // Pakistan
            { "880", "1712345678" }, // Bangladesh
            
            // Africa
            { "234", "8021234567" }, // Nigeria
            { "27", "821234567" }, // South Africa
            { "254", "712345678" }, // Kenya
            { "233", "241234567" }, // Ghana
            { "256", "712345678" }, // Uganda
            
            // Oceania
            { "61", "412345678" }, // Australia
            { "64", "211234567" }, // New Zealand
        };

        /// <summary>
        /// Get phone placeholder for a country code.
        /// </summary>
        public string GetPlaceholder(string? countryCode)
        {
            if (string.IsNullOrWhiteSpace(countryCode) || countryCode.Equals("OTHER", StringComparison.OrdinalIgnoreCase))
                return "123456789";

            var countryCodeDigits = countryCode.TrimStart('+').Replace(" ", "");
            if (string.IsNullOrEmpty(countryCodeDigits))
                return "123456789";

            if (CountryPlaceholders.TryGetValue(countryCodeDigits, out var placeholder))
                return placeholder;

            return "123456789"; // Default placeholder
        }
    }
}

