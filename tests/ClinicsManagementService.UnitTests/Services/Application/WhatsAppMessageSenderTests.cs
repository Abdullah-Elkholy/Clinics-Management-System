using FluentAssertions;
using Moq;
using Xunit;
using ClinicsManagementService.Services.Application;
using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.Services.Domain;
using ClinicsManagementService.Models;
using ClinicsManagementService.UnitTests.Common;

namespace ClinicsManagementService.UnitTests.Services.Application
{
    public class WhatsAppMessageSenderTests
    {
        private readonly Mock<IWhatsAppService> _mockWhatsAppService;
        private readonly Mock<Func<IBrowserSession>> _mockBrowserSessionFactory;
        private readonly Mock<INotifier> _mockNotifier;
        private readonly Mock<IRetryService> _mockRetryService;
        private readonly Mock<IWhatsAppSessionManager> _mockSessionManager;
        private readonly Mock<IWhatsAppUIService> _mockUIService;
        private readonly WhatsAppMessageSender _messageSender;

        public WhatsAppMessageSenderTests()
        {
            _mockWhatsAppService = new Mock<IWhatsAppService>();
            _mockBrowserSessionFactory = new Mock<Func<IBrowserSession>>();
            _mockNotifier = new Mock<INotifier>();
            _mockRetryService = new Mock<IRetryService>();
            _mockSessionManager = new Mock<IWhatsAppSessionManager>();
            _mockUIService = new Mock<IWhatsAppUIService>();

            _messageSender = new WhatsAppMessageSender(
                _mockWhatsAppService.Object,
                _mockBrowserSessionFactory.Object,
                _mockNotifier.Object,
                _mockRetryService.Object,
                _mockSessionManager.Object,
                _mockUIService.Object);
        }

        [Fact]
        public async Task SendMessageAsync_WithSuccessResult_ReturnsTrue()
        {
            // Arrange
            var phoneNumber = TestDataBuilder.ValidPhoneNumber;
            var message = TestDataBuilder.ValidMessage;
            var mockSession = new Mock<IBrowserSession>();

            _mockSessionManager.Setup(x => x.GetOrCreateSessionAsync())
                .ReturnsAsync(mockSession.Object);

            _mockRetryService.Setup(x => x.ExecuteWithRetryAsync(
                    It.IsAny<Func<Task<OperationResult<string?>>>>(),
                    It.IsAny<int>(),
                    It.IsAny<Func<OperationResult<string?>, bool>>(),
                    It.IsAny<Func<Exception, bool>>()))
                .ReturnsAsync(OperationResult<string?>.Success("msg-check"));

            _mockWhatsAppService.Setup(x => x.DisposeBrowserSessionAsync(It.IsAny<IBrowserSession>()))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _messageSender.SendMessageAsync(phoneNumber, message);

            // Assert
            result.Should().BeTrue();
            _mockRetryService.Verify(x => x.ExecuteWithRetryAsync(
                It.IsAny<Func<Task<OperationResult<string?>>>>(),
                It.IsAny<int>(),
                It.IsAny<Func<OperationResult<string?>, bool>>(),
                It.IsAny<Func<Exception, bool>>()), Times.Once);
        }

        [Fact]
        public async Task SendMessageAsync_WithFailureResult_ReturnsFalse()
        {
            // Arrange
            var phoneNumber = TestDataBuilder.ValidPhoneNumber;
            var message = TestDataBuilder.ValidMessage;
            var mockSession = new Mock<IBrowserSession>();

            _mockSessionManager.Setup(x => x.GetOrCreateSessionAsync())
                .ReturnsAsync(mockSession.Object);

            _mockRetryService.Setup(x => x.ExecuteWithRetryAsync(
                    It.IsAny<Func<Task<OperationResult<string?>>>>(),
                    It.IsAny<int>(),
                    It.IsAny<Func<OperationResult<string?>, bool>>(),
                    It.IsAny<Func<Exception, bool>>()))
                .ReturnsAsync(OperationResult<string?>.Failure("Failed to send"));

            _mockWhatsAppService.Setup(x => x.DisposeBrowserSessionAsync(It.IsAny<IBrowserSession>()))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _messageSender.SendMessageAsync(phoneNumber, message);

            // Assert
            result.Should().BeFalse();
        }

