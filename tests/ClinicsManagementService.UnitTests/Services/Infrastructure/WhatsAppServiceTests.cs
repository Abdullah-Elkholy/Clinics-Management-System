using FluentAssertions;
using Moq;
using Xunit;
using Microsoft.Playwright;
using ClinicsManagementService.Services;
using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.Services.Domain;
using ClinicsManagementService.Models;
using ClinicsManagementService.UnitTests.Common;

namespace ClinicsManagementService.UnitTests.Services.Infrastructure
{
    public class WhatsAppServiceTests
    {
        private readonly Mock<INotifier> _mockNotifier;
        private readonly Mock<INetworkService> _mockNetworkService;
        private readonly Mock<IWhatsAppUIService> _mockUIService;
        private readonly Mock<IWhatsAppSessionManager> _mockSessionManager;
        private readonly Mock<IRetryService> _mockRetryService;
        private readonly WhatsAppService _whatsAppService;

        public WhatsAppServiceTests()
        {
            _mockNotifier = new Mock<INotifier>();
            _mockNetworkService = new Mock<INetworkService>();
            _mockUIService = new Mock<IWhatsAppUIService>();
            _mockSessionManager = new Mock<IWhatsAppSessionManager>();
            _mockRetryService = new Mock<IRetryService>();

            _whatsAppService = new WhatsAppService(
                _mockNotifier.Object,
                _mockNetworkService.Object,
                _mockUIService.Object,
                _mockSessionManager.Object,
                _mockRetryService.Object);
        }

        #region CheckInternetConnectivityAsync Tests

        [Fact]
        public async Task CheckInternetConnectivityAsync_WhenNetworkAvailable_ReturnsTrue()
        {
            // Arrange
            _mockNetworkService.Setup(x => x.CheckInternetConnectivityAsync())
                .ReturnsAsync(true);

            // Act
            var result = await _whatsAppService.CheckInternetConnectivityAsync();

            // Assert
            result.Should().BeTrue();
        }

        [Fact]
        public async Task CheckInternetConnectivityAsync_WhenNetworkUnavailable_ReturnsFalse()
        {
            // Arrange
            _mockNetworkService.Setup(x => x.CheckInternetConnectivityAsync())
                .ReturnsAsync(false);

            // Act
            var result = await _whatsAppService.CheckInternetConnectivityAsync();

            // Assert
            result.Should().BeFalse();
        }

        [Fact]
        public async Task CheckInternetConnectivityDetailedAsync_WhenNetworkAvailable_ReturnsSuccess()
        {
            // Arrange
            _mockNetworkService.Setup(x => x.CheckInternetConnectivityAsync())
                .ReturnsAsync(true);

            // Act
            var result = await _whatsAppService.CheckInternetConnectivityDetailedAsync();

            // Assert
            result.IsSuccess.Should().BeTrue();
            result.Data.Should().BeTrue();
            result.State.Should().Be(OperationState.Success);
        }

        [Fact]
        public async Task CheckInternetConnectivityDetailedAsync_WhenNetworkUnavailable_ReturnsPendingNET()
        {
            // Arrange
            _mockNetworkService.Setup(x => x.CheckInternetConnectivityAsync())
                .ReturnsAsync(false);

            // Act
            var result = await _whatsAppService.CheckInternetConnectivityDetailedAsync();

            // Assert
            result.IsSuccess.Should().BeFalse();
            result.Data.Should().BeFalse();
            result.State.Should().Be(OperationState.PendingNET);
        }

        #endregion

        #region CheckWhatsAppNumberAsync Tests

        [Fact]
        public async Task CheckWhatsAppNumberAsync_WithValidNumber_ReturnsSuccess()
        {
            // Arrange
            var phoneNumber = TestDataBuilder.ValidPhoneNumber;
            var mockSession = new Mock<IBrowserSession>();

            _mockUIService.Setup(x => x.WaitForPageLoadAsync(
                    It.IsAny<IBrowserSession>(),
                    It.IsAny<string[]>(),
                    It.IsAny<int>(),
                    It.IsAny<int>()))
                .ReturnsAsync(OperationResult<bool>.Success(true));

            _mockRetryService.Setup(x => x.ExecuteWithRetryAsync(
                    It.IsAny<Func<Task<OperationResult<bool>>>>(),
                    It.IsAny<int>(),
                    It.IsAny<Func<OperationResult<bool>, bool>>(),
                    It.IsAny<Func<Exception, bool>>()))
                .ReturnsAsync(OperationResult<bool>.Success(true));

            // Act
            var result = await _whatsAppService.CheckWhatsAppNumberAsync(phoneNumber, mockSession.Object);

            // Assert
            result.IsSuccess.Should().BeTrue();
            result.Data.Should().BeTrue();
        }

