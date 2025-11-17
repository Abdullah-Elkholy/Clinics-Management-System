using ClinicsManagementService.Controllers;
using ClinicsManagementService.Models;
using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.Services.Domain;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc;
using Moq;
using Xunit;

namespace ClinicsManagementService.UnitTests.Controllers
{
    public class BulkMessagingControllerTests
    {
        private readonly Mock<IMessageSender> _mockMessageSender;
        private readonly Mock<IWhatsAppService> _mockWhatsAppService;
        private readonly Mock<INotifier> _mockNotifier;
        private readonly Mock<IValidationService> _mockValidationService;
        private readonly BulkMessagingController _controller;

        public BulkMessagingControllerTests()
        {
            _mockMessageSender = new Mock<IMessageSender>();
            _mockWhatsAppService = new Mock<IWhatsAppService>();
            _mockNotifier = new Mock<INotifier>();
            _mockValidationService = new Mock<IValidationService>();
            _controller = new BulkMessagingController(
                _mockMessageSender.Object,
                _mockWhatsAppService.Object,
                _mockNotifier.Object,
                _mockValidationService.Object);
        }

        #region SendSingle - Success Scenarios

        [Fact]
        public async Task SendSingle_WithValidInput_ReturnsOk()
        {
            // Arrange
            var request = new PhoneMessageDto
            {
                Phone = "+201557121962",
                Message = "Hello, this is a test message"
            };

            _mockValidationService.Setup(x => x.ValidatePhoneNumber(request.Phone))
                .Returns(ValidationResult.Success());
            _mockValidationService.Setup(x => x.ValidateMessage(request.Message))
                .Returns(ValidationResult.Success());
            _mockMessageSender.Setup(x => x.SendMessageAsync(request.Phone, request.Message))
                .ReturnsAsync(true);

            // Act
            var result = await _controller.SendSingle(request);

            // Assert
            result.Should().BeOfType<OkObjectResult>();
            var okResult = result as OkObjectResult;
            okResult!.Value.Should().Be("Message sent successfully.");
            _mockMessageSender.Verify(x => x.SendMessageAsync(request.Phone, request.Message), Times.Once);
        }

