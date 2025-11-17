using FluentAssertions;
using Moq;
using Xunit;
using Microsoft.Playwright;
using ClinicsManagementService.Services.Domain;
using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.Models;
using ClinicsManagementService.UnitTests.Common;

namespace ClinicsManagementService.UnitTests.Services.Domain
{
    public class WhatsAppUIServiceTests
    {
        private readonly Mock<INotifier> _mockNotifier;
        private readonly Mock<IScreenshotService> _mockScreenshotService;
        private readonly Mock<INetworkService> _mockNetworkService;
        private readonly WhatsAppUIService _uiService;

        public WhatsAppUIServiceTests()
        {
            _mockNotifier = new Mock<INotifier>();
            _mockScreenshotService = new Mock<IScreenshotService>();
            _mockNetworkService = new Mock<INetworkService>();

            _uiService = new WhatsAppUIService(
                _mockNotifier.Object,
                _mockScreenshotService.Object,
                _mockNetworkService.Object);
        }

        #region IsBrowserClosedException Tests

        [Fact]
        public void IsBrowserClosedException_WithTargetClosedMessage_ReturnsTrue()
        {
            // Arrange
            var exception = new PlaywrightException("Target page, context or browser has been closed");

            // Act
            var result = _uiService.IsBrowserClosedException(exception);

            // Assert
            result.Should().BeTrue();
        }

        [Fact]
        public void IsBrowserClosedException_WithBrowserDisconnectedMessage_ReturnsTrue()
        {
            // Arrange
            var exception = new PlaywrightException("Browser has been disconnected");

            // Act
            var result = _uiService.IsBrowserClosedException(exception);

            // Assert
            result.Should().BeTrue();
        }

        [Fact]
        public void IsBrowserClosedException_WithOtherException_ReturnsFalse()
        {
            // Arrange
            var exception = new PlaywrightException("Some other error");

            // Act
            var result = _uiService.IsBrowserClosedException(exception);

            // Assert
            result.Should().BeFalse();
        }

        [Fact]
        public void IsBrowserClosedException_WithNonPlaywrightException_ReturnsFalse()
        {
            // Arrange
            var exception = new Exception("Some error");

            // Act
            var result = _uiService.IsBrowserClosedException(exception);

            // Assert
            result.Should().BeFalse();
        }

        #endregion

        #region WaitForPageLoadAsync Tests

        [Fact]
        public async Task WaitForPageLoadAsync_WithNullBrowserSession_ReturnsFailure()
        {
            // Arrange
            IBrowserSession? browserSession = null;
            var selectors = new[] { "selector1", "selector2" };

            // Act
            var result = await _uiService.WaitForPageLoadAsync(browserSession!, selectors);

            // Assert
            result.Should().NotBeNull();
            result.IsSuccess.Should().BeFalse();
        }

        [Fact]
        public async Task WaitForPageLoadAsync_WithNetworkUnavailable_ReturnsPendingNET()
        {
            // Arrange
            var mockSession = new Mock<IBrowserSession>();
            var selectors = new[] { "selector1" };

            _mockNetworkService.Setup(x => x.CheckInternetConnectivityAsync())
                .ReturnsAsync(false);

            // Act
            var result = await _uiService.WaitForPageLoadAsync(mockSession.Object, selectors);

            // Assert
            result.Should().NotBeNull();
            result.IsPendingNet().Should().BeTrue();
        }

        [Fact]
        public async Task WaitForPageLoadAsync_WithNetworkAvailable_Continues()
        {
            // Arrange
            var mockSession = new Mock<IBrowserSession>();
            var selectors = new[] { "selector1" };
            var mockElement = new Mock<IElementHandle>();

            _mockNetworkService.Setup(x => x.CheckInternetConnectivityAsync())
                .ReturnsAsync(true);

            mockSession.Setup(x => x.QuerySelectorAsync(It.IsAny<string>()))
                .ReturnsAsync(mockElement.Object);

            // Act
            var result = await _uiService.WaitForPageLoadAsync(mockSession.Object, selectors, timeoutMs: 100, delayMs: 10);

            // Assert
            result.Should().NotBeNull();
            // Should return success if element is found
            if (result != null)
            {
                result.IsSuccess.Should().BeTrue();
            }
        }

        #endregion

        #region ContinuousMonitoringAsync Tests

        [Fact]
        public async Task ContinuousMonitoringAsync_WithNullBrowserSession_ReturnsNull()
        {
            // Arrange
            IBrowserSession? browserSession = null;

            // Act
            var result = await _uiService.ContinuousMonitoringAsync(browserSession!);

            // Assert
            result.Should().BeNull();
        }

        [Fact]
        public async Task ContinuousMonitoringAsync_WithNetworkUnavailable_ReturnsPendingNET()
        {
            // Arrange
            var mockSession = new Mock<IBrowserSession>();

            _mockNetworkService.Setup(x => x.CheckInternetConnectivityAsync())
                .ReturnsAsync(false);

            // Act
            var result = await _uiService.ContinuousMonitoringAsync(mockSession.Object, delayMs: 10, maxWaitMs: 50);

            // Assert
            result.Should().NotBeNull();
            result.IsPendingNet().Should().BeTrue();
        }

        #endregion

        #region GetLastOutgoingMessageStatusAsync Tests

        [Fact]
        public async Task GetLastOutgoingMessageStatusAsync_WithNullBrowserSession_ReturnsEmpty()
        {
            // Arrange
            IBrowserSession? browserSession = null;
            var phoneNumber = TestDataBuilder.ValidPhoneNumber;

            // Act
            var result = await _uiService.GetLastOutgoingMessageStatusAsync(browserSession!, phoneNumber);

            // Assert
            result.Should().NotBeNull();
            result.IconType.Should().BeNull();
        }

        [Fact]
        public async Task GetLastOutgoingMessageStatusAsync_WithValidSession_ReturnsStatus()
        {
            // Arrange
            var mockSession = new Mock<IBrowserSession>();
            var phoneNumber = TestDataBuilder.ValidPhoneNumber;
            var mockElement = new Mock<IElementHandle>();

            mockSession.Setup(x => x.QuerySelectorAsync(It.IsAny<string>()))
                .ReturnsAsync(mockElement.Object);

            mockElement.Setup(x => x.GetAttributeAsync(It.IsAny<string>()))
                .ReturnsAsync("msg-check");

            // Act
            var result = await _uiService.GetLastOutgoingMessageStatusAsync(mockSession.Object, phoneNumber);

            // Assert
            result.Should().NotBeNull();
            // Result depends on what's found in the DOM
        }

        #endregion
    }
}

