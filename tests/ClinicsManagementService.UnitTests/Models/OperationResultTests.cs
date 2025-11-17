using FluentAssertions;
using Xunit;
using ClinicsManagementService.Models;

namespace ClinicsManagementService.UnitTests.Models
{
    public class OperationResultTests
    {
        #region OperationResult Creation Tests

        [Fact]
        public void CreateSuccess_ReturnsSuccessResult()
        {
            // Act
            var result = OperationResult.CreateSuccess("Success message");

            // Assert
            result.IsSuccess.Should().BeTrue();
            result.State.Should().Be(OperationState.Success);
            result.ResultMessage.Should().Be("Success message");
        }

        [Fact]
        public void CreateFailure_ReturnsFailureResult()
        {
            // Act
            var result = OperationResult.CreateFailure("Error message");

            // Assert
            result.IsSuccess.Should().BeFalse();
            result.State.Should().Be(OperationState.Failure);
            result.ResultMessage.Should().Be("Error message");
        }

        [Fact]
        public void CreatePendingQR_ReturnsPendingQRResult()
        {
            // Act
            var result = OperationResult.CreatePendingQR("QR required");

            // Assert
            result.IsSuccess.Should().BeFalse();
            result.State.Should().Be(OperationState.PendingQR);
            result.ResultMessage.Should().Be("QR required");
        }

        [Fact]
        public void CreatePendingNET_ReturnsPendingNETResult()
        {
            // Act
            var result = OperationResult.CreatePendingNET("Network unavailable");

            // Assert
            result.IsSuccess.Should().BeFalse();
            result.State.Should().Be(OperationState.PendingNET);
            result.ResultMessage.Should().Be("Network unavailable");
        }

        [Fact]
        public void CreateWaiting_ReturnsWaitingResult()
        {
            // Act
            var result = OperationResult.CreateWaiting("Waiting...");

            // Assert
            result.IsSuccess.Should().BeNull();
            result.State.Should().Be(OperationState.Waiting);
            result.ResultMessage.Should().Be("Waiting...");
        }

        #endregion

        #region OperationResult<T> Creation Tests

        [Fact]
        public void Success_WithData_ReturnsSuccessResult()
        {
            // Act
            var result = OperationResult<bool>.Success(true);

            // Assert
            result.IsSuccess.Should().BeTrue();
            result.Data.Should().BeTrue();
            result.State.Should().Be(OperationState.Success);
        }

        [Fact]
        public void Failure_WithData_ReturnsFailureResult()
        {
            // Act
            var result = OperationResult<bool>.Failure("Error", false);

            // Assert
            result.IsSuccess.Should().BeFalse();
            result.Data.Should().BeFalse();
            result.State.Should().Be(OperationState.Failure);
            result.ResultMessage.Should().Be("Error");
        }

        [Fact]
        public void PendingQR_WithData_ReturnsPendingQRResult()
        {
            // Act
            var result = OperationResult<bool>.PendingQR("QR required", false);

            // Assert
            result.IsSuccess.Should().BeFalse();
            result.Data.Should().BeFalse();
            result.State.Should().Be(OperationState.PendingQR);
            result.ResultMessage.Should().Be("QR required");
        }

        [Fact]
        public void PendingNET_WithData_ReturnsPendingNETResult()
        {
            // Act
            var result = OperationResult<bool>.PendingNET("Network unavailable", false);

            // Assert
            result.IsSuccess.Should().BeFalse();
            result.Data.Should().BeFalse();
            result.State.Should().Be(OperationState.PendingNET);
            result.ResultMessage.Should().Be("Network unavailable");
        }

        [Fact]
        public void Waiting_WithData_ReturnsWaitingResult()
        {
            // Act
            var result = OperationResult<bool>.Waiting("Waiting...", false);

            // Assert
            result.IsSuccess.Should().BeNull();
            result.Data.Should().BeFalse();
            result.State.Should().Be(OperationState.Waiting);
            result.ResultMessage.Should().Be("Waiting...");
        }

        #endregion

        #region Extension Methods Tests

        [Fact]
        public void IsWaiting_WithWaitingState_ReturnsTrue()
        {
            // Arrange
            var result = OperationResult<bool>.Waiting("Waiting...");

            // Act & Assert
            result.IsWaiting().Should().BeTrue();
        }

        [Fact]
        public void IsWaiting_WithNonWaitingState_ReturnsFalse()
        {
            // Arrange
            var result = OperationResult<bool>.Success(true);

            // Act & Assert
            result.IsWaiting().Should().BeFalse();
        }

        [Fact]
        public void IsPendingQr_WithPendingQRState_ReturnsTrue()
        {
            // Arrange
            var result = OperationResult<bool>.PendingQR("QR required");

            // Act & Assert
            result.IsPendingQr().Should().BeTrue();
        }

        [Fact]
        public void IsPendingQr_WithNonPendingQRState_ReturnsFalse()
        {
            // Arrange
            var result = OperationResult<bool>.Success(true);

            // Act & Assert
            result.IsPendingQr().Should().BeFalse();
        }

        [Fact]
        public void IsPendingNet_WithPendingNETState_ReturnsTrue()
        {
            // Arrange
            var result = OperationResult<bool>.PendingNET("Network unavailable");

            // Act & Assert
            result.IsPendingNet().Should().BeTrue();
        }

        [Fact]
        public void IsPendingNet_WithNonPendingNETState_ReturnsFalse()
        {
            // Arrange
            var result = OperationResult<bool>.Success(true);

            // Act & Assert
            result.IsPendingNet().Should().BeFalse();
        }

        [Fact]
        public void Normalize_WithNullResult_ReturnsFailure()
        {
            // Arrange
            OperationResult<bool>? result = null;

            // Act
            var normalized = result.Normalize("Default error");

            // Assert
            normalized.IsSuccess.Should().BeFalse();
            normalized.ResultMessage.Should().Be("Default error");
        }

        [Fact]
        public void Normalize_WithSuccessResult_ReturnsSuccess()
        {
            // Arrange
            var result = OperationResult<bool>.Success(true);

            // Act
            var normalized = result.Normalize();

            // Assert
            normalized.IsSuccess.Should().BeTrue();
            normalized.Data.Should().BeTrue();
        }

        [Fact]
        public void Normalize_WithWaitingResult_ReturnsWaiting()
        {
            // Arrange
            var result = OperationResult<bool>.Waiting("Waiting...", false);

            // Act
            var normalized = result.Normalize();

            // Assert
            normalized.IsWaiting().Should().BeTrue();
            normalized.Data.Should().BeFalse();
        }

        [Fact]
        public void Normalize_WithPendingQRResult_ReturnsPendingQR()
        {
            // Arrange
            var result = OperationResult<bool>.PendingQR("QR required", false);

            // Act
            var normalized = result.Normalize();

            // Assert
            normalized.IsPendingQr().Should().BeTrue();
            normalized.Data.Should().BeFalse();
        }

        [Fact]
        public void Normalize_WithPendingNETResult_ReturnsPendingNET()
        {
            // Arrange
            var result = OperationResult<bool>.PendingNET("Network unavailable", false);

            // Act
            var normalized = result.Normalize();

            // Assert
            normalized.IsPendingNet().Should().BeTrue();
            normalized.Data.Should().BeFalse();
        }

        #endregion
    }
}

