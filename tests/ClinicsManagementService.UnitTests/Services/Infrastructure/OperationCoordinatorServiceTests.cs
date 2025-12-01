using ClinicsManagementService.Data;
using ClinicsManagementService.Models;
using ClinicsManagementService.Services.Infrastructure;
using ClinicsManagementService.Services.Interfaces;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Moq;
using Xunit;

namespace ClinicsManagementService.UnitTests.Services.Infrastructure
{
    /// <summary>
    /// Unit tests for OperationCoordinatorService - verifies 3-tier pause/resume hierarchy
    /// Tests the implementation from PERFORMANCE_RESEARCH_AND_CDC_ANALYSIS.md Section 15
    /// </summary>
    public class OperationCoordinatorServiceTests : IDisposable
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly Mock<INotifier> _mockNotifier;
        private readonly OperationCoordinatorService _service;

        public OperationCoordinatorServiceTests()
        {
            // Setup in-memory database for testing
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            _dbContext = new ApplicationDbContext(options);
            _mockNotifier = new Mock<INotifier>();
            _service = new OperationCoordinatorService(_dbContext, _mockNotifier.Object);
        }

        public void Dispose()
        {
            _dbContext?.Dispose();
        }

        #region PauseAllOngoingTasksAsync Tests

        [Fact]
        public async Task PauseAllOngoingTasksAsync_ShouldSetGlobalPauseFlag()
        {
            // Arrange
            int moderatorId = 1;
            int userId = 10;
            string reason = "Test pause";

            // Create WhatsAppSession
            var session = new WhatsAppSession
            {
                ModeratorUserId = moderatorId,
                Status = "connected",
                IsPaused = false,
                PauseReason = null,
                CreatedAt = DateTime.UtcNow
            };
            _dbContext.WhatsAppSessions.Add(session);
            await _dbContext.SaveChangesAsync();

            // Act
            var result = await _service.PauseAllOngoingTasksAsync(moderatorId, userId, reason);

            // Assert
            result.Should().BeTrue();
            
            var updatedSession = await _dbContext.WhatsAppSessions
                .FirstOrDefaultAsync(s => s.ModeratorUserId == moderatorId);
            
            updatedSession.Should().NotBeNull();
            updatedSession!.IsPaused.Should().BeTrue();
            updatedSession.PauseReason.Should().Be(reason);
            updatedSession.LastPausedBy.Should().Be(userId);
            updatedSession.LastPausedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
        }

        [Fact]
        public async Task PauseAllOngoingTasksAsync_NoSession_ShouldReturnFalse()
        {
            // Arrange
            int nonExistentModeratorId = 999;
            int userId = 10;
            string reason = "Test pause";

            // Act
            var result = await _service.PauseAllOngoingTasksAsync(nonExistentModeratorId, userId, reason);

            // Assert
            result.Should().BeFalse();
        }

        [Fact]
        public async Task PauseAllOngoingTasksAsync_AlreadyPaused_ShouldUpdateReason()
        {
            // Arrange
            int moderatorId = 1;
            int userId = 10;
            string oldReason = "Old reason";
            string newReason = "New reason";

            var session = new WhatsAppSession
            {
                ModeratorUserId = moderatorId,
                Status = "connected",
                IsPaused = true,
                PauseReason = oldReason,
                LastPausedBy = 5,
                LastPausedAt = DateTime.UtcNow.AddMinutes(-10),
                CreatedAt = DateTime.UtcNow
            };
            _dbContext.WhatsAppSessions.Add(session);
            await _dbContext.SaveChangesAsync();

            // Act
            var result = await _service.PauseAllOngoingTasksAsync(moderatorId, userId, newReason);

            // Assert
            result.Should().BeTrue();
            
            var updatedSession = await _dbContext.WhatsAppSessions
                .FirstOrDefaultAsync(s => s.ModeratorUserId == moderatorId);
            
            updatedSession!.IsPaused.Should().BeTrue();
            updatedSession.PauseReason.Should().Be(newReason);
            updatedSession.LastPausedBy.Should().Be(userId);
        }

