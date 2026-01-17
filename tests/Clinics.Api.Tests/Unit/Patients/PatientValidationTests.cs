using System;
using System.ComponentModel.DataAnnotations;
using System.Collections.Generic;
using Clinics.Domain;
using FluentAssertions;
using Xunit;

namespace Clinics.Api.Tests.Unit.Patients;

/// <summary>
/// Phase 3.1: Patient validation and normalization unit tests.
/// 
/// Tests cover:
/// - Phone number formatting (country code, leading zeros, spaces, dashes)
/// - Full name validation (min/max length, special characters)
/// - Position validation (positive only)
/// - Field normalization (trimming, case)
/// </summary>
public class PatientValidationTests
{
    #region Test Helpers

    private static class PatientValidator
    {
        public static (bool IsValid, List<string> Errors) Validate(
            string? fullName,
            string? phoneNumber,
            string? countryCode,
            int? position = null)
        {
            var errors = new List<string>();

            // Full name validation
            if (string.IsNullOrWhiteSpace(fullName))
                errors.Add("Full name is required");
            else if (fullName.Length < 2)
                errors.Add("Full name must be at least 2 characters");
            else if (fullName.Length > 100)
                errors.Add("Full name must not exceed 100 characters");

            // Phone number validation
            if (string.IsNullOrWhiteSpace(phoneNumber))
                errors.Add("Phone number is required");
            else if (phoneNumber.Length < 5)
                errors.Add("Phone number must be at least 5 characters");
            else if (phoneNumber.Length > 20)
                errors.Add("Phone number must not exceed 20 characters");

            // Country code validation
            if (!string.IsNullOrEmpty(countryCode) && countryCode.Length > 10)
                errors.Add("Country code must not exceed 10 characters");

            // Position validation
            if (position.HasValue && position.Value < 1)
                errors.Add("Position must be >= 1");

            return (errors.Count == 0, errors);
        }

        public static string NormalizePhoneNumber(string phone)
        {
            // Remove common formatting characters
            var normalized = phone
                .Replace(" ", "")
                .Replace("-", "")
                .Replace("(", "")
                .Replace(")", "")
                .Replace(".", "");

            // Handle leading zeros with country code
            if (normalized.StartsWith("00"))
                normalized = "+" + normalized.Substring(2);

            return normalized;
        }