        [Fact]
        public async Task SendSingle_WithFormattedPhone_ReturnsOk()
        {
            // Arrange
            var request = new PhoneMessageDto
            {
                Phone = "+20 155 712 1962",
                Message = "Test message"
            };

            _mockValidationService.Setup(x => x.ValidatePhoneNumber(request.Phone))
                .Returns(ValidationResult.Success());
            _mockValidationService.Setup(x => x.ValidateMessage(request.Message))
                .Returns(ValidationResult.Success());
            _mockMessageSender.Setup(x => x.SendMessageAsync(request.Phone, request.Message))
                .ReturnsAsync(true);

            // Act
            var result = await _controller.SendSingle(request);

            // Assert
            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task SendSingle_WithLongMessage_ReturnsOk()
        {
            // Arrange
            var longMessage = new string('A', 4096);
            var request = new PhoneMessageDto
            {
                Phone = "+201557121962",
                Message = longMessage
            };

            _mockValidationService.Setup(x => x.ValidatePhoneNumber(request.Phone))
                .Returns(ValidationResult.Success());
            _mockValidationService.Setup(x => x.ValidateMessage(request.Message))
                .Returns(ValidationResult.Success());
            _mockMessageSender.Setup(x => x.SendMessageAsync(request.Phone, request.Message))
                .ReturnsAsync(true);

            // Act
            var result = await _controller.SendSingle(request);

            // Assert
            result.Should().BeOfType<OkObjectResult>();
        }

        [Fact]
        public async Task SendSingle_WithSpecialCharacters_ReturnsOk()
        {
            // Arrange
            var request = new PhoneMessageDto
            {
                Phone = "+966501234567",
                Message = "Hello! 🎉 Test message with emoji and special chars: @#$%"
            };

            _mockValidationService.Setup(x => x.ValidatePhoneNumber(request.Phone))
                .Returns(ValidationResult.Success());
            _mockValidationService.Setup(x => x.ValidateMessage(request.Message))
                .Returns(ValidationResult.Success());
            _mockMessageSender.Setup(x => x.SendMessageAsync(request.Phone, request.Message))
                .ReturnsAsync(true);

            // Act
            var result = await _controller.SendSingle(request);

            // Assert
            result.Should().BeOfType<OkObjectResult>();
        }

        #endregion

        #region SendSingle - Validation Failure Scenarios

        [Fact]
        public async Task SendSingle_WithInvalidPhone_ReturnsBadRequest()
        {
            // Arrange
            var request = new PhoneMessageDto
            {
                Phone = "123",
                Message = "Test message"
            };

            _mockValidationService.Setup(x => x.ValidatePhoneNumber(request.Phone))
                .Returns(ValidationResult.Failure("Phone number must be between 7 and 15 digits."));

            // Act
            var result = await _controller.SendSingle(request);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
            var badRequest = result as BadRequestObjectResult;
            badRequest!.Value.Should().Be("Phone number must be between 7 and 15 digits.");
            _mockMessageSender.Verify(x => x.SendMessageAsync(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task SendSingle_WithTooLongPhone_ReturnsBadRequest()
        {
            // Arrange
            var request = new PhoneMessageDto
            {
                Phone = "12345678901234567",
                Message = "Test message"
            };

            _mockValidationService.Setup(x => x.ValidatePhoneNumber(request.Phone))
                .Returns(ValidationResult.Failure("Phone number must be between 7 and 15 digits."));

            // Act
            var result = await _controller.SendSingle(request);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task SendSingle_WithEmptyPhone_ReturnsBadRequest()
        {
            // Arrange
            var request = new PhoneMessageDto
            {
                Phone = "",
                Message = "Test message"
            };

            _mockValidationService.Setup(x => x.ValidatePhoneNumber(request.Phone))
                .Returns(ValidationResult.Failure("Phone number is required."));

            // Act
            var result = await _controller.SendSingle(request);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        [Fact]
        public async Task SendSingle_WithEmptyMessage_ReturnsBadRequest()
        {
            // Arrange
            var request = new PhoneMessageDto
            {
                Phone = "+201557121962",
                Message = ""
            };

            _mockValidationService.Setup(x => x.ValidatePhoneNumber(request.Phone))
                .Returns(ValidationResult.Success());
            _mockValidationService.Setup(x => x.ValidateMessage(request.Message))
                .Returns(ValidationResult.Failure("Message cannot be empty."));

            // Act
            var result = await _controller.SendSingle(request);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
            var badRequest = result as BadRequestObjectResult;
            badRequest!.Value.Should().Be("Message cannot be empty.");
            _mockMessageSender.Verify(x => x.SendMessageAsync(It.IsAny<string>(), It.IsAny<string>()), Times.Never);
        }

        [Fact]
        public async Task SendSingle_WithTooLongMessage_ReturnsBadRequest()
        {
            // Arrange
            var tooLongMessage = new string('A', 4097);
            var request = new PhoneMessageDto
            {
                Phone = "+201557121962",
                Message = tooLongMessage
            };

            _mockValidationService.Setup(x => x.ValidatePhoneNumber(request.Phone))
                .Returns(ValidationResult.Success());
            _mockValidationService.Setup(x => x.ValidateMessage(request.Message))
                .Returns(ValidationResult.Failure("Message is too long."));

            // Act
            var result = await _controller.SendSingle(request);

            // Assert
            result.Should().BeOfType<BadRequestObjectResult>();
        }

        #endregion

        #region SendSingle - Service Failure Scenarios

        [Fact]
        public async Task SendSingle_WithServiceFailure_Returns502()
        {
            // Arrange
            var request = new PhoneMessageDto
            {
                Phone = "+201557121962",
                Message = "Test message"
            };

            _mockValidationService.Setup(x => x.ValidatePhoneNumber(request.Phone))
                .Returns(ValidationResult.Success());
            _mockValidationService.Setup(x => x.ValidateMessage(request.Message))
                .Returns(ValidationResult.Success());
            _mockMessageSender.Setup(x => x.SendMessageAsync(request.Phone, request.Message))
                .ReturnsAsync(false);

            // Act
            var result = await _controller.SendSingle(request);

            // Assert
            result.Should().BeOfType<ObjectResult>();
            var objectResult = result as ObjectResult;
            objectResult!.StatusCode.Should().Be(502);
            objectResult.Value.Should().Be("Message failed to be sent.");
        }

        [Fact]
        public async Task SendSingle_WithServiceException_Returns500()
        {
            // Arrange
            var request = new PhoneMessageDto
            {
                Phone = "+201557121962",
                Message = "Test message"
            };

            _mockValidationService.Setup(x => x.ValidatePhoneNumber(request.Phone))
                .Returns(ValidationResult.Success());
            _mockValidationService.Setup(x => x.ValidateMessage(request.Message))
                .Returns(ValidationResult.Success());
            _mockMessageSender.Setup(x => x.SendMessageAsync(request.Phone, request.Message))
                .ThrowsAsync(new Exception("Service error"));

            // Act
            var result = await _controller.SendSingle(request);

            // Assert
            result.Should().BeOfType<ObjectResult>();
            var objectResult = result as ObjectResult;
            objectResult!.StatusCode.Should().Be(500);
            objectResult.Value.Should().NotBeNull();
            objectResult.Value!.ToString()!.Should().Contain("Internal error");
        }

        #endregion
    }
}