        [Fact]
        public async Task SendMessageAsync_WithPendingQR_ReturnsFalse()
        {
            // Arrange
            var phoneNumber = TestDataBuilder.ValidPhoneNumber;
            var message = TestDataBuilder.ValidMessage;
            var mockSession = new Mock<IBrowserSession>();

            _mockSessionManager.Setup(x => x.GetOrCreateSessionAsync())
                .ReturnsAsync(mockSession.Object);

            _mockRetryService.Setup(x => x.ExecuteWithRetryAsync(
                    It.IsAny<Func<Task<OperationResult<string?>>>>(),
                    It.IsAny<int>(),
                    It.IsAny<Func<OperationResult<string?>, bool>>(),
                    It.IsAny<Func<Exception, bool>>()))
                .ReturnsAsync(OperationResult<string?>.PendingQR("Authentication required"));

            _mockWhatsAppService.Setup(x => x.DisposeBrowserSessionAsync(It.IsAny<IBrowserSession>()))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _messageSender.SendMessageAsync(phoneNumber, message);

            // Assert
            result.Should().BeFalse();
        }

        [Fact]
        public async Task SendMessageAsync_WithPendingNET_ReturnsFalse()
        {
            // Arrange
            var phoneNumber = TestDataBuilder.ValidPhoneNumber;
            var message = TestDataBuilder.ValidMessage;
            var mockSession = new Mock<IBrowserSession>();

            _mockSessionManager.Setup(x => x.GetOrCreateSessionAsync())
                .ReturnsAsync(mockSession.Object);

            _mockRetryService.Setup(x => x.ExecuteWithRetryAsync(
                    It.IsAny<Func<Task<OperationResult<string?>>>>(),
                    It.IsAny<int>(),
                    It.IsAny<Func<OperationResult<string?>, bool>>(),
                    It.IsAny<Func<Exception, bool>>()))
                .ReturnsAsync(OperationResult<string?>.PendingNET("Network unavailable"));

            _mockWhatsAppService.Setup(x => x.DisposeBrowserSessionAsync(It.IsAny<IBrowserSession>()))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _messageSender.SendMessageAsync(phoneNumber, message);

            // Assert
            result.Should().BeFalse();
        }

        [Fact]
        public async Task SendMessageAsync_WithWaitingResult_Retries()
        {
            // Arrange
            var phoneNumber = TestDataBuilder.ValidPhoneNumber;
            var message = TestDataBuilder.ValidMessage;
            var mockSession = new Mock<IBrowserSession>();
            var attemptCount = 0;

            _mockSessionManager.Setup(x => x.GetOrCreateSessionAsync())
                .ReturnsAsync(mockSession.Object);

            _mockRetryService.Setup(x => x.ExecuteWithRetryAsync(
                    It.IsAny<Func<Task<OperationResult<string?>>>>(),
                    It.IsAny<int>(),
                    It.IsAny<Func<OperationResult<string?>, bool>>(),
                    It.IsAny<Func<Exception, bool>>()))
                .Callback<Func<Task<OperationResult<string?>>>, int, Func<OperationResult<string?>, bool>?, Func<Exception, bool>?>(
                    (op, max, shouldRetry, isRetryable) => attemptCount++)
                .ReturnsAsync(OperationResult<string?>.Waiting("Waiting..."));

            _mockWhatsAppService.Setup(x => x.DisposeBrowserSessionAsync(It.IsAny<IBrowserSession>()))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _messageSender.SendMessageAsync(phoneNumber, message);

            // Assert
            result.Should().BeFalse();
            // Note: Retry logic is handled by RetryService, so we verify it was called
            _mockRetryService.Verify(x => x.ExecuteWithRetryAsync(
                It.IsAny<Func<Task<OperationResult<string?>>>>(),
                It.IsAny<int>(),
                It.IsAny<Func<OperationResult<string?>, bool>>(),
                It.IsAny<Func<Exception, bool>>()), Times.Once);
        }

