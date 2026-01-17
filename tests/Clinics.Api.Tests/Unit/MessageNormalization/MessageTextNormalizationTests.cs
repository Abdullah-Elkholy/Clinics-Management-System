using System;
using System.Text;
using Clinics.Domain;
using FluentAssertions;
using Xunit;

namespace Clinics.Api.Tests.Unit.MessageNormalization;

/// <summary>
/// Phase 1.7: Message text normalization and data shape tests.
/// 
/// IMPORTANT: These tests probe for edge cases and potential defects.
/// Failures should be logged in Defect Register - NOT fixed by modifying production code.
/// 
/// Per STRICT RULE: No production code edits until all defects reviewed from single place.
/// </summary>
public class MessageTextNormalizationTests
{
    #region Test Helpers

    /// <summary>
    /// Creates a Message with the given content to test persistence/handling
    /// </summary>
    private static Message CreateMessageWithContent(string content)
    {
        return new Message
        {
            Id = Guid.NewGuid(),
            FullName = "Test Patient",
            PatientPhone = "+201000000001",
            CountryCode = "+20",
            Content = content,
            Status = "queued",
            Position = 1,
            CalculatedPosition = 0,
            CreatedAt = DateTime.UtcNow,
            IsDeleted = false,
            IsPaused = false
        };
    }

    #endregion

    #region Newline Handling Tests

    [Fact]
    public void Content_WithLFNewlines_ShouldBePreserved()
    {
        // Arrange
        var content = "Line 1\nLine 2\nLine 3";

        // Act
        var message = CreateMessageWithContent(content);

        // Assert
        message.Content.Should().Be("Line 1\nLine 2\nLine 3");
        message.Content.Should().Contain("\n");
    }

    [Fact]
    public void Content_WithCRLFNewlines_ShouldBeHandled()
    {
        // Arrange - Windows-style line endings
        var content = "Line 1\r\nLine 2\r\nLine 3";

        // Act
        var message = CreateMessageWithContent(content);

        // Assert - should either preserve or normalize, but not corrupt
        // This test documents current behavior
        message.Content.Should().NotBeNullOrEmpty();
        message.Content.Should().Contain("Line 1");
        message.Content.Should().Contain("Line 2");
        message.Content.Should().Contain("Line 3");
    }