        #endregion

        #region ResumeTasksPausedForReasonAsync Tests

        [Fact]
        public async Task ResumeTasksPausedForReasonAsync_MatchingReason_ShouldClearPause()
        {
            // Arrange
            int moderatorId = 1;
            string reason = "Authentication check";

            var session = new WhatsAppSession
            {
                ModeratorUserId = moderatorId,
                Status = "connected",
                IsPaused = true,
                PauseReason = reason,
                LastPausedBy = 10,
                LastPausedAt = DateTime.UtcNow.AddMinutes(-1),
                CreatedAt = DateTime.UtcNow
            };
            _dbContext.WhatsAppSessions.Add(session);
            await _dbContext.SaveChangesAsync();

            // Act
            var result = await _service.ResumeTasksPausedForReasonAsync(moderatorId, reason);

            // Assert
            result.Should().BeTrue();
            
            var updatedSession = await _dbContext.WhatsAppSessions
                .FirstOrDefaultAsync(s => s.ModeratorUserId == moderatorId);
            
            updatedSession!.IsPaused.Should().BeFalse();
            updatedSession.PauseReason.Should().BeNull();
        }

        [Fact]
        public async Task ResumeTasksPausedForReasonAsync_DifferentReason_ShouldNotClearPause()
        {
            // Arrange
            int moderatorId = 1;
            string pauseReason = "PendingQR - Authentication required";
            string resumeReason = "Authentication check";

            var session = new WhatsAppSession
            {
                ModeratorUserId = moderatorId,
                Status = "connected",
                IsPaused = true,
                PauseReason = pauseReason,
                LastPausedBy = 10,
                LastPausedAt = DateTime.UtcNow.AddMinutes(-1),
                CreatedAt = DateTime.UtcNow
            };
            _dbContext.WhatsAppSessions.Add(session);
            await _dbContext.SaveChangesAsync();

            // Act
            var result = await _service.ResumeTasksPausedForReasonAsync(moderatorId, resumeReason);

            // Assert
            result.Should().BeFalse();
            
            var updatedSession = await _dbContext.WhatsAppSessions
                .FirstOrDefaultAsync(s => s.ModeratorUserId == moderatorId);
            
            // Should remain paused with original reason
            updatedSession!.IsPaused.Should().BeTrue();
            updatedSession.PauseReason.Should().Be(pauseReason);
        }

        [Fact]
        public async Task ResumeTasksPausedForReasonAsync_NotPaused_ShouldReturnFalse()
        {
            // Arrange
            int moderatorId = 1;
            string reason = "Authentication check";

            var session = new WhatsAppSession
            {
                ModeratorUserId = moderatorId,
                Status = "connected",
                IsPaused = false,
                PauseReason = null,
                CreatedAt = DateTime.UtcNow
            };
            _dbContext.WhatsAppSessions.Add(session);
            await _dbContext.SaveChangesAsync();

            // Act
            var result = await _service.ResumeTasksPausedForReasonAsync(moderatorId, reason);

            // Assert
            result.Should().BeFalse();
        }

        #endregion

        #region HasOngoingOperationsAsync Tests

        [Fact]
        public async Task HasOngoingOperationsAsync_WithSendingMessages_ReturnsTrue()
        {
            // Arrange
            int moderatorId = 1;

            var message = new Message
            {
                Id = Guid.NewGuid(),
                ModeratorId = moderatorId,
                PatientPhone = "1234567890",
                CountryCode = "+20",
                Content = "Test message",
                Status = "sending",
                Position = 1,
                CalculatedPosition = 1,
                FullName = "Test Patient",
                Channel = "whatsapp",
                Attempts = 0,
                CreatedAt = DateTime.UtcNow
            };
            _dbContext.Messages.Add(message);
            await _dbContext.SaveChangesAsync();

            // Act
            var result = await _service.HasOngoingOperationsAsync(moderatorId);

            // Assert
            result.Should().BeTrue();
        }

