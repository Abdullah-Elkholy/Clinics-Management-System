using FluentAssertions;
using Xunit;
using ClinicsManagementService.Services.Domain;
using ClinicsManagementService.UnitTests.Common;
using ClinicsManagementService.Models;

namespace ClinicsManagementService.UnitTests.Services.Domain
{
    public class ValidationServiceTests
    {
        private readonly ValidationService _validationService;

        public ValidationServiceTests()
        {
            _validationService = new ValidationService();
        }

        #region Phone Number Validation Tests

        [Fact]
        public void ValidatePhoneNumber_WithValidPhoneNumber_ReturnsSuccess()
        {
            // Act
            var result = _validationService.ValidatePhoneNumber(TestDataBuilder.ValidPhoneNumber);

            // Assert
            result.IsValid.Should().BeTrue();
            result.ErrorMessage.Should().BeNull();
        }

        [Fact]
        public void ValidatePhoneNumber_WithValidPhoneNumberWithoutPlus_ReturnsSuccess()
        {
            // Act
            var result = _validationService.ValidatePhoneNumber(TestDataBuilder.ValidPhoneNumberWithoutPlus);

            // Assert
            result.IsValid.Should().BeTrue();
            result.ErrorMessage.Should().BeNull();
        }

        [Fact]
        public void ValidatePhoneNumber_WithEmptyPhoneNumber_ReturnsFailure()
        {
            // Act
            var result = _validationService.ValidatePhoneNumber(TestDataBuilder.EmptyPhoneNumber);

            // Assert
            result.IsValid.Should().BeFalse();
            result.ErrorMessage.Should().Contain("required");
        }

        [Fact]
        public void ValidatePhoneNumber_WithNullPhoneNumber_ReturnsFailure()
        {
            // Act
            var result = _validationService.ValidatePhoneNumber(TestDataBuilder.NullPhoneNumber);

            // Assert
            result.IsValid.Should().BeFalse();
            result.ErrorMessage.Should().Contain("required");
        }

        [Fact]
        public void ValidatePhoneNumber_WithInvalidPhoneNumber_ReturnsFailure()
        {
            // Act
            var result = _validationService.ValidatePhoneNumber(TestDataBuilder.InvalidPhoneNumber);

            // Assert
            result.IsValid.Should().BeFalse();
            result.ErrorMessage.Should().Contain("digits");
        }

        [Fact]
        public void ValidatePhoneNumber_WithWhitespacePhoneNumber_ReturnsFailure()
        {
            // Act
            var result = _validationService.ValidatePhoneNumber("   ");

            // Assert
            result.IsValid.Should().BeFalse();
            result.ErrorMessage.Should().Contain("required");
        }

        #endregion

        #region Message Validation Tests

        [Fact]
        public void ValidateMessage_WithValidMessage_ReturnsSuccess()
        {
            // Act
            var result = _validationService.ValidateMessage(TestDataBuilder.ValidMessage);

            // Assert
            result.IsValid.Should().BeTrue();
            result.ErrorMessage.Should().BeNull();
        }

        [Fact]
        public void ValidateMessage_WithLongValidMessage_ReturnsSuccess()
        {
            // Act
            var result = _validationService.ValidateMessage(TestDataBuilder.LongValidMessage);

            // Assert
            result.IsValid.Should().BeTrue();
            result.ErrorMessage.Should().BeNull();
        }

        [Fact]
        public void ValidateMessage_WithEmptyMessage_ReturnsFailure()
        {
            // Act
            var result = _validationService.ValidateMessage(TestDataBuilder.EmptyMessage);

            // Assert
            result.IsValid.Should().BeFalse();
            result.ErrorMessage.Should().Contain("empty");
        }

        [Fact]
        public void ValidateMessage_WithNullMessage_ReturnsFailure()
        {
            // Act
            var result = _validationService.ValidateMessage(TestDataBuilder.NullMessage);

            // Assert
            result.IsValid.Should().BeFalse();
            result.ErrorMessage.Should().Contain("empty");
        }

        [Fact]
        public void ValidateMessage_WithTooLongMessage_ReturnsFailure()
        {
            // Act
            var result = _validationService.ValidateMessage(TestDataBuilder.TooLongMessage);

            // Assert
            result.IsValid.Should().BeFalse();
            result.ErrorMessage.Should().Contain("too long");
        }