        [Fact]
        public async Task SendMessageAsync_DisposesBrowserSession()
        {
            // Arrange
            var phoneNumber = TestDataBuilder.ValidPhoneNumber;
            var message = TestDataBuilder.ValidMessage;
            var mockSession = new Mock<IBrowserSession>();

            _mockSessionManager.Setup(x => x.GetOrCreateSessionAsync())
                .ReturnsAsync(mockSession.Object);

            _mockRetryService.Setup(x => x.ExecuteWithRetryAsync(
                    It.IsAny<Func<Task<OperationResult<string?>>>>(),
                    It.IsAny<int>(),
                    It.IsAny<Func<OperationResult<string?>, bool>>(),
                    It.IsAny<Func<Exception, bool>>()))
                .Returns<Func<Task<OperationResult<string?>>>, int, Func<OperationResult<string?>, bool>?, Func<Exception, bool>?>(
                    async (operation, maxAttempts, shouldRetry, isRetryable) => await operation());

            _mockWhatsAppService.Setup(x => x.SendMessageWithIconTypeAsync(
                    It.IsAny<string>(),
                    It.IsAny<string>(),
                    It.IsAny<IBrowserSession>()))
                .ReturnsAsync(OperationResult<string?>.Success("msg-check"));

            _mockWhatsAppService.Setup(x => x.DisposeBrowserSessionAsync(It.IsAny<IBrowserSession>()))
                .Returns(Task.CompletedTask);

            // Act
            await _messageSender.SendMessageAsync(phoneNumber, message);

            // Assert
            _mockWhatsAppService.Verify(x => x.DisposeBrowserSessionAsync(mockSession.Object), Times.Once);
        }

        [Fact]
        public async Task SendMessagesAsync_WithMultipleMessages_ReturnsAllResults()
        {
            // Arrange
            var phoneNumber = TestDataBuilder.ValidPhoneNumber;
            var messages = new[] { "Message 1", "Message 2", "Message 3" };
            var mockSession = new Mock<IBrowserSession>();

            _mockSessionManager.Setup(x => x.GetOrCreateSessionAsync())
                .ReturnsAsync(mockSession.Object);

            _mockRetryService.Setup(x => x.ExecuteWithRetryAsync(
                    It.IsAny<Func<Task<OperationResult<string?>>>>(),
                    It.IsAny<int>(),
                    It.IsAny<Func<OperationResult<string?>, bool>>(),
                    It.IsAny<Func<Exception, bool>>()))
                .ReturnsAsync(OperationResult<string?>.Success("msg-check"));

            _mockWhatsAppService.Setup(x => x.DisposeBrowserSessionAsync(It.IsAny<IBrowserSession>()))
                .Returns(Task.CompletedTask);

            // Act
            var results = await _messageSender.SendMessagesAsync(phoneNumber, messages);

            // Assert
            results.Should().HaveCount(3);
            results.All(r => r.Sent).Should().BeTrue();
            _mockRetryService.Verify(x => x.ExecuteWithRetryAsync(
                It.IsAny<Func<Task<OperationResult<string?>>>>(),
                It.IsAny<int>(),
                It.IsAny<Func<OperationResult<string?>, bool>>(),
                It.IsAny<Func<Exception, bool>>()), Times.Exactly(3));
        }

        [Fact]
        public async Task SendBulkWithThrottlingAsync_WithValidItems_ReturnsResults()
        {
            // Arrange
            var items = new[]
            {
                (Phone: TestDataBuilder.ValidPhoneNumber, Message: "Message 1"),
                (Phone: TestDataBuilder.ValidPhoneNumberWithoutPlus, Message: "Message 2")
            };
            var mockSession = new Mock<IBrowserSession>();

            _mockSessionManager.Setup(x => x.GetOrCreateSessionAsync())
                .ReturnsAsync(mockSession.Object);

            _mockRetryService.Setup(x => x.ExecuteWithRetryAsync(
                    It.IsAny<Func<Task<OperationResult<string?>>>>(),
                    It.IsAny<int>(),
                    It.IsAny<Func<OperationResult<string?>, bool>>(),
                    It.IsAny<Func<Exception, bool>>()))
                .ReturnsAsync(OperationResult<string?>.Success("msg-check"));

            _mockWhatsAppService.Setup(x => x.DisposeBrowserSessionAsync(It.IsAny<IBrowserSession>()))
                .Returns(Task.CompletedTask);

            _mockUIService.Setup(x => x.ContinuousMonitoringAsync(
                    It.IsAny<IBrowserSession>(),
                    It.IsAny<int>(),
                    It.IsAny<int>()))
                .ReturnsAsync((OperationResult<bool>?)null);

            // Act
            var results = await _messageSender.SendBulkWithThrottlingAsync(items, 100, 200);

            // Assert
            results.Should().HaveCount(2);
            results.All(r => r.Sent).Should().BeTrue();
        }