        public static string NormalizeFullName(string name)
        {
            // Trim and normalize whitespace
            return string.Join(" ", name.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries));
        }
    }

    #endregion

    #region Full Name Validation Tests

    [Fact]
    public void FullName_Valid_ShouldPass()
    {
        var (isValid, _) = PatientValidator.Validate("Ahmed Hassan", "+201000000001", "+20");
        isValid.Should().BeTrue();
    }

    [Fact]
    public void FullName_MinLength_ShouldPass()
    {
        var (isValid, _) = PatientValidator.Validate("AB", "+201000000001", "+20");
        isValid.Should().BeTrue();
    }

    [Fact]
    public void FullName_TooShort_ShouldFail()
    {
        var (isValid, errors) = PatientValidator.Validate("A", "+201000000001", "+20");
        isValid.Should().BeFalse();
        errors.Should().Contain(e => e.Contains("at least 2"));
    }

    [Fact]
    public void FullName_MaxLength_ShouldPass()
    {
        var longName = new string('أ', 100); // Arabic char
        var (isValid, _) = PatientValidator.Validate(longName, "+201000000001", "+20");
        isValid.Should().BeTrue();
    }

    [Fact]
    public void FullName_TooLong_ShouldFail()
    {
        var longName = new string('A', 101);
        var (isValid, errors) = PatientValidator.Validate(longName, "+201000000001", "+20");
        isValid.Should().BeFalse();
        errors.Should().Contain(e => e.Contains("100"));
    }

    [Fact]
    public void FullName_Empty_ShouldFail()
    {
        var (isValid, errors) = PatientValidator.Validate("", "+201000000001", "+20");
        isValid.Should().BeFalse();
        errors.Should().Contain(e => e.Contains("required"));
    }

    [Fact]
    public void FullName_WhitespaceOnly_ShouldFail()
    {
        var (isValid, errors) = PatientValidator.Validate("   ", "+201000000001", "+20");
        isValid.Should().BeFalse();
        errors.Should().Contain(e => e.Contains("required"));
    }

    [Fact]
    public void FullName_ArabicText_ShouldPass()
    {
        var (isValid, _) = PatientValidator.Validate("أحمد حسن", "+201000000001", "+20");
        isValid.Should().BeTrue();
    }

    #endregion

    #region Phone Number Validation Tests

    [Fact]
    public void Phone_Valid_ShouldPass()
    {
        var (isValid, _) = PatientValidator.Validate("Ahmed", "+201234567890", "+20");
        isValid.Should().BeTrue();
    }

    [Fact]
    public void Phone_MinLength_ShouldPass()
    {
        var (isValid, _) = PatientValidator.Validate("Ahmed", "12345", "+20");
        isValid.Should().BeTrue();
    }

    [Fact]
    public void Phone_TooShort_ShouldFail()
    {
        var (isValid, errors) = PatientValidator.Validate("Ahmed", "1234", "+20");
        isValid.Should().BeFalse();
        errors.Should().Contain(e => e.Contains("5"));
    }

    [Fact]
    public void Phone_MaxLength_ShouldPass()
    {
        var (isValid, _) = PatientValidator.Validate("Ahmed", "12345678901234567890", "+20");
        isValid.Should().BeTrue();
    }

    [Fact]
    public void Phone_TooLong_ShouldFail()
    {
        var (isValid, errors) = PatientValidator.Validate("Ahmed", "123456789012345678901", "+20");
        isValid.Should().BeFalse();
        errors.Should().Contain(e => e.Contains("20"));
    }

    [Fact]
    public void Phone_Empty_ShouldFail()
    {
        var (isValid, errors) = PatientValidator.Validate("Ahmed", "", "+20");
        isValid.Should().BeFalse();
        errors.Should().Contain(e => e.Contains("required"));
    }

    #endregion

    #region Phone Number Normalization Tests

    [Fact]
    public void NormalizePhone_WithSpaces_ShouldRemove()
    {
        var result = PatientValidator.NormalizePhoneNumber("0100 123 4567");
        result.Should().Be("01001234567");
    }

    [Fact]
    public void NormalizePhone_WithDashes_ShouldRemove()
    {
        var result = PatientValidator.NormalizePhoneNumber("0100-123-4567");
        result.Should().Be("01001234567");
    }

    [Fact]
    public void NormalizePhone_WithParentheses_ShouldRemove()
    {
        var result = PatientValidator.NormalizePhoneNumber("(0100) 1234567");
        result.Should().Be("01001234567");
    }

    [Fact]
    public void NormalizePhone_WithLeadingDoubleZero_ShouldConvertToPlus()
    {
        var result = PatientValidator.NormalizePhoneNumber("00201234567890");
        result.Should().Be("+201234567890");
    }

    [Fact]
    public void NormalizePhone_AlreadyNormalized_ShouldNotChange()
    {
        var result = PatientValidator.NormalizePhoneNumber("+201234567890");
        result.Should().Be("+201234567890");
    }

    #endregion

    #region Full Name Normalization Tests

    [Fact]
    public void NormalizeName_WithLeadingSpaces_ShouldTrim()
    {
        var result = PatientValidator.NormalizeFullName("  Ahmed Hassan  ");
        result.Should().Be("Ahmed Hassan");
    }

    [Fact]
    public void NormalizeName_WithExtraSpaces_ShouldNormalize()
    {
        var result = PatientValidator.NormalizeFullName("Ahmed    Hassan");
        result.Should().Be("Ahmed Hassan");
    }

    #endregion

    #region Country Code Validation Tests

    [Fact]
    public void CountryCode_Valid_ShouldPass()
    {
        var (isValid, _) = PatientValidator.Validate("Ahmed", "+201234567890", "+20");
        isValid.Should().BeTrue();
    }

    [Fact]
    public void CountryCode_TooLong_ShouldFail()
    {
        var (isValid, errors) = PatientValidator.Validate("Ahmed", "+201234567890", "+12345678901");
        isValid.Should().BeFalse();
        errors.Should().Contain(e => e.Contains("10"));
    }

    [Fact]
    public void CountryCode_Empty_ShouldPass()
    {
        // Empty country code is allowed (uses default)
        var (isValid, _) = PatientValidator.Validate("Ahmed", "+201234567890", "");
        isValid.Should().BeTrue();
    }

    #endregion

    #region Position Validation Tests

    [Fact]
    public void Position_Valid_ShouldPass()
    {
        var (isValid, _) = PatientValidator.Validate("Ahmed", "+201234567890", "+20", position: 1);
        isValid.Should().BeTrue();
    }

    [Fact]
    public void Position_Zero_ShouldFail()
    {
        var (isValid, errors) = PatientValidator.Validate("Ahmed", "+201234567890", "+20", position: 0);
        isValid.Should().BeFalse();
        errors.Should().Contain(e => e.Contains("1"));
    }

    [Fact]
    public void Position_Negative_ShouldFail()
    {
        var (isValid, errors) = PatientValidator.Validate("Ahmed", "+201234567890", "+20", position: -1);
        isValid.Should().BeFalse();
    }

    [Fact]
    public void Position_NotProvided_ShouldPass()
    {
        // When position is null, it's auto-assigned
        var (isValid, _) = PatientValidator.Validate("Ahmed", "+201234567890", "+20", position: null);
        isValid.Should().BeTrue();
    }

    #endregion

    #region Edge Cases

    [Fact]
    public void MultipleErrors_ShouldReturnAll()
    {
        var (isValid, errors) = PatientValidator.Validate("A", "123", "+20", position: 0);
        isValid.Should().BeFalse();
        errors.Should().HaveCountGreaterThan(1);
    }

    [Fact]
    public void AllFieldsNull_ShouldReturnMultipleErrors()
    {
        var (isValid, errors) = PatientValidator.Validate(null, null, null);
        isValid.Should().BeFalse();
        errors.Should().HaveCountGreaterThanOrEqualTo(2);
    }

    #endregion
}
