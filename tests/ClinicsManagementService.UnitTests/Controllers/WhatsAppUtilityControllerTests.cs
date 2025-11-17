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
    public class WhatsAppUtilityControllerTests
    {
        private readonly Mock<IWhatsAppService> _mockWhatsAppService;
        private readonly Mock<IWhatsAppSessionManager> _mockSessionManager;
        private readonly Mock<INotifier> _mockNotifier;
        private readonly Mock<Func<IBrowserSession>> _mockBrowserSessionFactory;
        private readonly Mock<IWhatsAppUIService> _mockWhatsAppUIService;
        private readonly Mock<IRetryService> _mockRetryService;
        private readonly WhatsAppUtilityController _controller;

        public WhatsAppUtilityControllerTests()
        {
            _mockWhatsAppService = new Mock<IWhatsAppService>();
            _mockSessionManager = new Mock<IWhatsAppSessionManager>();
            _mockNotifier = new Mock<INotifier>();
            _mockBrowserSessionFactory = new Mock<Func<IBrowserSession>>();
            _mockWhatsAppUIService = new Mock<IWhatsAppUIService>();
            _mockRetryService = new Mock<IRetryService>();
            _controller = new WhatsAppUtilityController(
                _mockWhatsAppService.Object,
                _mockNotifier.Object,
                _mockSessionManager.Object,
                _mockBrowserSessionFactory.Object,
                _mockWhatsAppUIService.Object,
                _mockRetryService.Object);
        }

        #region CheckWhatsApp - Success Scenarios

        [Fact]
        public async Task CheckWhatsApp_WithValidPhoneHasWhatsApp_ReturnsSuccessTrue()
        {
            // Arrange
            var phoneNumber = "+201557121962";
            var mockSession = new Mock<IBrowserSession>();
            var expectedResult = OperationResult<bool>.Success(true);

            _mockSessionManager.Setup(x => x.GetOrCreateSessionAsync())
                .ReturnsAsync(mockSession.Object);
            _mockWhatsAppService.Setup(x => x.CheckWhatsAppNumberAsync(phoneNumber, mockSession.Object))
                .ReturnsAsync(expectedResult);
            mockSession.Setup(x => x.DisposeAsync())
                .Returns(ValueTask.CompletedTask);

            // Act
            var result = await _controller.CheckWhatsAppNumber(phoneNumber);

            // Assert
            result.Result.Should().BeOfType<OkObjectResult>();
            var okResult = result.Result as OkObjectResult;
            var operationResult = okResult!.Value as OperationResult<bool>;
            operationResult!.IsSuccess.Should().BeTrue();
            operationResult.Data.Should().BeTrue();
            operationResult.State.Should().Be(OperationState.Success);
        }

        [Fact]
        public async Task CheckWhatsApp_WithValidPhoneNoWhatsApp_ReturnsSuccessFalse()
        {
            // Arrange
            var phoneNumber = "+201234567890";
            var mockSession = new Mock<IBrowserSession>();
            var expectedResult = OperationResult<bool>.Failure("Number does not have WhatsApp.", false);

            _mockSessionManager.Setup(x => x.GetOrCreateSessionAsync())
                .ReturnsAsync(mockSession.Object);
            _mockWhatsAppService.Setup(x => x.CheckWhatsAppNumberAsync(phoneNumber, mockSession.Object))
                .ReturnsAsync(expectedResult);
            mockSession.Setup(x => x.DisposeAsync())
                .Returns(ValueTask.CompletedTask);

            // Act
            var result = await _controller.CheckWhatsAppNumber(phoneNumber);

            // Assert
            result.Result.Should().BeOfType<OkObjectResult>();
            var okResult = result.Result as OkObjectResult;
            var operationResult = okResult!.Value as OperationResult<bool>;
            operationResult!.IsSuccess.Should().BeFalse();
            operationResult.Data.Should().BeFalse();
            operationResult.State.Should().Be(OperationState.Failure);
        }

        [Fact]
        public async Task CheckWhatsApp_WithFormattedPhone_ReturnsResult()
        {
            // Arrange
            var phoneNumber = "+20%20155%20712%201962"; // URL encoded: "+20 155 712 1962"
            var mockSession = new Mock<IBrowserSession>();
            var expectedResult = OperationResult<bool>.Success(true);

            _mockSessionManager.Setup(x => x.GetOrCreateSessionAsync())
                .ReturnsAsync(mockSession.Object);
            _mockWhatsAppService.Setup(x => x.CheckWhatsAppNumberAsync(It.IsAny<string>(), mockSession.Object))
                .ReturnsAsync(expectedResult);
            mockSession.Setup(x => x.DisposeAsync())
                .Returns(ValueTask.CompletedTask);

            // Act
            var result = await _controller.CheckWhatsAppNumber(phoneNumber);

            // Assert
            result.Result.Should().BeOfType<OkObjectResult>();
        }

        #endregion

        #region CheckWhatsApp - Failure Scenarios

        [Fact]
        public async Task CheckWhatsApp_WithPendingQR_ReturnsPendingQR()
        {
            // Arrange
            var phoneNumber = "+201557121962";
            var mockSession = new Mock<IBrowserSession>();
            var expectedResult = OperationResult<bool>.PendingQR("Authentication required", false);

            _mockSessionManager.Setup(x => x.GetOrCreateSessionAsync())
                .ReturnsAsync(mockSession.Object);
            _mockWhatsAppService.Setup(x => x.CheckWhatsAppNumberAsync(phoneNumber, mockSession.Object))
                .ReturnsAsync(expectedResult);
            mockSession.Setup(x => x.DisposeAsync())
                .Returns(ValueTask.CompletedTask);

            // Act
            var result = await _controller.CheckWhatsAppNumber(phoneNumber);

            // Assert
            result.Result.Should().BeOfType<OkObjectResult>();
            var okResult = result.Result as OkObjectResult;
            var operationResult = okResult!.Value as OperationResult<bool>;
            operationResult!.State.Should().Be(OperationState.PendingQR);
            operationResult.IsSuccess.Should().BeFalse();
        }

        [Fact]
        public async Task CheckWhatsApp_WithPendingNET_ReturnsPendingNET()
        {
            // Arrange
            var phoneNumber = "+201557121962";
            var mockSession = new Mock<IBrowserSession>();
            var expectedResult = OperationResult<bool>.PendingNET("Internet connection unavailable", false);

            _mockSessionManager.Setup(x => x.GetOrCreateSessionAsync())
                .ReturnsAsync(mockSession.Object);
            _mockWhatsAppService.Setup(x => x.CheckWhatsAppNumberAsync(phoneNumber, mockSession.Object))
                .ReturnsAsync(expectedResult);
            mockSession.Setup(x => x.DisposeAsync())
                .Returns(ValueTask.CompletedTask);

            // Act
            var result = await _controller.CheckWhatsAppNumber(phoneNumber);

            // Assert
            result.Result.Should().BeOfType<OkObjectResult>();
            var okResult = result.Result as OkObjectResult;
            var operationResult = okResult!.Value as OperationResult<bool>;
            operationResult!.State.Should().Be(OperationState.PendingNET);
            operationResult.IsSuccess.Should().BeFalse();
        }

        [Fact]
        public async Task CheckWhatsApp_WithWaitingState_ReturnsWaiting()
        {
            // Arrange
            var phoneNumber = "+201557121962";
            var mockSession = new Mock<IBrowserSession>();
            var expectedResult = OperationResult<bool>.Waiting("Waiting for page load", false);

            _mockSessionManager.Setup(x => x.GetOrCreateSessionAsync())
                .ReturnsAsync(mockSession.Object);
            _mockWhatsAppService.Setup(x => x.CheckWhatsAppNumberAsync(phoneNumber, mockSession.Object))
                .ReturnsAsync(expectedResult);
            mockSession.Setup(x => x.DisposeAsync())
                .Returns(ValueTask.CompletedTask);

            // Act
            var result = await _controller.CheckWhatsAppNumber(phoneNumber);

            // Assert
            result.Result.Should().BeOfType<OkObjectResult>();
            var okResult = result.Result as OkObjectResult;
            var operationResult = okResult!.Value as OperationResult<bool>;
            operationResult!.State.Should().Be(OperationState.Waiting);
            operationResult.IsSuccess.Should().BeNull();
        }

        [Fact]
        public async Task CheckWhatsApp_WithTimeout_ReturnsFailure()
        {
            // Arrange
            var phoneNumber = "+201557121962";
            var mockSession = new Mock<IBrowserSession>();

            _mockSessionManager.Setup(x => x.GetOrCreateSessionAsync())
                .ReturnsAsync(mockSession.Object);
            _mockWhatsAppService.Setup(x => x.CheckWhatsAppNumberAsync(phoneNumber, mockSession.Object))
                .ThrowsAsync(new TimeoutException("Operation timed out"));
            mockSession.Setup(x => x.DisposeAsync())
                .Returns(ValueTask.CompletedTask);

            // Act
            var result = await _controller.CheckWhatsAppNumber(phoneNumber);

            // Assert
            result.Result.Should().BeOfType<OkObjectResult>();
            var okResult = result.Result as OkObjectResult;
            var operationResult = okResult!.Value as OperationResult<bool>;
            operationResult!.State.Should().Be(OperationState.Failure);
            operationResult.ResultMessage.Should().Contain("Timeout");
        }

        [Fact]
        public async Task CheckWhatsApp_WithException_ReturnsFailure()
        {
            // Arrange
            var phoneNumber = "+201557121962";
            var mockSession = new Mock<IBrowserSession>();

            _mockSessionManager.Setup(x => x.GetOrCreateSessionAsync())
                .ReturnsAsync(mockSession.Object);
            _mockWhatsAppService.Setup(x => x.CheckWhatsAppNumberAsync(phoneNumber, mockSession.Object))
                .ThrowsAsync(new Exception("Service error"));
            mockSession.Setup(x => x.DisposeAsync())
                .Returns(ValueTask.CompletedTask);

            // Act
            var result = await _controller.CheckWhatsAppNumber(phoneNumber);

            // Assert
            result.Result.Should().BeOfType<OkObjectResult>();
            var okResult = result.Result as OkObjectResult;
            var operationResult = okResult!.Value as OperationResult<bool>;
            operationResult!.State.Should().Be(OperationState.Failure);
            operationResult.ResultMessage.Should().Contain("Error checking WhatsApp number");
        }

        [Fact]
        public async Task CheckWhatsApp_WithNullResult_ReturnsFailure()
        {
            // Arrange
            var phoneNumber = "+201557121962";
            var mockSession = new Mock<IBrowserSession>();

            _mockSessionManager.Setup(x => x.GetOrCreateSessionAsync())
                .ReturnsAsync(mockSession.Object);
            _mockWhatsAppService.Setup(x => x.CheckWhatsAppNumberAsync(phoneNumber, mockSession.Object))
                .ReturnsAsync((OperationResult<bool>?)null!);
            mockSession.Setup(x => x.DisposeAsync())
                .Returns(ValueTask.CompletedTask);

            // Act
            var result = await _controller.CheckWhatsAppNumber(phoneNumber);

            // Assert
            result.Result.Should().BeOfType<OkObjectResult>();
            var okResult = result.Result as OkObjectResult;
            okResult!.Value.Should().BeNull();
            _mockNotifier.Verify(x => x.Notify(It.Is<string>(s => s.Contains("Unable to determine"))), Times.Once);
        }

        #endregion
    }
}

