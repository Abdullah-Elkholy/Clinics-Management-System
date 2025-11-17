using FluentAssertions;
using Moq;
using Xunit;
using Microsoft.Playwright;
using ClinicsManagementService.Services.Infrastructure;
using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.UnitTests.Common;

namespace ClinicsManagementService.UnitTests.Services.Infrastructure
{
    public class WhatsAppSessionManagerTests
    {
        private readonly Mock<INotifier> _mockNotifier;
        private readonly Mock<Func<IBrowserSession>> _mockBrowserSessionFactory;
        private readonly WhatsAppSessionManager _sessionManager;

        public WhatsAppSessionManagerTests()
        {
            _mockNotifier = new Mock<INotifier>();
            _mockBrowserSessionFactory = new Mock<Func<IBrowserSession>>();

            _sessionManager = new WhatsAppSessionManager(
                _mockNotifier.Object,
                _mockBrowserSessionFactory.Object);
        }

        #region GetOrCreateSessionAsync Tests

        [Fact]
        public async Task GetOrCreateSessionAsync_WhenNoSessionExists_CreatesNewSession()
        {
            // Arrange
            var mockSession = new Mock<IBrowserSession>();
            _mockBrowserSessionFactory.Setup(x => x())
                .Returns(mockSession.Object);

            mockSession.Setup(x => x.InitializeAsync())
                .Returns(Task.CompletedTask);

            mockSession.Setup(x => x.NavigateToAsync(It.IsAny<string>()))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _sessionManager.GetOrCreateSessionAsync();

            // Assert
            result.Should().NotBeNull();
            result.Should().Be(mockSession.Object);
            _mockBrowserSessionFactory.Verify(x => x(), Times.Once);
            mockSession.Verify(x => x.InitializeAsync(), Times.Once);
        }

        [Fact]
        public async Task GetOrCreateSessionAsync_WhenSessionExists_ReturnsExistingSession()
        {
            // Arrange
            var mockSession = new Mock<IBrowserSession>();
            _mockBrowserSessionFactory.Setup(x => x())
                .Returns(mockSession.Object);

            mockSession.Setup(x => x.InitializeAsync())
                .Returns(Task.CompletedTask);

            mockSession.Setup(x => x.NavigateToAsync(It.IsAny<string>()))
                .Returns(Task.CompletedTask);

            // Create session first time
            await _sessionManager.GetOrCreateSessionAsync();

            // Act - Get session second time
            var result = await _sessionManager.GetOrCreateSessionAsync();

            // Assert
            result.Should().NotBeNull();
            result.Should().Be(mockSession.Object);
            // Factory should only be called once
            _mockBrowserSessionFactory.Verify(x => x(), Times.Once);
        }

        [Fact]
        public async Task GetOrCreateSessionAsync_WhenInitializationFails_ThrowsException()
        {
            // Arrange
            var mockSession = new Mock<IBrowserSession>();
            _mockBrowserSessionFactory.Setup(x => x())
                .Returns(mockSession.Object);

            mockSession.Setup(x => x.InitializeAsync())
                .ThrowsAsync(new Exception("Initialization failed"));

            // Act & Assert
            await Assert.ThrowsAsync<Exception>(async () => await _sessionManager.GetOrCreateSessionAsync());
        }

        #endregion

        #region GetCurrentSessionAsync Tests

        [Fact]
        public async Task GetCurrentSessionAsync_WhenNoSession_ReturnsNull()
        {
            // Act
            var result = await _sessionManager.GetCurrentSessionAsync();

            // Assert
            result.Should().BeNull();
        }

        [Fact]
        public async Task GetCurrentSessionAsync_WhenSessionExists_ReturnsSession()
        {
            // Arrange
            var mockSession = new Mock<IBrowserSession>();
            _mockBrowserSessionFactory.Setup(x => x())
                .Returns(mockSession.Object);

            mockSession.Setup(x => x.InitializeAsync())
                .Returns(Task.CompletedTask);

            mockSession.Setup(x => x.NavigateToAsync(It.IsAny<string>()))
                .Returns(Task.CompletedTask);

            await _sessionManager.GetOrCreateSessionAsync();

            // Act
            var result = await _sessionManager.GetCurrentSessionAsync();

            // Assert
            result.Should().NotBeNull();
            result.Should().Be(mockSession.Object);
        }