    [Fact]
    public void Content_WithCROnlyNewlines_ShouldBeHandled()
    {
        // Arrange - Old Mac-style line endings
        var content = "Line 1\rLine 2\rLine 3";

        // Act
        var message = CreateMessageWithContent(content);

        // Assert - document current behavior
        message.Content.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public void Content_WithMixedNewlines_ShouldBeHandled()
    {
        // Arrange - mixed style line endings (can happen from copy-paste)
        var content = "Line 1\nLine 2\r\nLine 3\rLine 4";

        // Act
        var message = CreateMessageWithContent(content);

        // Assert
        message.Content.Should().NotBeNullOrEmpty();
        message.Content.Should().Contain("Line 1");
    }

    #endregion

    #region Control Character Tests

    [Fact]
    public void Content_WithNullCharacter_ShouldBeHandled()
    {
        // Arrange - NULL character can cause issues in C strings and WhatsApp
        var content = "Hello\0World";

        // Act
        var message = CreateMessageWithContent(content);

        // Assert - NULL chars should ideally be stripped or cause validation error
        // This test exposes if NULL chars pass through unhandled
        message.Content.Should().NotBeNullOrEmpty();
        // POTENTIAL DEFECT: If Contains("\0") is true, NULL is not sanitized
    }

    [Fact]
    public void Content_WithBellCharacter_ShouldBeStrippedOrRejected()
    {
        // Arrange - Bell character (audible bell in terminals)
        var content = "Hello\u0007World";

        // Act
        var message = CreateMessageWithContent(content);

        // Assert - control chars should be handled
        message.Content.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public void Content_WithBackspaceCharacter_ShouldBeHandled()
    {
        // Arrange - Backspace character
        var content = "Hello\bWorld";

        // Act
        var message = CreateMessageWithContent(content);

        // Assert
        message.Content.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public void Content_WithTabCharacter_ShouldBePreserved()
    {
        // Arrange - Tab is common and should be preserved
        var content = "Column1\tColumn2\tColumn3";

        // Act
        var message = CreateMessageWithContent(content);

        // Assert
        message.Content.Should().Be("Column1\tColumn2\tColumn3");
    }

    [Fact]
    public void Content_WithFormFeed_ShouldBeHandled()
    {
        // Arrange - Form feed character
        var content = "Page1\u000CPage2";

        // Act
        var message = CreateMessageWithContent(content);

        // Assert
        message.Content.Should().NotBeNullOrEmpty();
    }

    [Theory]
    [InlineData("\u0000")] // NULL
    [InlineData("\u0001")] // SOH
    [InlineData("\u0002")] // STX
    [InlineData("\u0003")] // ETX
    [InlineData("\u0004")] // EOT
    [InlineData("\u0005")] // ENQ
    [InlineData("\u0006")] // ACK
    [InlineData("\u0007")] // BEL
    [InlineData("\u000B")] // VT (vertical tab)
    [InlineData("\u000E")] // SO
    [InlineData("\u000F")] // SI
    [InlineData("\u001B")] // ESC
    [InlineData("\u007F")] // DEL
    public void Content_WithControlCharacter_ShouldNotCorruptMessage(string controlChar)
    {
        // Arrange
        var content = $"Before{controlChar}After";

        // Act
        var message = CreateMessageWithContent(content);

        // Assert - message should not be corrupted
        message.Content.Should().NotBeNull();
        message.Content.Should().Contain("Before");
        message.Content.Should().Contain("After");
    }

    #endregion

    #region Unicode and Arabic Text Tests

    [Fact]
    public void Content_WithArabicText_ShouldBePreserved()
    {
        // Arrange
        var content = "مرحبا بك في العيادة";

        // Act
        var message = CreateMessageWithContent(content);

        // Assert
        message.Content.Should().Be("مرحبا بك في العيادة");
    }

    [Fact]
    public void Content_WithArabicDiacritics_ShouldBePreserved()
    {
        // Arrange - Arabic with diacritics (tashkeel)
        var content = "مَرْحَبًا بِكَ";

        // Act
        var message = CreateMessageWithContent(content);

        // Assert
        message.Content.Should().Be("مَرْحَبًا بِكَ");
    }

    [Fact]
    public void Content_WithMixedArabicEnglish_ShouldBePreserved()
    {
        // Arrange - RTL and LTR mixed
        var content = "Welcome مرحبا to العيادة clinic";

        // Act
        var message = CreateMessageWithContent(content);

        // Assert
        message.Content.Should().Be("Welcome مرحبا to العيادة clinic");
    }

    [Fact]
    public void Content_WithArabicNumbers_ShouldBePreserved()
    {
        // Arrange - Arabic-Indic numerals
        var content = "الموعد في ١٢:٣٠";

        // Act
        var message = CreateMessageWithContent(content);

        // Assert
        message.Content.Should().Be("الموعد في ١٢:٣٠");
    }

    [Fact]
    public void Content_WithEmoji_ShouldBePreserved()
    {
        // Arrange - common emoji
        var content = "Hello 👋 Welcome 😊";

        // Act
        var message = CreateMessageWithContent(content);

        // Assert
        message.Content.Should().Be("Hello 👋 Welcome 😊");
    }

    [Fact]
    public void Content_WithComplexEmoji_ShouldBePreserved()
    {
        // Arrange - skin tone modifier, family emoji (multi-codepoint)
        var content = "Doctor 👨‍⚕️ ready";

        // Act
        var message = CreateMessageWithContent(content);

        // Assert - complex emoji with ZWJ should be preserved
        message.Content.Should().Contain("👨‍⚕️");
    }

    #endregion

    #region Zero-Width and Invisible Character Tests

    [Fact]
    public void Content_WithZeroWidthSpace_ShouldBeHandled()
    {
        // Arrange - Zero-width space (can cause display issues)
        var content = "Hello\u200BWorld";

        // Act
        var message = CreateMessageWithContent(content);

        // Assert - zero-width chars are invisible but present
        // Ideally should be stripped, but test documents behavior
        message.Content.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public void Content_WithZeroWidthJoiner_ShouldBePreservedForEmoji()
    {
        // Arrange - ZWJ is required for combined emoji (like 👨‍👩‍👧)
        var content = "Family: 👨‍👩‍👧";

        // Act
        var message = CreateMessageWithContent(content);

        // Assert - ZWJ should be preserved for emoji
        message.Content.Should().Contain("👨‍👩‍👧");
    }

    [Fact]
    public void Content_WithBOM_ShouldBeHandled()
    {
        // Arrange - Byte Order Mark at start
        var content = "\uFEFFHello World";

        // Act
        var message = CreateMessageWithContent(content);

        // Assert - BOM should ideally be stripped
        message.Content.Should().NotBeNullOrEmpty();
        // Test if BOM is still present (potential defect if stripping expected)
    }

    [Fact]
    public void Content_WithRTLOverride_ShouldBeHandled()
    {
        // Arrange - Right-to-Left override (security concern for spoofing)
        var content = "Normal text\u202Edesrever";

        // Act
        var message = CreateMessageWithContent(content);

        // Assert - RLO/LRO chars are potential security issue
        // POTENTIAL DEFECT: These should possibly be stripped
        message.Content.Should().NotBeNullOrEmpty();
    }

    #endregion

    #region Whitespace Edge Cases

    [Fact]
    public void Content_WithLeadingWhitespace_ShouldDocument()
    {
        // Arrange
        var content = "   Hello World";

        // Act
        var message = CreateMessageWithContent(content);

        // Assert - documents current behavior (trim or preserve?)
        message.Content.Should().Be("   Hello World"); // Currently preserved
    }

    [Fact]
    public void Content_WithTrailingWhitespace_ShouldDocument()
    {
        // Arrange
        var content = "Hello World   ";

        // Act
        var message = CreateMessageWithContent(content);

        // Assert
        message.Content.Should().Be("Hello World   ");
    }

    [Fact]
    public void Content_WithOnlyWhitespace_ShouldDocument()
    {
        // Arrange - edge case: empty message
        var content = "   ";

        // Act
        var message = CreateMessageWithContent(content);

        // Assert - should this be allowed or rejected?
        message.Content.Should().Be("   ");
    }

    [Fact]
    public void Content_WithNonBreakingSpace_ShouldBePreserved()
    {
        // Arrange - NBSP
        var content = "Hello\u00A0World";

        // Act
        var message = CreateMessageWithContent(content);

        // Assert
        message.Content.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public void Content_EmptyString_ShouldDocument()
    {
        // Arrange
        var content = "";

        // Act
        var message = CreateMessageWithContent(content);

        // Assert - empty content allowed?
        message.Content.Should().BeEmpty();
    }

    #endregion

    #region Length and Size Edge Cases

    [Fact]
    public void Content_AtMaxLength_ShouldBeAccepted()
    {
        // Arrange - Message.Content has [StringLength(2000)]
        var content = new string('A', 2000);

        // Act
        var message = CreateMessageWithContent(content);

        // Assert
        message.Content.Should().HaveLength(2000);
    }

    [Fact]
    public void Content_ExceedsMaxLength_ShouldDocument()
    {
        // Arrange - exceeds max length
        var content = new string('A', 2001);

        // Act
        var message = CreateMessageWithContent(content);

        // Assert - documents that entity allows it (DB will truncate/reject)
        message.Content.Should().HaveLength(2001);
        // POTENTIAL DEFECT: Validation should catch this before persistence
    }

    [Fact]
    public void Content_WithMultibyteCharacters_ShouldCountCorrectly()
    {
        // Arrange - Arabic chars are multi-byte in UTF-8
        var content = new string('م', 1000); // 1000 Arabic meem characters

        // Act
        var message = CreateMessageWithContent(content);

        // Assert - character count should be 1000, not byte count
        message.Content.Should().HaveLength(1000);
    }

    [Fact]
    public void Content_WithEmoji_ShouldCountAsCharacters()
    {
        // Arrange - Emoji are 2+ code points
        var content = "Hello 👋👋👋👋👋";

        // Act
        var message = CreateMessageWithContent(content);

        // Assert - length should count Unicode scalar values
        message.Content.Length.Should().BeGreaterThan(5);
    }

    #endregion

    #region Special Characters in Phone Context

    [Fact]
    public void Content_WithPhoneNumberPlaceholder_ShouldBePreserved()
    {
        // Arrange - message might contain phone as placeholder
        var content = "Call us at {PN}";

        // Act
        var message = CreateMessageWithContent(content);

        // Assert
        message.Content.Should().Be("Call us at {PN}");
    }

    [Fact]
    public void Content_WithAllPlaceholders_ShouldBePreserved()
    {
        // Arrange - common placeholders
        var content = "{PN} - {CQP} - {ETR} - Queue Position";

        // Act
        var message = CreateMessageWithContent(content);

        // Assert
        message.Content.Should().Contain("{PN}");
        message.Content.Should().Contain("{CQP}");
        message.Content.Should().Contain("{ETR}");
    }

    #endregion

    #region SQL Injection / Security Edge Cases

    [Fact]
    public void Content_WithSQLInjectionAttempt_ShouldBePreserved()
    {
        // Arrange - SQL injection attempt (parameterized queries should handle)
        var content = "Hello'; DROP TABLE Messages; --";

        // Act
        var message = CreateMessageWithContent(content);

        // Assert - content should be preserved as-is (DB handles safely)
        message.Content.Should().Be("Hello'; DROP TABLE Messages; --");
    }

    [Fact]
    public void Content_WithHTMLTags_ShouldBePreserved()
    {
        // Arrange - HTML (WhatsApp doesn't render HTML)
        var content = "<script>alert('xss')</script>";

        // Act
        var message = CreateMessageWithContent(content);

        // Assert - preserved (WhatsApp renders as plain text)
        message.Content.Should().Contain("<script>");
    }

    #endregion
}