        [Fact]
        public async Task SendBulkWithThrottlingAsync_WithNetworkError_SkipsRemaining()
        {
            // Arrange
            var items = new[]
            {
                (Phone: TestDataBuilder.ValidPhoneNumber, Message: "Message 1"),
                (Phone: TestDataBuilder.ValidPhoneNumberWithoutPlus, Message: "Message 2")
            };
            var mockSession = new Mock<IBrowserSession>();
            var callCount = 0;

            _mockSessionManager.Setup(x => x.GetOrCreateSessionAsync())
                .ReturnsAsync(mockSession.Object);

            _mockRetryService.Setup(x => x.ExecuteWithRetryAsync(
                    It.IsAny<Func<Task<OperationResult<string?>>>>(),
                    It.IsAny<int>(),
                    It.IsAny<Func<OperationResult<string?>, bool>>(),
                    It.IsAny<Func<Exception, bool>>()))
                .Returns(() =>
                {
                    callCount++;
                    if (callCount == 1)
                        return Task.FromResult(OperationResult<string?>.Failure("net::ERR_NAME_NOT_RESOLVED"));
                    return Task.FromResult(OperationResult<string?>.Success("msg-check"));
                });

            _mockWhatsAppService.Setup(x => x.DisposeBrowserSessionAsync(It.IsAny<IBrowserSession>()))
                .Returns(Task.CompletedTask);

            _mockUIService.Setup(x => x.ContinuousMonitoringAsync(
                    It.IsAny<IBrowserSession>(),
                    It.IsAny<int>(),
                    It.IsAny<int>()))
                .ReturnsAsync((OperationResult<bool>?)null);

            // Act
            var results = await _messageSender.SendBulkWithThrottlingAsync(items, 100, 200);

            // Assert
            results.Should().HaveCount(2);
            results[0].Sent.Should().BeFalse();
            results[0].Error.Should().Contain("net::ERR");
            // Second item should be skipped due to network error
            results[1].Sent.Should().BeFalse();
            results[1].Error.Should().Contain("PendingNET");
        }

        [Fact]
        public async Task SendBulkWithThrottlingAsync_WithMonitoringInterruption_StopsEarly()
        {
            // Arrange
            var items = new[]
            {
                (Phone: TestDataBuilder.ValidPhoneNumber, Message: "Message 1"),
                (Phone: TestDataBuilder.ValidPhoneNumberWithoutPlus, Message: "Message 2")
            };
            var mockSession = new Mock<IBrowserSession>();

            _mockSessionManager.Setup(x => x.GetOrCreateSessionAsync())
                .ReturnsAsync(mockSession.Object);

            _mockRetryService.Setup(x => x.ExecuteWithRetryAsync(
                    It.IsAny<Func<Task<OperationResult<string?>>>>(),
                    It.IsAny<int>(),
                    It.IsAny<Func<OperationResult<string?>, bool>>(),
                    It.IsAny<Func<Exception, bool>>()))
                .ReturnsAsync(OperationResult<string?>.Success("msg-check"));

            _mockWhatsAppService.Setup(x => x.DisposeBrowserSessionAsync(It.IsAny<IBrowserSession>()))
                .Returns(Task.CompletedTask);

            // First monitoring returns null (no issue), second returns PendingQR (interruption)
            // Note: Monitoring happens during throttling AFTER each item is sent
            // So first item is sent, then monitoring during throttling returns PendingQR
            // This should mark remaining items (second item) as failed
            _mockUIService.SetupSequence(x => x.ContinuousMonitoringAsync(
                    It.IsAny<IBrowserSession>(),
                    It.IsAny<int>(),
                    It.IsAny<int>()))
                .ReturnsAsync(OperationResult<bool>.PendingQR("Authentication required"));

            // Act
            var results = await _messageSender.SendBulkWithThrottlingAsync(items, 100, 200);

            // Assert
            results.Should().HaveCount(2);
            results[0].Sent.Should().BeTrue();
            // Second item should be marked as failed due to monitoring interruption during throttling after first item
            results[1].Sent.Should().BeFalse();
            results[1].Status.Should().Be(MessageOperationStatus.PendingQR);
        }
    }
}

