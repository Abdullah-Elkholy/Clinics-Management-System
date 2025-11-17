using FluentAssertions;
using Xunit;
using ClinicsManagementService.Services.Domain;
using ClinicsManagementService.UnitTests.Common;
using ClinicsManagementService.Models;

namespace ClinicsManagementService.UnitTests.Services.Domain
{
    public class ValidationServiceEdgeCasesTests
    {
        private readonly ValidationService _validationService;

        public ValidationServiceEdgeCasesTests()
        {
            _validationService = new ValidationService();
        }

        #region Phone Number Edge Cases

        [Theory]
        [InlineData("+12345678901234567890")] // Very long number
        [InlineData("+1")] // Very short number
        [InlineData("+123456789012345678901234567890")] // Extremely long
        [InlineData("12345678901234567890")] // Long without plus
        public void ValidatePhoneNumber_WithBoundaryLengths_ReturnsSuccess(string phoneNumber)
        {
            // Act
            var result = _validationService.ValidatePhoneNumber(phoneNumber);

            // Assert
            result.IsValid.Should().BeTrue();
        }

        [Theory]
        [InlineData("+1-234-567-8900")] // With dashes
        [InlineData("+1 (234) 567-8900")] // With parentheses and spaces
        [InlineData("+1.234.567.8900")] // With dots
        [InlineData("+1 234 567 8900")] // With spaces
        public void ValidatePhoneNumber_WithSpecialCharacters_ReturnsFailure(string phoneNumber)
        {
            // Act
            var result = _validationService.ValidatePhoneNumber(phoneNumber);

            // Assert
            result.IsValid.Should().BeFalse();
            result.ErrorMessage.Should().Contain("digits");
        }

        [Theory]
        [InlineData("++1234567890")] // Double plus
        [InlineData("+1234567890+")] // Plus at end
        [InlineData("123+4567890")] // Plus in middle
        public void ValidatePhoneNumber_WithInvalidPlusPlacement_ReturnsFailure(string phoneNumber)
        {
            // Act
            var result = _validationService.ValidatePhoneNumber(phoneNumber);

            // Assert
            result.IsValid.Should().BeFalse();
        }

        [Theory]
        [InlineData("+")] // Only plus
        [InlineData("+++")] // Multiple pluses
        [InlineData("+abc123")] // Letters after plus
        [InlineData("abc123")] // Letters without plus
        public void ValidatePhoneNumber_WithInvalidCharacters_ReturnsFailure(string phoneNumber)
        {
            // Act
            var result = _validationService.ValidatePhoneNumber(phoneNumber);

            // Assert
            result.IsValid.Should().BeFalse();
        }

        [Fact]
        public void ValidatePhoneNumber_WithWhitespaceOnly_ReturnsFailure()
        {
            // Act
            var result = _validationService.ValidatePhoneNumber("   ");

            // Assert
            result.IsValid.Should().BeFalse();
            result.ErrorMessage.Should().Contain("required");
        }

        [Fact]
        public void ValidatePhoneNumber_WithTabCharacter_ReturnsFailure()
        {
            // Act
            var result = _validationService.ValidatePhoneNumber("\t");

            // Assert
            result.IsValid.Should().BeFalse();
        }

        [Fact]
        public void ValidatePhoneNumber_WithNewlineCharacter_ReturnsFailure()
        {
            // Act
            var result = _validationService.ValidatePhoneNumber("\n");

            // Assert
            result.IsValid.Should().BeFalse();
        }

        [Theory]
        [InlineData("+1234567890123456789012345678901234567890")] // 40+ digits
        [InlineData("1234567890123456789012345678901234567890")] // 40+ digits without plus
        public void ValidatePhoneNumber_WithExtremelyLongNumbers_ReturnsSuccess(string phoneNumber)
        {
            // Act
            var result = _validationService.ValidatePhoneNumber(phoneNumber);

            // Assert
            // Current validation only checks format, not length
            result.IsValid.Should().BeTrue();
        }

        #endregion

        #region Message Edge Cases