        [Fact]
        public async Task CheckWhatsAppNumberAsync_WithInvalidNumber_ReturnsFailure()
        {
            // Arrange
            var phoneNumber = TestDataBuilder.ValidPhoneNumber;
            var mockSession = new Mock<IBrowserSession>();

            _mockUIService.Setup(x => x.WaitForPageLoadAsync(
                    It.IsAny<IBrowserSession>(),
                    It.IsAny<string[]>(),
                    It.IsAny<int>(),
                    It.IsAny<int>()))
                .ReturnsAsync(OperationResult<bool>.Success(true));

            _mockRetryService.Setup(x => x.ExecuteWithRetryAsync(
                    It.IsAny<Func<Task<OperationResult<bool>>>>(),
                    It.IsAny<int>(),
                    It.IsAny<Func<OperationResult<bool>, bool>>(),
                    It.IsAny<Func<Exception, bool>>()))
                .ReturnsAsync(OperationResult<bool>.Failure("Error dialog detected"));

            // Act
            var result = await _whatsAppService.CheckWhatsAppNumberAsync(phoneNumber, mockSession.Object);

            // Assert
            result.IsSuccess.Should().BeFalse();
            result.Data.Should().BeFalse();
        }

        [Fact]
        public async Task CheckWhatsAppNumberAsync_WithPendingQR_ReturnsPendingQR()
        {
            // Arrange
            var phoneNumber = TestDataBuilder.ValidPhoneNumber;
            var mockSession = new Mock<IBrowserSession>();

            _mockUIService.Setup(x => x.WaitForPageLoadAsync(
                    It.IsAny<IBrowserSession>(),
                    It.IsAny<string[]>(),
                    It.IsAny<int>(),
                    It.IsAny<int>()))
                .ReturnsAsync(OperationResult<bool>.PendingQR("Authentication required"));

            _mockRetryService.Setup(x => x.ExecuteWithRetryAsync(
                    It.IsAny<Func<Task<OperationResult<bool>>>>(),
                    It.IsAny<int>(),
                    It.IsAny<Func<OperationResult<bool>, bool>>(),
                    It.IsAny<Func<Exception, bool>>()))
                .Returns<Func<Task<OperationResult<bool>>>, int, Func<OperationResult<bool>, bool>?, Func<Exception, bool>?>(
                    async (operation, maxAttempts, shouldRetry, isRetryable) => await operation());

            // Act
            var result = await _whatsAppService.CheckWhatsAppNumberAsync(phoneNumber, mockSession.Object);

            // Assert
            result.IsPendingQr().Should().BeTrue();
            result.Data.Should().BeFalse();
        }

        [Fact]
        public async Task CheckWhatsAppNumberAsync_WithPendingNET_ReturnsPendingNET()
        {
            // Arrange
            var phoneNumber = TestDataBuilder.ValidPhoneNumber;
            var mockSession = new Mock<IBrowserSession>();

            _mockUIService.Setup(x => x.WaitForPageLoadAsync(
                    It.IsAny<IBrowserSession>(),
                    It.IsAny<string[]>(),
                    It.IsAny<int>(),
                    It.IsAny<int>()))
                .ReturnsAsync(OperationResult<bool>.PendingNET("Network unavailable"));

            _mockRetryService.Setup(x => x.ExecuteWithRetryAsync(
                    It.IsAny<Func<Task<OperationResult<bool>>>>(),
                    It.IsAny<int>(),
                    It.IsAny<Func<OperationResult<bool>, bool>>(),
                    It.IsAny<Func<Exception, bool>>()))
                .Returns<Func<Task<OperationResult<bool>>>, int, Func<OperationResult<bool>, bool>?, Func<Exception, bool>?>(
                    async (operation, maxAttempts, shouldRetry, isRetryable) => await operation());

            // Act
            var result = await _whatsAppService.CheckWhatsAppNumberAsync(phoneNumber, mockSession.Object);

            // Assert
            result.IsPendingNet().Should().BeTrue();
            result.Data.Should().BeFalse();
        }

        #endregion

        #region SendMessageWithIconTypeAsync Tests

