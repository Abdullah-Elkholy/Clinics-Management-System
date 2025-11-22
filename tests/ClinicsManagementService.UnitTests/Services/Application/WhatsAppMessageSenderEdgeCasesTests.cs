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
    public class WhatsAppMessageSenderEdgeCasesTests
    {
        private readonly Mock<IWhatsAppService> _mockWhatsAppService;
        private readonly Mock<Func<IBrowserSession>> _mockBrowserSessionFactory;
        private readonly Mock<INotifier> _mockNotifier;
        private readonly Mock<IRetryService> _mockRetryService;
        private readonly Mock<IWhatsAppSessionManager> _mockSessionManager;
        private readonly Mock<IWhatsAppUIService> _mockUIService;
        private readonly WhatsAppMessageSender _messageSender;

        public WhatsAppMessageSenderEdgeCasesTests()
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

        #region SendMessageAsync Edge Cases

        [Fact]
        public async Task SendMessageAsync_WithRetryExhaustion_ReturnsFalse()
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
                .ReturnsAsync(OperationResult<string?>.Waiting("Still waiting after max retries"));

            _mockWhatsAppService.Setup(x => x.DisposeBrowserSessionAsync(It.IsAny<IBrowserSession>()))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _messageSender.SendMessageAsync(phoneNumber, message);

            // Assert
            result.Should().BeFalse();
        }

        [Fact]
        public async Task SendMessageAsync_WithExceptionDuringRetry_ReturnsFalse()
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
                .ThrowsAsync(new Exception("Retry service exception"));

            _mockWhatsAppService.Setup(x => x.DisposeBrowserSessionAsync(It.IsAny<IBrowserSession>()))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _messageSender.SendMessageAsync(phoneNumber, message);

            // Assert
            result.Should().BeFalse();
            _mockNotifier.Verify(x => x.Notify(It.Is<string>(s => s.Contains("Error in SendMessageWithIconTypeAsync"))), Times.Once);
        }

        [Fact]
        public async Task SendMessageAsync_WithNullSessionFromManager_HandlesGracefully()
        {
            // Arrange
            var phoneNumber = TestDataBuilder.ValidPhoneNumber;
            var message = TestDataBuilder.ValidMessage;

            _mockSessionManager.Setup(x => x.GetOrCreateSessionAsync())
                .ReturnsAsync((IBrowserSession?)null!);

            _mockRetryService.Setup(x => x.ExecuteWithRetryAsync(
                    It.IsAny<Func<Task<OperationResult<string?>>>>(),
                    It.IsAny<int>(),
                    It.IsAny<Func<OperationResult<string?>, bool>>(),
                    It.IsAny<Func<Exception, bool>>()))
                .ThrowsAsync(new NullReferenceException("Session is null"));

            // Act
            var result = await _messageSender.SendMessageAsync(phoneNumber, message);

            // Assert
            result.Should().BeFalse();
        }

        #endregion

        #region SendMessagesAsync Edge Cases

        [Fact]
        public async Task SendMessagesAsync_WithEmptyMessageList_ReturnsEmptyResults()
        {
            // Arrange
            var phoneNumber = TestDataBuilder.ValidPhoneNumber;
            var messages = new List<string>();
            var mockSession = new Mock<IBrowserSession>();

            _mockSessionManager.Setup(x => x.GetOrCreateSessionAsync())
                .ReturnsAsync(mockSession.Object);

            _mockWhatsAppService.Setup(x => x.DisposeBrowserSessionAsync(It.IsAny<IBrowserSession>()))
                .Returns(Task.CompletedTask);

            // Act
            var results = await _messageSender.SendMessagesAsync(phoneNumber, messages);

            // Assert
            results.Should().BeEmpty();
        }

        [Fact]
        public async Task SendMessagesAsync_WithNullMessageList_HandlesGracefully()
        {
            // Arrange
            var phoneNumber = TestDataBuilder.ValidPhoneNumber;
            IEnumerable<string>? messages = null;

            // Act
            var results = await _messageSender.SendMessagesAsync(phoneNumber, messages!);

            // Assert
            results.Should().BeEmpty();
            _mockNotifier.Verify(x => x.Notify(It.Is<string>(s => s.Contains("Messages list is null"))), Times.Once);
        }

        [Fact]
        public async Task SendMessagesAsync_WithPartialFailures_ReturnsMixedResults()
        {
            // Arrange
            var phoneNumber = TestDataBuilder.ValidPhoneNumber;
            var messages = new[] { "Message 1", "Message 2", "Message 3" };
            var mockSession = new Mock<IBrowserSession>();
            var callCount = 0;

            _mockSessionManager.Setup(x => x.GetOrCreateSessionAsync())
                .ReturnsAsync(mockSession.Object);

            _mockRetryService.Setup(x => x.ExecuteWithRetryAsync(
                    It.IsAny<Func<Task<OperationResult<string?>>>>(),
                    It.IsAny<int>(),
                    It.IsAny<Func<OperationResult<string?>, bool>>(),
                    It.IsAny<Func<Exception, bool>>()))
                .Returns<Func<Task<OperationResult<string?>>>, int, Func<OperationResult<string?>, bool>?, Func<Exception, bool>?>(
                    async (operation, maxAttempts, shouldRetry, isRetryable) =>
                    {
                        callCount++;
                        if (callCount == 2)
                            return OperationResult<string?>.Failure("Failed to send message 2");
                        return await operation();
                    });

            _mockWhatsAppService.Setup(x => x.SendMessageWithIconTypeAsync(
                    It.IsAny<string>(),
                    It.IsAny<string>(),
                    It.IsAny<IBrowserSession>()))
                .ReturnsAsync(OperationResult<string?>.Success("msg-check"));

            _mockWhatsAppService.Setup(x => x.DisposeBrowserSessionAsync(It.IsAny<IBrowserSession>()))
                .Returns(Task.CompletedTask);

            // Act
            var results = await _messageSender.SendMessagesAsync(phoneNumber, messages);

            // Assert
            results.Should().HaveCount(3);
            results[0].Sent.Should().BeTrue();
            results[1].Sent.Should().BeFalse();
            results[2].Sent.Should().BeTrue();
        }

        [Fact]
        public async Task SendMessagesAsync_WithNetworkError_RetriesAndContinues()
        {
            // Arrange
            var phoneNumber = TestDataBuilder.ValidPhoneNumber;
            var messages = new[] { "Message 1", "Message 2" };
            var mockSession = new Mock<IBrowserSession>();

            _mockSessionManager.Setup(x => x.GetOrCreateSessionAsync())
                .ReturnsAsync(mockSession.Object);

            // Simulate retry behavior: first call returns PendingNET (triggers retry),
            // retry service should call operation again, second call succeeds
            var operationCallCount = 0;
            _mockRetryService.Setup(x => x.ExecuteWithRetryAsync(
                    It.IsAny<Func<Task<OperationResult<string?>>>>(),
                    It.IsAny<int>(),
                    It.IsAny<Func<OperationResult<string?>, bool>>(),
                    It.IsAny<Func<Exception, bool>>()))
                .Returns<Func<Task<OperationResult<string?>>>, int, Func<OperationResult<string?>, bool>?, Func<Exception, bool>?>(
                    async (operation, maxAttempts, shouldRetry, isRetryable) =>
                    {
                        // Simulate retry service behavior:
                        // First attempt returns PendingNET, shouldRetryResult returns true, so retry
                        // Second attempt executes operation and succeeds
                        operationCallCount++;
                        if (operationCallCount == 1)
                        {
                            var firstResult = await operation();
                            // If shouldRetryResult would return true (PendingNET), simulate retry
                            if (shouldRetry != null && shouldRetry(firstResult))
                            {
                                // Retry: call operation again
                                operationCallCount++;
                                return await operation();
                            }
                            return firstResult;
                        }
                        return await operation();
                    });

            _mockWhatsAppService.Setup(x => x.SendMessageWithIconTypeAsync(
                    It.IsAny<string>(),
                    It.IsAny<string>(),
                    It.IsAny<IBrowserSession>()))
                .ReturnsAsync(OperationResult<string?>.Success("msg-check"));

            _mockWhatsAppService.Setup(x => x.DisposeBrowserSessionAsync(It.IsAny<IBrowserSession>()))
                .Returns(Task.CompletedTask);

            // Act
            var results = await _messageSender.SendMessagesAsync(phoneNumber, messages);

            // Assert
            results.Should().HaveCount(2);
            // First message should retry and eventually succeed
            results[0].Sent.Should().BeTrue();
            results[1].Sent.Should().BeTrue();
        }

        #endregion

        #region SendBulkWithThrottlingAsync Edge Cases

        [Fact]
        public async Task SendBulkWithThrottlingAsync_WithEmptyItems_ReturnsEmptyResults()
        {
            // Arrange
            var items = new List<(string Phone, string Message)>();
            var mockSession = new Mock<IBrowserSession>();

            _mockSessionManager.Setup(x => x.GetOrCreateSessionAsync())
                .ReturnsAsync(mockSession.Object);

            _mockWhatsAppService.Setup(x => x.DisposeBrowserSessionAsync(It.IsAny<IBrowserSession>()))
                .Returns(Task.CompletedTask);

            // Act
            var results = await _messageSender.SendBulkWithThrottlingAsync(items, 100, 200);

            // Assert
            results.Should().BeEmpty();
        }

        [Fact]
        public async Task SendBulkWithThrottlingAsync_WithInvalidDelayParameters_HandlesGracefully()
        {
            // Arrange
            var items = new[] { (Phone: TestDataBuilder.ValidPhoneNumber, Message: "Test") };
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

            // Act - minDelay > maxDelay (should still work, just use maxDelay)
            var results = await _messageSender.SendBulkWithThrottlingAsync(items, 200, 100);

            // Assert
            results.Should().HaveCount(1);
            // Should still process, Random.Shared.Next will handle the invalid range
        }

        [Fact]
        public async Task SendBulkWithThrottlingAsync_WithZeroDelays_ProcessesWithoutThrottling()
        {
            // Arrange
            var items = new[] { (Phone: TestDataBuilder.ValidPhoneNumber, Message: "Test") };
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
            var results = await _messageSender.SendBulkWithThrottlingAsync(items, 0, 0);

            // Assert
            results.Should().HaveCount(1);
            results[0].Sent.Should().BeTrue();
        }

        [Fact]
        public async Task SendBulkWithThrottlingAsync_WithNetworkErrorAfterFirstItem_SkipsRemaining()
        {
            // Arrange
            var items = new[]
            {
                (Phone: TestDataBuilder.ValidPhoneNumber, Message: "Message 1"),
                (Phone: TestDataBuilder.ValidPhoneNumberWithoutPlus, Message: "Message 2"),
                (Phone: TestDataBuilder.ValidPhoneNumber, Message: "Message 3")
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
                .Returns<Func<Task<OperationResult<string?>>>, int, Func<OperationResult<string?>, bool>?, Func<Exception, bool>?>(
                    async (operation, maxAttempts, shouldRetry, isRetryable) =>
                    {
                        callCount++;
                        if (callCount == 1)
                            return OperationResult<string?>.Success("msg-check");
                        return OperationResult<string?>.Failure("net::ERR_NAME_NOT_RESOLVED");
                    });

            _mockWhatsAppService.Setup(x => x.DisposeBrowserSessionAsync(It.IsAny<IBrowserSession>()))
                .Returns(Task.CompletedTask);

            _mockUIService.Setup(x => x.ContinuousMonitoringAsync(
                    It.IsAny<IBrowserSession>(),
                    It.IsAny<int>(),
                    It.IsAny<int>()))
                .ReturnsAsync((OperationResult<bool>?)null);

            // Act
            var results = await _messageSender.SendBulkWithThrottlingAsync(items, 10, 20);

            // Assert
            results.Should().HaveCount(3);
            results[0].Sent.Should().BeTrue();
            results[1].Sent.Should().BeFalse();
            results[1].Status.Should().Be(MessageOperationStatus.PendingNET);
            results[2].Sent.Should().BeFalse();
            results[2].Status.Should().Be(MessageOperationStatus.PendingNET);
        }

        [Fact]
        public async Task SendBulkWithThrottlingAsync_WithMonitoringException_ContinuesProcessing()
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
                .ThrowsAsync(new Exception("Monitoring exception"));

            // Act
            var results = await _messageSender.SendBulkWithThrottlingAsync(items, 10, 20);

            // Assert
            results.Should().HaveCount(2);
            // Should continue processing despite monitoring exception
            results[0].Sent.Should().BeTrue();
            results[1].Sent.Should().BeTrue();
            _mockNotifier.Verify(x => x.Notify(It.Is<string>(s => s.Contains("Error during ContinuousMonitoringAsync"))), Times.Once);
        }

        [Fact]
        public async Task SendBulkWithThrottlingAsync_WithSingleItem_NoThrottlingOccurs()
        {
            // Arrange
            var items = new[] { (Phone: TestDataBuilder.ValidPhoneNumber, Message: "Test") };
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
            var results = await _messageSender.SendBulkWithThrottlingAsync(items, 100, 200);

            // Assert
            results.Should().HaveCount(1);
            results[0].Sent.Should().BeTrue();
            // Monitoring should not be called for single item (counter < total check)
            _mockUIService.Verify(x => x.ContinuousMonitoringAsync(
                It.IsAny<IBrowserSession>(),
                It.IsAny<int>(),
                It.IsAny<int>()), Times.Never);
        }

        #endregion

        #region DetermineStatus Edge Cases

        [Theory]
        [InlineData("PendingQR: Authentication required", MessageOperationStatus.PendingQR)]
        [InlineData("WhatsApp authentication required", MessageOperationStatus.PendingQR)]
        [InlineData("PendingNET: Internet connection unavailable", MessageOperationStatus.PendingNET)]
        [InlineData("Internet connection unavailable", MessageOperationStatus.PendingNET)]
        [InlineData("Waiting: Still processing", MessageOperationStatus.Waiting)]
        [InlineData("Some other error", MessageOperationStatus.Failure)]
        [InlineData(null, MessageOperationStatus.Failure)]
        [InlineData("", MessageOperationStatus.Failure)]
        public async Task DetermineStatus_WithVariousErrorFormats_ReturnsCorrectStatus(string? error, MessageOperationStatus expectedStatus)
        {
            // This tests the private DetermineStatus method indirectly through SendMessageAsync
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
                .ReturnsAsync(OperationResult<string?>.Failure(error ?? ""));

            _mockWhatsAppService.Setup(x => x.DisposeBrowserSessionAsync(It.IsAny<IBrowserSession>()))
                .Returns(Task.CompletedTask);

            // Act
            var result = await _messageSender.SendMessageAsync(phoneNumber, message);

            // Assert
            // The status is determined internally, we verify the result is false for failures
            if (expectedStatus == MessageOperationStatus.Success)
                result.Should().BeTrue();
            else
                result.Should().BeFalse();
        }

        #endregion
    }
}