        [Fact]
        public void ValidateMessage_WithMaxLengthMessage_ReturnsSuccess()
        {
            // Arrange
            var maxLengthMessage = new string('A', 4096);

            // Act
            var result = _validationService.ValidateMessage(maxLengthMessage);

            // Assert
            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public void ValidateMessage_WithWhitespaceMessage_ReturnsFailure()
        {
            // Act
            var result = _validationService.ValidateMessage("   ");

            // Assert
            result.IsValid.Should().BeFalse();
            result.ErrorMessage.Should().Contain("empty");
        }

        #endregion

        #region Bulk Request Validation Tests

        [Fact]
        public void ValidateBulkRequest_WithValidRequest_ReturnsSuccess()
        {
            // Act
            var result = _validationService.ValidateBulkRequest(TestDataBuilder.ValidBulkRequest);

            // Assert
            result.IsValid.Should().BeTrue();
            result.ErrorMessage.Should().BeNull();
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

        [Fact]
        public void ValidateBulkRequest_WithEmptyItems_ReturnsFailure()
        {
            // Act
            var result = _validationService.ValidateBulkRequest(TestDataBuilder.EmptyBulkRequest);

            // Assert
            result.IsValid.Should().BeFalse();
            result.ErrorMessage.Should().Contain("at least one item");
        }

        [Fact]
        public void ValidateBulkRequest_WithInvalidPhone_ReturnsFailure()
        {
            // Act
            var result = _validationService.ValidateBulkRequest(TestDataBuilder.InvalidBulkRequest);

            // Assert
            result.IsValid.Should().BeFalse();
            result.ErrorMessage.Should().Contain("Invalid phone");
        }

        [Fact]
        public void ValidateBulkRequest_WithInvalidMessage_ReturnsFailure()
        {
            // Arrange
            var request = new BulkPhoneMessageRequest
            {
                Items = new[]
                {
                    new PhoneMessageDto { Phone = TestDataBuilder.ValidPhoneNumber, Message = TestDataBuilder.EmptyMessage }
                }
            };

            // Act
            var result = _validationService.ValidateBulkRequest(request);

            // Assert
            result.IsValid.Should().BeFalse();
            result.ErrorMessage.Should().Contain("Invalid message");
        }

        #endregion

        #region Delay Parameters Validation Tests

        [Fact]
        public void ValidateDelayParameters_WithValidParameters_ReturnsSuccess()
        {
            // Act
            var result = _validationService.ValidateDelayParameters(1000, 3000);

            // Assert
            result.IsValid.Should().BeTrue();
            result.ErrorMessage.Should().BeNull();
        }

        [Fact]
        public void ValidateDelayParameters_WithEqualMinMax_ReturnsSuccess()
        {
            // Act
            var result = _validationService.ValidateDelayParameters(1000, 1000);

            // Assert
            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public void ValidateDelayParameters_WithNegativeMin_ReturnsFailure()
        {
            // Act
            var result = _validationService.ValidateDelayParameters(-1, 3000);

            // Assert
            result.IsValid.Should().BeFalse();
            result.ErrorMessage.Should().Contain("non-negative");
        }

        [Fact]
        public void ValidateDelayParameters_WithNegativeMax_ReturnsFailure()
        {
            // Act
            var result = _validationService.ValidateDelayParameters(1000, -1);

            // Assert
            result.IsValid.Should().BeFalse();
            result.ErrorMessage.Should().Contain("non-negative");
        }

        [Fact]
        public void ValidateDelayParameters_WithMinGreaterThanMax_ReturnsFailure()
        {
            // Act
            var result = _validationService.ValidateDelayParameters(3000, 1000);

            // Assert
            result.IsValid.Should().BeFalse();
            result.ErrorMessage.Should().Contain("cannot be greater");
        }

        [Fact]
        public void ValidateDelayParameters_WithMaxTooLarge_ReturnsFailure()
        {
            // Act
            var result = _validationService.ValidateDelayParameters(1000, 70000);

            // Assert
            result.IsValid.Should().BeFalse();
            result.ErrorMessage.Should().Contain("too large");
        }

        [Fact]
        public void ValidateDelayParameters_WithMaxAtLimit_ReturnsSuccess()
        {
            // Act
            var result = _validationService.ValidateDelayParameters(1000, 60000);

            // Assert
            result.IsValid.Should().BeTrue();
        }

        [Fact]
        public void ValidateDelayParameters_WithZeroValues_ReturnsSuccess()
        {
            // Act
            var result = _validationService.ValidateDelayParameters(0, 0);

            // Assert
            result.IsValid.Should().BeTrue();
        }

        #endregion
    }
}