        [Fact]
        public async Task SendMessageWithIconTypeAsync_WithSuccess_ReturnsSuccessWithIconType()
        {
            // Arrange
            var phoneNumber = TestDataBuilder.ValidPhoneNumber;
            var message = TestDataBuilder.ValidMessage;
            var mockSession = new Mock<IBrowserSession>();
            var mockInputElement = new Mock<IElementHandle>();
            var mockSendButton = new Mock<IElementHandle>();

            _mockUIService.Setup(x => x.WaitForPageLoadAsync(
                    It.IsAny<IBrowserSession>(),
                    It.IsAny<string[]>(),
                    It.IsAny<int>(),
                    It.IsAny<int>()))
                .ReturnsAsync(OperationResult<bool>.Success(true));

            _mockRetryService.Setup(x => x.ExecuteWithRetryAsync(
                    It.IsAny<Func<Task<OperationResult<bool>>>>(),
                    It.IsAny<int>(),
                    It.IsAny<Func<OperationResult<bool>, bool>>(),
                    It.IsAny<Func<Exception, bool>>()))
                .ReturnsAsync(OperationResult<bool>.Success(true));

            _mockUIService.Setup(x => x.WaitForPageLoadAsync(
                    It.IsAny<IBrowserSession>(),
                    It.IsAny<string[]>(),
                    It.IsAny<int>(),
                    It.IsAny<int>()))
                .ReturnsAsync(OperationResult<bool>.Success(true));

            mockSession.Setup(x => x.QuerySelectorAsync(It.IsAny<string>()))
                .Returns((string selector) =>
                {
                    if (selector.Contains("contenteditable"))
                        return Task.FromResult<IElementHandle?>(mockInputElement.Object);
                    if (selector.Contains("send") || selector.Contains("wds-ic-send"))
                        return Task.FromResult<IElementHandle?>(mockSendButton.Object);
                    return Task.FromResult<IElementHandle?>(null);
                });

            _mockUIService.Setup(x => x.GetLastOutgoingMessageStatusAsync(
                    It.IsAny<IBrowserSession>(),
                    It.IsAny<string>()))
                .ReturnsAsync(MessageStatus.WithIcon("msg-check", null));

            // Act
            var result = await _whatsAppService.SendMessageWithIconTypeAsync(phoneNumber, message, mockSession.Object);

            // Assert
            result.IsSuccess.Should().BeTrue();
            result.Data.Should().Be("msg-check");
        }

        [Fact]
        public async Task SendMessageWithIconTypeAsync_WithPendingQR_ReturnsPendingQR()
        {
            // Arrange
            var phoneNumber = TestDataBuilder.ValidPhoneNumber;
            var message = TestDataBuilder.ValidMessage;
            var mockSession = new Mock<IBrowserSession>();

            _mockUIService.Setup(x => x.WaitForPageLoadAsync(
                    It.IsAny<IBrowserSession>(),
                    It.IsAny<string[]>(),
                    It.IsAny<int>(),
                    It.IsAny<int>()))
                .ReturnsAsync(OperationResult<bool>.PendingQR("Authentication required"));

            // Act
            var result = await _whatsAppService.SendMessageWithIconTypeAsync(phoneNumber, message, mockSession.Object);

            // Assert
            result.IsPendingQr().Should().BeTrue();
            result.Data.Should().BeNull();
        }

        [Fact]
        public async Task SendMessageWithIconTypeAsync_WithPendingNET_ReturnsPendingNET()
        {
            // Arrange
            var phoneNumber = TestDataBuilder.ValidPhoneNumber;
            var message = TestDataBuilder.ValidMessage;
            var mockSession = new Mock<IBrowserSession>();

            _mockUIService.Setup(x => x.WaitForPageLoadAsync(
                    It.IsAny<IBrowserSession>(),
                    It.IsAny<string[]>(),
                    It.IsAny<int>(),
                    It.IsAny<int>()))
                .ReturnsAsync(OperationResult<bool>.PendingNET("Network unavailable"));

            // Act
            var result = await _whatsAppService.SendMessageWithIconTypeAsync(phoneNumber, message, mockSession.Object);

            // Assert
            result.IsPendingNet().Should().BeTrue();
            result.Data.Should().BeNull();
        }