        [Fact]
        public async Task HasOngoingOperationsAsync_WithoutSendingMessages_ReturnsFalse()
        {
            // Arrange
            int moderatorId = 1;

            var message1 = new Message
            {
                Id = Guid.NewGuid(),
                ModeratorId = moderatorId,
                PatientPhone = "1234567890",
                CountryCode = "+20",
                Content = "Test message",
                Status = "sent",
                Position = 1,
                CalculatedPosition = 1,
                FullName = "Test Patient",
                Channel = "whatsapp",
                Attempts = 1,
                CreatedAt = DateTime.UtcNow,
                SentAt = DateTime.UtcNow
            };
            
            var message2 = new Message
            {
                Id = Guid.NewGuid(),
                ModeratorId = moderatorId,
                PatientPhone = "0987654321",
                CountryCode = "+20",
                Content = "Test message 2",
                Status = "queued",
                Position = 2,
                CalculatedPosition = 2,
                FullName = "Test Patient 2",
                Channel = "whatsapp",
                Attempts = 0,
                CreatedAt = DateTime.UtcNow
            };

            _dbContext.Messages.AddRange(message1, message2);
            await _dbContext.SaveChangesAsync();

            // Act
            var result = await _service.HasOngoingOperationsAsync(moderatorId);

            // Assert
            result.Should().BeFalse();
        }

        [Fact]
        public async Task HasOngoingOperationsAsync_NoMessages_ReturnsFalse()
        {
            // Arrange
            int moderatorId = 999;

            // Act
            var result = await _service.HasOngoingOperationsAsync(moderatorId);

            // Assert
            result.Should().BeFalse();
        }

        #endregion

        #region WaitForCurrentOperationToFinishAsync Tests

        [Fact]
        public async Task WaitForCurrentOperationToFinishAsync_NoOngoingOps_ReturnsImmediately()
        {
            // Arrange
            int moderatorId = 1;

            // Act
            var startTime = DateTime.UtcNow;
            var result = await _service.WaitForCurrentOperationToFinishAsync(moderatorId);
            var elapsed = DateTime.UtcNow - startTime;

            // Assert
            result.Should().BeTrue();
            elapsed.Should().BeLessThan(TimeSpan.FromSeconds(1)); // Should return quickly
        }

        [Fact]
        public async Task WaitForCurrentOperationToFinishAsync_WithTimeout_ReturnsFalse()
        {
            // Arrange
            int moderatorId = 1;

            // Create a message in "sending" state that won't complete
            var message = new Message
            {
                Id = Guid.NewGuid(),
                ModeratorId = moderatorId,
                PatientPhone = "1234567890",
                CountryCode = "+20",
                Content = "Test message",
                Status = "sending",
                Position = 1,
                CalculatedPosition = 1,
                FullName = "Test Patient",
                Channel = "whatsapp",
                Attempts = 0,
                CreatedAt = DateTime.UtcNow
            };
            _dbContext.Messages.Add(message);
            await _dbContext.SaveChangesAsync();

            // Act - Wait with very short timeout (1 second)
            var startTime = DateTime.UtcNow;
            var result = await _service.WaitForCurrentOperationToFinishAsync(
                moderatorId, 
                CancellationToken.None, 
                maxWaitMs: 1000, 
                checkIntervalMs: 200);
            var elapsed = DateTime.UtcNow - startTime;

            // Assert
            result.Should().BeFalse(); // Timeout should occur
            elapsed.Should().BeGreaterThan(TimeSpan.FromMilliseconds(900)); // Should wait for timeout
            elapsed.Should().BeLessThan(TimeSpan.FromSeconds(2)); // But not too long
        }

        #endregion

        #region 3-Tier Hierarchy Integration Tests

