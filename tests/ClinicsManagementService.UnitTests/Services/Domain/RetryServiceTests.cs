using FluentAssertions;
using Moq;
using Xunit;
using ClinicsManagementService.Services.Domain;
using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.Models;
using Microsoft.Playwright;

namespace ClinicsManagementService.UnitTests.Services.Domain
{
    public class RetryServiceTests
    {
        private readonly Mock<INotifier> _mockNotifier;
        private readonly RetryService _retryService;

        public RetryServiceTests()
        {
            _mockNotifier = new Mock<INotifier>();
            _retryService = new RetryService(_mockNotifier.Object);
        }

        #region IsBrowserClosedException Tests

        [Fact]
        public void IsBrowserClosedException_WithPlaywrightException_ReturnsTrue()
        {
            // Arrange
            var exception = new PlaywrightException("Target page, context or browser has been closed");

            // Act
            var result = _retryService.IsBrowserClosedException(exception);

            // Assert
            result.Should().BeTrue();
        }

        [Fact]
        public void IsBrowserClosedException_WithObjectDisposedException_ReturnsTrue()
        {
            // Arrange
            var exception = new ObjectDisposedException("object", "Target page, context or browser has been closed");

            // Act
            var result = _retryService.IsBrowserClosedException(exception);

            // Assert
            result.Should().BeTrue();
        }

        [Fact]
        public void IsBrowserClosedException_WithGenericException_ReturnsFalse()
        {
            // Arrange
            var exception = new Exception("Some other error");

            // Act
            var result = _retryService.IsBrowserClosedException(exception);

            // Assert
            result.Should().BeFalse();
        }

        [Fact]
        public void IsBrowserClosedException_WithPlaywrightExceptionWithoutMessage_ReturnsFalse()
        {
            // Arrange
            var exception = new PlaywrightException("Some other error");

            // Act
            var result = _retryService.IsBrowserClosedException(exception);

            // Assert
            result.Should().BeFalse();
        }

        #endregion

        #region ExecuteWithRetryAsync Tests

        [Fact]
        public async Task ExecuteWithRetryAsync_WithSuccessResult_ReturnsImmediately()
        {
            // Arrange
            var operation = new Mock<Func<Task<OperationResult<bool>>>>();
            operation.Setup(x => x()).ReturnsAsync(OperationResult<bool>.Success(true));

            // Act
            var result = await _retryService.ExecuteWithRetryAsync(operation.Object, maxAttempts: 3);

            // Assert
            result.IsSuccess.Should().BeTrue();
            result.Data.Should().BeTrue();
            operation.Verify(x => x(), Times.Once);
        }

        [Fact]
        public async Task ExecuteWithRetryAsync_WithWaitingResult_Retries()
        {
            // Arrange
            var attemptCount = 0;
            var operation = new Func<Task<OperationResult<bool>>>(() =>
            {
                attemptCount++;
                if (attemptCount < 2)
                    return Task.FromResult(OperationResult<bool>.Waiting("Waiting..."));
                return Task.FromResult(OperationResult<bool>.Success(true));
            });

            // Act
            var result = await _retryService.ExecuteWithRetryAsync(operation, maxAttempts: 3, shouldRetryResult: r => r.IsWaiting());

            // Assert
            result.IsSuccess.Should().BeTrue();
            attemptCount.Should().Be(2);
        }

        [Fact]
        public async Task ExecuteWithRetryAsync_WithMaxAttemptsReached_ReturnsLastResult()
        {
            // Arrange
            var attemptCount = 0;
            var operation = new Func<Task<OperationResult<bool>>>(() =>
            {
                attemptCount++;
                return Task.FromResult(OperationResult<bool>.Waiting("Waiting..."));
            });

            // Act
            var result = await _retryService.ExecuteWithRetryAsync(operation, maxAttempts: 3, shouldRetryResult: r => r.IsWaiting());

            // Assert
            result.IsWaiting().Should().BeTrue();
            attemptCount.Should().Be(3);
        }

        [Fact]
        public async Task ExecuteWithRetryAsync_WithException_RetriesIfRetryable()
        {
            // Arrange
            var attemptCount = 0;
            var operation = new Func<Task<OperationResult<bool>>>(() =>
            {
                attemptCount++;
                if (attemptCount < 2)
                    throw new Exception("net::ERR_NAME_NOT_RESOLVED");
                return Task.FromResult(OperationResult<bool>.Success(true));
            });

            // Act
            var result = await _retryService.ExecuteWithRetryAsync(
                operation, 
                maxAttempts: 3, 
                isRetryable: ex => ex.Message.Contains("net::ERR_NAME_NOT_RESOLVED"));

            // Assert
            result.IsSuccess.Should().BeTrue();
            attemptCount.Should().Be(2);
        }

        [Fact]
        public async Task ExecuteWithRetryAsync_WithNonRetryableException_Throws()
        {
            // Arrange
            var operation = new Func<Task<OperationResult<bool>>>(() =>
            {
                throw new InvalidOperationException("Non-retryable error");
            });

            // Act
            var act = async () => await _retryService.ExecuteWithRetryAsync(
                operation, 
                maxAttempts: 3, 
                isRetryable: ex => ex.Message.Contains("net::ERR"));

            // Assert
            await act.Should().ThrowAsync<InvalidOperationException>();
        }

        [Fact]
        public async Task ExecuteWithRetryAsync_WithExceptionAfterMaxAttempts_Throws()
        {
            // Arrange
            var attemptCount = 0;
            var operation = new Func<Task<OperationResult<bool>>>(() =>
            {
                attemptCount++;
                throw new Exception("net::ERR_NAME_NOT_RESOLVED");
            });

            // Act
            var act = async () => await _retryService.ExecuteWithRetryAsync(
                operation, 
                maxAttempts: 2, 
                isRetryable: ex => ex.Message.Contains("net::ERR_NAME_NOT_RESOLVED"));

            // Assert
            await act.Should().ThrowAsync<Exception>();
            attemptCount.Should().Be(2);
        }

        #endregion
    }
}

