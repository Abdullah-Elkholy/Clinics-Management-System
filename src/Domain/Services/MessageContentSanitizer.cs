using System.Text;
using System.Text.RegularExpressions;

namespace Clinics.Domain.Services;

/// <summary>
/// DEF-003, DEF-004, DEF-005 FIX: Message content sanitization service.
/// Handles control characters, RTL overrides, and length validation.
/// </summary>
public class MessageContentSanitizer
{
    /// <summary>
    /// Maximum allowed message content length (matches DB column size)
    /// </summary>
    public const int MaxLength = 2000;

    /// <summary>
    /// ASCII control characters to strip (0x00-0x1F, 0x7F) except TAB, LF, CR
    /// </summary>
    private static readonly Regex ControlCharsPattern = new(
        @"[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]",
        RegexOptions.Compiled);

    /// <summary>
    /// Unicode bidirectional override characters (security risk - can be used for spoofing)
    /// U+202A-U+202E: LRE, RLE, PDF, LRO, RLO
    /// U+2066-U+2069: LRI, RLI, FSI, PDI
    /// </summary>
    private static readonly Regex BidiOverridePattern = new(
        @"[\u202A-\u202E\u2066-\u2069]",
        RegexOptions.Compiled);

    /// <summary>
    /// Sanitize message content for safe storage and display.
    /// </summary>
    /// <param name="content">Raw content input</param>
    /// <returns>Sanitization result with cleaned content and any warnings</returns>
    public SanitizationResult Sanitize(string? content)
    {
        var result = new SanitizationResult();

        if (string.IsNullOrEmpty(content))
        {
            result.SanitizedContent = string.Empty;
            result.Warnings.Add("Content is empty");
            return result;
        }

        var sanitized = content;

        // DEF-003: Strip ASCII control characters (except TAB, LF, CR)
        if (ControlCharsPattern.IsMatch(sanitized))
        {
            sanitized = ControlCharsPattern.Replace(sanitized, "");
            result.Warnings.Add("Control characters removed");
        }

        // DEF-004: Strip bidirectional override characters (security)
        if (BidiOverridePattern.IsMatch(sanitized))
        {
            sanitized = BidiOverridePattern.Replace(sanitized, "");
            result.Warnings.Add("RTL override characters removed (security)");
        }

        // Normalize multiple consecutive whitespace to single space (optional cleanup)
        sanitized = Regex.Replace(sanitized, @"[ \t]+", " ");

        // DEF-005: Validate and truncate length
        if (sanitized.Length > MaxLength)
        {
            result.OriginalLength = sanitized.Length;
            sanitized = sanitized.Substring(0, MaxLength);
            result.Warnings.Add($"Content truncated from {result.OriginalLength} to {MaxLength} characters");
            result.WasTruncated = true;
        }

        // Check if content is only whitespace after sanitization
        if (string.IsNullOrWhiteSpace(sanitized))
        {
            result.Warnings.Add("Content is only whitespace after sanitization");
            result.IsValid = false;
        }

        result.SanitizedContent = sanitized.Trim();
        return result;
    }
}

/// <summary>
/// Result of message content sanitization
/// </summary>
public class SanitizationResult
{
    public string SanitizedContent { get; set; } = string.Empty;
    public List<string> Warnings { get; set; } = new();
    public bool IsValid { get; set; } = true;
    public bool WasTruncated { get; set; } = false;
    public int? OriginalLength { get; set; }

    public bool HasWarnings => Warnings.Count > 0;
}