        [Fact]
        public async Task PauseResume_Hierarchy_ShouldWorkCorrectly()
        {
            // Arrange - Create complete hierarchy
            int moderatorId = 1;
            int userId = 10;

            var session = new WhatsAppSession
            {
                ModeratorUserId = moderatorId,
                Status = "connected",
                IsPaused = false,
                CreatedAt = DateTime.UtcNow
            };
            _dbContext.WhatsAppSessions.Add(session);
            await _dbContext.SaveChangesAsync();

            // Act 1: Pause with reason "Authentication check"
            var pauseResult1 = await _service.PauseAllOngoingTasksAsync(
                moderatorId, userId, "Authentication check");

            // Assert 1
            pauseResult1.Should().BeTrue();
            var pausedSession = await _dbContext.WhatsAppSessions
                .FirstOrDefaultAsync(s => s.ModeratorUserId == moderatorId);
            pausedSession!.IsPaused.Should().BeTrue();
            pausedSession.PauseReason.Should().Be("Authentication check");

            // Act 2: Try to resume with wrong reason
            var resumeResult1 = await _service.ResumeTasksPausedForReasonAsync(
                moderatorId, "Different reason");

            // Assert 2: Should NOT resume
            resumeResult1.Should().BeFalse();
            var stillPausedSession = await _dbContext.WhatsAppSessions
                .FirstOrDefaultAsync(s => s.ModeratorUserId == moderatorId);
            stillPausedSession!.IsPaused.Should().BeTrue();

            // Act 3: Resume with correct reason
            var resumeResult2 = await _service.ResumeTasksPausedForReasonAsync(
                moderatorId, "Authentication check");

            // Assert 3: Should resume
            resumeResult2.Should().BeTrue();
            var resumedSession = await _dbContext.WhatsAppSessions
                .FirstOrDefaultAsync(s => s.ModeratorUserId == moderatorId);
            resumedSession!.IsPaused.Should().BeFalse();
            resumedSession.PauseReason.Should().BeNull();
        }

        [Fact]
        public async Task PauseResume_PendingQR_ShouldTakePrecedence()
        {
            // Arrange
            int moderatorId = 1;
            int userId = 10;

            var session = new WhatsAppSession
            {
                ModeratorUserId = moderatorId,
                Status = "connected",
                IsPaused = false,
                CreatedAt = DateTime.UtcNow
            };
            _dbContext.WhatsAppSessions.Add(session);
            await _dbContext.SaveChangesAsync();

            // Act 1: Pause for authentication check
            await _service.PauseAllOngoingTasksAsync(
                moderatorId, userId, "Authentication check");

            // Act 2: Pause for PendingQR (should override)
            await _service.PauseAllOngoingTasksAsync(
                moderatorId, userId, "PendingQR - Authentication required");

            var pausedSession = await _dbContext.WhatsAppSessions
                .FirstOrDefaultAsync(s => s.ModeratorUserId == moderatorId);
            
            // Assert: PendingQR reason should be set
            pausedSession!.PauseReason.Should().Be("PendingQR - Authentication required");

            // Act 3: Try to resume with "Authentication check" reason
            var resumeResult = await _service.ResumeTasksPausedForReasonAsync(
                moderatorId, "Authentication check");

            // Assert: Should NOT resume because reason is different
            resumeResult.Should().BeFalse();
            var stillPausedSession = await _dbContext.WhatsAppSessions
                .FirstOrDefaultAsync(s => s.ModeratorUserId == moderatorId);
            stillPausedSession!.IsPaused.Should().BeTrue();
            stillPausedSession.PauseReason.Should().Be("PendingQR - Authentication required");
        }

        #endregion

        #region Error Handling Tests

        [Fact]
        public async Task PauseAllOngoingTasksAsync_WithException_ShouldReturnFalse()
        {
            // Arrange - Dispose context to force exception
            _dbContext.Dispose();

            // Act
            var result = await _service.PauseAllOngoingTasksAsync(1, 10, "Test");

            // Assert
            result.Should().BeFalse();
            _mockNotifier.Verify(
                n => n.Notify(It.Is<string>(msg => msg.Contains("Error pausing tasks"))), 
                Times.Once);
        }

        #endregion
    }
}