        #endregion

        #region IsSessionReadyAsync Tests

        [Fact]
        public async Task IsSessionReadyAsync_WhenNoSession_ReturnsFalse()
        {
            // Act
            var result = await _sessionManager.IsSessionReadyAsync();

            // Assert
            result.Should().BeFalse();
        }

        [Fact]
        public async Task IsSessionReadyAsync_WhenSessionExistsAndReady_ReturnsTrue()
        {
            // Arrange
            var mockSession = new Mock<IBrowserSession>();
            var mockElement = new Mock<IElementHandle>();

            _mockBrowserSessionFactory.Setup(x => x())
                .Returns(mockSession.Object);

            mockSession.Setup(x => x.InitializeAsync())
                .Returns(Task.CompletedTask);

            mockSession.Setup(x => x.NavigateToAsync(It.IsAny<string>()))
                .Returns(Task.CompletedTask);

            mockSession.Setup(x => x.QuerySelectorAsync(It.IsAny<string>()))
                .Returns((string selector) => Task.FromResult<IElementHandle?>(mockElement.Object));

            await _sessionManager.GetOrCreateSessionAsync();

            // Act
            var result = await _sessionManager.IsSessionReadyAsync();

            // Assert
            result.Should().BeTrue();
        }

        [Fact]
        public async Task IsSessionReadyAsync_WhenSessionExistsButNotReady_ReturnsFalse()
        {
            // Arrange
            var mockSession = new Mock<IBrowserSession>();

            _mockBrowserSessionFactory.Setup(x => x())
                .Returns(mockSession.Object);

            mockSession.Setup(x => x.InitializeAsync())
                .Returns(Task.CompletedTask);

            mockSession.Setup(x => x.NavigateToAsync(It.IsAny<string>()))
                .Returns(Task.CompletedTask);

            mockSession.Setup(x => x.QuerySelectorAsync(It.IsAny<string>()))
                .ReturnsAsync((IElementHandle?)null);

            await _sessionManager.GetOrCreateSessionAsync();

            // Act
            var result = await _sessionManager.IsSessionReadyAsync();

            // Assert
            result.Should().BeFalse();
        }

        #endregion

        #region DisposeSessionAsync Tests

        [Fact]
        public async Task DisposeSessionAsync_WhenNoSession_DoesNothing()
        {
            // Act
            await _sessionManager.DisposeSessionAsync();

            // Assert - Should not throw
        }

        [Fact]
        public async Task DisposeSessionAsync_WhenSessionExists_DisposesSession()
        {
            // Arrange
            var mockSession = new Mock<IBrowserSession>();
            var mockAsyncDisposable = mockSession.As<IAsyncDisposable>();

            _mockBrowserSessionFactory.Setup(x => x())
                .Returns(mockSession.Object);

            mockSession.Setup(x => x.InitializeAsync())
                .Returns(Task.CompletedTask);

            mockSession.Setup(x => x.NavigateToAsync(It.IsAny<string>()))
                .Returns(Task.CompletedTask);

            await _sessionManager.GetOrCreateSessionAsync();

            // Act
            await _sessionManager.DisposeSessionAsync();

            // Assert
            mockAsyncDisposable.Verify(x => x.DisposeAsync(), Times.Once);
        }

        [Fact]
        public async Task DisposeSessionAsync_AfterDisposal_GetCurrentSessionReturnsNull()
        {
            // Arrange
            var mockSession = new Mock<IBrowserSession>();
            var mockAsyncDisposable = mockSession.As<IAsyncDisposable>();

            _mockBrowserSessionFactory.Setup(x => x())
                .Returns(mockSession.Object);

            mockSession.Setup(x => x.InitializeAsync())
                .Returns(Task.CompletedTask);

            mockSession.Setup(x => x.NavigateToAsync(It.IsAny<string>()))
                .Returns(Task.CompletedTask);

            await _sessionManager.GetOrCreateSessionAsync();
            await _sessionManager.DisposeSessionAsync();

            // Act
            var result = await _sessionManager.GetCurrentSessionAsync();

            // Assert
            result.Should().BeNull();
        }

        #endregion
    }
}