        [Fact]
        public void ValidateMessage_WithExactMaxLength_ReturnsSuccess()
        {
            // Arrange
            var message = new string('A', 4096);

            // Act
            var result = _validationService.ValidateMessage(message);

            // Assert
            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public void ValidateMessage_WithOneOverMaxLength_ReturnsFailure()
        {
            // Arrange
            var message = new string('A', 4097);

            // Act
            var result = _validationService.ValidateMessage(message);

            // Assert
            result.IsValid.Should().BeFalse();
            result.ErrorMessage.Should().Contain("too long");
        }

        [Fact]
        public void ValidateMessage_WithVeryLongMessage_ReturnsFailure()
        {
            // Arrange
            var message = new string('A', 10000);

            // Act
            var result = _validationService.ValidateMessage(message);

            // Assert
            result.IsValid.Should().BeFalse();
        }

        [Theory]
        [InlineData("\n")]
        [InlineData("\r\n")]
        [InlineData("\t")]
        [InlineData("   ")]
        public void ValidateMessage_WithOnlyWhitespace_ReturnsFailure(string message)
        {
            // Act
            var result = _validationService.ValidateMessage(message);

            // Assert
            result.IsValid.Should().BeFalse();
            result.ErrorMessage.Should().Contain("empty");
        }

        [Fact]
        public void ValidateMessage_WithUnicodeCharacters_ReturnsSuccess()
        {
            // Arrange
            var message = "Hello 世界 مرحبا Здравствуй 🌍";

            // Act
            var result = _validationService.ValidateMessage(message);

            // Assert
            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public void ValidateMessage_WithEmojis_ReturnsSuccess()
        {
            // Arrange
            var message = "Hello 😀 🎉 🚀 ✅";

            // Act
            var result = _validationService.ValidateMessage(message);

            // Assert
            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public void ValidateMessage_WithSpecialCharacters_ReturnsSuccess()
        {
            // Arrange
            var message = "Hello! @#$%^&*()_+-=[]{}|;':\",./<>?";

            // Act
            var result = _validationService.ValidateMessage(message);

            // Assert
            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public void ValidateMessage_WithSingleCharacter_ReturnsSuccess()
        {
            // Arrange
            var message = "A";

            // Act
            var result = _validationService.ValidateMessage(message);

            // Assert
            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public void ValidateMessage_WithNewlinesAndTabs_ReturnsSuccess()
        {
            // Arrange
            var message = "Line 1\nLine 2\r\nLine 3\tTabbed";

            // Act
            var result = _validationService.ValidateMessage(message);

            // Assert
            result.IsValid.Should().BeTrue();
        }

        #endregion

        #region Bulk Request Edge Cases

        [Fact]
        public void ValidateBulkRequest_WithSingleItem_ReturnsSuccess()
        {
            // Arrange
            var request = new BulkPhoneMessageRequest
            {
                Items = new List<PhoneMessageDto>
                {
                    new PhoneMessageDto { Phone = TestDataBuilder.ValidPhoneNumber, Message = "Test" }
                }
            };

            // Act
            var result = _validationService.ValidateBulkRequest(request);

            // Assert
            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public void ValidateBulkRequest_WithLargeNumberOfItems_ReturnsSuccess()
        {
            // Arrange
            var items = Enumerable.Range(1, 1000)
                .Select(i => new PhoneMessageDto
                {
                    Phone = $"+1234567890{i}",
                    Message = $"Message {i}"
                })
                .ToList();

            var request = new BulkPhoneMessageRequest { Items = items };

            // Act
            var result = _validationService.ValidateBulkRequest(request);

            // Assert
            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public void ValidateBulkRequest_WithDuplicatePhoneNumbers_ReturnsSuccess()
        {
            // Arrange
            var request = new BulkPhoneMessageRequest
            {
                Items = new List<PhoneMessageDto>
                {
                    new PhoneMessageDto { Phone = TestDataBuilder.ValidPhoneNumber, Message = "Message 1" },
                    new PhoneMessageDto { Phone = TestDataBuilder.ValidPhoneNumber, Message = "Message 2" }
                }
            };

            // Act
            var result = _validationService.ValidateBulkRequest(request);

            // Assert
            // Current validation doesn't check for duplicates
            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public void ValidateBulkRequest_WithMixedValidAndInvalidPhones_ReturnsFailure()
        {
            // Arrange
            var request = new BulkPhoneMessageRequest
            {
                Items = new List<PhoneMessageDto>
                {
                    new PhoneMessageDto { Phone = TestDataBuilder.ValidPhoneNumber, Message = "Valid" },
                    new PhoneMessageDto { Phone = "invalid", Message = "Invalid phone" }
                }
            };

            // Act
            var result = _validationService.ValidateBulkRequest(request);

            // Assert
            result.IsValid.Should().BeFalse();
            result.ErrorMessage.Should().Contain("Invalid phone");
        }

        [Fact]
        public void ValidateBulkRequest_WithMixedValidAndInvalidMessages_ReturnsFailure()
        {
            // Arrange
            var request = new BulkPhoneMessageRequest
            {
                Items = new List<PhoneMessageDto>
                {
                    new PhoneMessageDto { Phone = TestDataBuilder.ValidPhoneNumber, Message = "Valid" },
                    new PhoneMessageDto { Phone = TestDataBuilder.ValidPhoneNumber, Message = "" }
                }
            };

            // Act
            var result = _validationService.ValidateBulkRequest(request);

            // Assert
            result.IsValid.Should().BeFalse();
            result.ErrorMessage.Should().Contain("Invalid message");
        }

        [Fact]
        public void ValidateBulkRequest_WithNullItemsList_ReturnsFailure()
        {
            // Arrange
            var request = new BulkPhoneMessageRequest { Items = null! };

            // Act
            var result = _validationService.ValidateBulkRequest(request);

            // Assert
            result.IsValid.Should().BeFalse();
            result.ErrorMessage.Should().Contain("at least one item");
        }

        [Fact]
        public void ValidateBulkRequest_WithNullRequest_ReturnsFailure()
        {
            // Act
            var result = _validationService.ValidateBulkRequest(null!);

            // Assert
            result.IsValid.Should().BeFalse();
            result.ErrorMessage.Should().Contain("at least one item");
        }

        #endregion

        #region Delay Parameters Edge Cases

        [Theory]
        [InlineData(0, 0)]
        [InlineData(0, 100)]
        [InlineData(100, 100)]
        [InlineData(1000, 5000)]
        public void ValidateDelayParameters_WithValidRanges_ReturnsSuccess(int minDelay, int maxDelay)
        {
            // Act
            var result = _validationService.ValidateDelayParameters(minDelay, maxDelay);

            // Assert
            result.IsValid.Should().BeTrue();
        }

        [Theory]
        [InlineData(-1, 100)]
        [InlineData(100, -1)]
        [InlineData(-10, -5)]
        public void ValidateDelayParameters_WithNegativeValues_ReturnsFailure(int minDelay, int maxDelay)
        {
            // Act
            var result = _validationService.ValidateDelayParameters(minDelay, maxDelay);

            // Assert
            result.IsValid.Should().BeFalse();
            result.ErrorMessage.Should().Contain("non-negative");
        }

        [Fact]
        public void ValidateDelayParameters_WithMinGreaterThanMax_ReturnsFailure()
        {
            // Act
            var result = _validationService.ValidateDelayParameters(200, 100);

            // Assert
            result.IsValid.Should().BeFalse();
            result.ErrorMessage.Should().Contain("cannot be greater");
        }

        [Theory]
        [InlineData(60000)]
        [InlineData(60001)]
        [InlineData(100000)]
        public void ValidateDelayParameters_WithMaxDelayTooLarge_ReturnsFailure(int maxDelay)
        {
            // Act
            var result = _validationService.ValidateDelayParameters(0, maxDelay);

            // Assert
            result.IsValid.Should().BeFalse();
            result.ErrorMessage.Should().Contain("too large");
        }

        [Fact]
        public void ValidateDelayParameters_WithExactMaxAllowed_ReturnsSuccess()
        {
            // Act
            var result = _validationService.ValidateDelayParameters(0, 60000);

            // Assert
            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public void ValidateDelayParameters_WithOneOverMaxAllowed_ReturnsFailure()
        {
            // Act
            var result = _validationService.ValidateDelayParameters(0, 60001);

            // Assert
            result.IsValid.Should().BeFalse();
        }

        [Theory]
        [InlineData(int.MaxValue, int.MaxValue)]
        [InlineData(0, int.MaxValue)]
        public void ValidateDelayParameters_WithIntMaxValue_ReturnsFailure(int minDelay, int maxDelay)
        {
            // Act
            var result = _validationService.ValidateDelayParameters(minDelay, maxDelay);

            // Assert
            result.IsValid.Should().BeFalse();
        }

        #endregion
    }
}