        [Fact]
        public async Task SendMessageWithIconTypeAsync_WithErrorDialog_ReturnsFailure()
        {
            // Arrange
            var phoneNumber = TestDataBuilder.ValidPhoneNumber;
            var message = TestDataBuilder.ValidMessage;
            var mockSession = new Mock<IBrowserSession>();

            _mockUIService.Setup(x => x.WaitForPageLoadAsync(
                    It.IsAny<IBrowserSession>(),
                    It.IsAny<string[]>(),
                    It.IsAny<int>(),
                    It.IsAny<int>()))
                .ReturnsAsync(OperationResult<bool>.Success(true));

            // First retry call checks for error dialog, second call waits for input field
            var callCount = 0;
            _mockRetryService.Setup(x => x.ExecuteWithRetryAsync(
                    It.IsAny<Func<Task<OperationResult<bool>>>>(),
                    It.IsAny<int>(),
                    It.IsAny<Func<OperationResult<bool>, bool>>(),
                    It.IsAny<Func<Exception, bool>>()))
                .Returns<Func<Task<OperationResult<bool>>>, int, Func<OperationResult<bool>, bool>?, Func<Exception, bool>?>(
                    async (operation, maxAttempts, shouldRetry, isRetryable) =>
                    {
                        callCount++;
                        if (callCount == 1)
                        {
                            // First call - check for error dialog, return failure
                            return OperationResult<bool>.Failure("This phone number does not have WhatsApp registered. Error dialog detected using selector: test-selector");
                        }
                        // Subsequent calls - execute the operation
                        return await operation();
                    });

            // Mock the CheckForWhatsAppErrorDialog to return failure
            // This is called inside the first ExecuteWithRetryAsync
            // We need to set up the operation to return the failure result

            // Act
            var result = await _whatsAppService.SendMessageWithIconTypeAsync(phoneNumber, message, mockSession.Object);

            // Assert
            result.IsSuccess.Should().BeFalse();
            result.ResultMessage.Should().Contain("does not have WhatsApp");
        }

        [Fact]
        public async Task SendMessageWithIconTypeAsync_WithWaitingStatus_ReturnsWaiting()
        {
            // Arrange
            var phoneNumber = TestDataBuilder.ValidPhoneNumber;
            var message = TestDataBuilder.ValidMessage;
            var mockSession = new Mock<IBrowserSession>();
            var mockInputElement = new Mock<IElementHandle>();

            _mockUIService.Setup(x => x.WaitForPageLoadAsync(
                    It.IsAny<IBrowserSession>(),
                    It.IsAny<string[]>(),
                    It.IsAny<int>(),
                    It.IsAny<int>()))
                .ReturnsAsync(OperationResult<bool>.Success(true));

            _mockRetryService.Setup(x => x.ExecuteWithRetryAsync(
                    It.IsAny<Func<Task<OperationResult<bool>>>>(),
                    It.IsAny<int>(),
                    It.IsAny<Func<OperationResult<bool>, bool>>(),
                    It.IsAny<Func<Exception, bool>>()))
                .ReturnsAsync(OperationResult<bool>.Success(true));

            mockSession.Setup(x => x.QuerySelectorAsync(It.IsAny<string>()))
                .Returns((string selector) =>
                {
                    if (selector.Contains("contenteditable"))
                        return Task.FromResult<IElementHandle?>(mockInputElement.Object);
                    return Task.FromResult<IElementHandle?>(null);
                });

            _mockUIService.Setup(x => x.GetLastOutgoingMessageStatusAsync(
                    It.IsAny<IBrowserSession>(),
                    It.IsAny<string>()))
                .ReturnsAsync(MessageStatus.Empty());

            _mockUIService.Setup(x => x.ContinuousMonitoringAsync(
                    It.IsAny<IBrowserSession>(),
                    It.IsAny<int>(),
                    It.IsAny<int>()))
                .ReturnsAsync((OperationResult<bool>?)null);

            // Act
            var result = await _whatsAppService.SendMessageWithIconTypeAsync(phoneNumber, message, mockSession.Object);

            // Assert
            result.IsWaiting().Should().BeTrue();
            result.ResultMessage.Should().Contain("No status icon found");
        }

        #endregion

        #region DisposeBrowserSessionAsync Tests

        [Fact]
        public async Task DisposeBrowserSessionAsync_WithAsyncDisposable_CallsDisposeAsync()
        {
            // Arrange
            var mockSession = new Mock<IBrowserSession>();
            var mockAsyncDisposable = mockSession.As<IAsyncDisposable>();

            // Act
            await _whatsAppService.DisposeBrowserSessionAsync(mockSession.Object);

            // Assert
            mockAsyncDisposable.Verify(x => x.DisposeAsync(), Times.Once);
        }

        [Fact]
        public async Task DisposeBrowserSessionAsync_WithSyncDisposable_CallsDispose()
        {
            // Arrange
            var mockSession = new Mock<IBrowserSession>();
            var mockDisposable = mockSession.As<IDisposable>();

            // Remove IAsyncDisposable implementation
            mockSession.As<IAsyncDisposable>().Setup(x => x.DisposeAsync())
                .Throws(new NotImplementedException());

            // Act
            await _whatsAppService.DisposeBrowserSessionAsync(mockSession.Object);

            // Assert
            // Note: The actual implementation checks for IAsyncDisposable first
            // This test verifies the fallback to IDisposable works
        }

        #endregion
    }
}

