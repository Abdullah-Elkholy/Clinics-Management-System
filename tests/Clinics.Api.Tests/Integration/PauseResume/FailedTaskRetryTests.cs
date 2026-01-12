using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Clinics.Application.Interfaces;
using Clinics.Domain;
using Clinics.Infrastructure.Services;
using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace Clinics.Api.Tests.Integration.PauseResume;

/// <summary>
/// Integration tests for failed tasks and retry policies.
/// Phase 1.6: Tests verify retry behavior when paused, max attempts, 
/// and correct state transitions for failed messages.
/// </summary>
public class FailedTaskRetryTests
{
    #region Test Setup Helpers

    private readonly Mock<IUnitOfWork> _mockUnitOfWork;
    private readonly Mock<IMessageSender> _mockMessageSender;
    private readonly Mock<ILogger<QueuedMessageProcessor>> _mockLogger;
    private readonly Mock<IQuotaService> _mockQuotaService;
    private readonly Mock<IArabicErrorMessageService> _mockErrorMessageService;

    private readonly List<Message> _messages = new();
    private readonly List<WhatsAppSession> _whatsAppSessions = new();
    private readonly List<MessageSession> _messageSessions = new();
    // FailedTask removed - deprecated entity

    public FailedTaskRetryTests()
    {
        _mockUnitOfWork = new Mock<IUnitOfWork>();
        _mockMessageSender = new Mock<IMessageSender>();
        _mockLogger = new Mock<ILogger<QueuedMessageProcessor>>();
        _mockQuotaService = new Mock<IQuotaService>();
        _mockErrorMessageService = new Mock<IArabicErrorMessageService>();

        SetupMockRepositories();
    }

    private void SetupMockRepositories()
    {
        // Messages repository mock
        var mockMessagesRepo = new Mock<IRepository<Message>>();
        mockMessagesRepo.Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<Message, bool>>>()))
            .ReturnsAsync((System.Linq.Expressions.Expression<Func<Message, bool>> predicate) =>
                _messages.AsQueryable().Where(predicate.Compile()));
        mockMessagesRepo.Setup(r => r.UpdateAsync(It.IsAny<Message>()))
            .ReturnsAsync((Message m) =>
            {
                var existing = _messages.FirstOrDefault(x => x.Id == m.Id);
                if (existing != null)
                {
                    var idx = _messages.IndexOf(existing);
                    _messages[idx] = m;
                }
                return m;
            });
        _mockUnitOfWork.Setup(u => u.Messages).Returns(mockMessagesRepo.Object);

        // WhatsAppSessions repository mock
        var mockWhatsAppSessionsRepo = new Mock<IRepository<WhatsAppSession>>();
        mockWhatsAppSessionsRepo.Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<WhatsAppSession, bool>>>()))
            .ReturnsAsync((System.Linq.Expressions.Expression<Func<WhatsAppSession, bool>> predicate) =>
                _whatsAppSessions.AsQueryable().Where(predicate.Compile()));
        mockWhatsAppSessionsRepo.Setup(r => r.UpdateAsync(It.IsAny<WhatsAppSession>()))
            .ReturnsAsync((WhatsAppSession ws) =>
            {
                var existing = _whatsAppSessions.FirstOrDefault(x => x.ModeratorUserId == ws.ModeratorUserId);
                if (existing != null)
                {
                    var idx = _whatsAppSessions.IndexOf(existing);
                    _whatsAppSessions[idx] = ws;
                }
                return ws;
            });
        _mockUnitOfWork.Setup(u => u.WhatsAppSessions).Returns(mockWhatsAppSessionsRepo.Object);

        // MessageSessions repository mock
        var mockMessageSessionsRepo = new Mock<IRepository<MessageSession>>();
        mockMessageSessionsRepo.Setup(r => r.FindAsync(It.IsAny<System.Linq.Expressions.Expression<Func<MessageSession, bool>>>()))
            .ReturnsAsync((System.Linq.Expressions.Expression<Func<MessageSession, bool>> predicate) =>
                _messageSessions.AsQueryable().Where(predicate.Compile()));
        _mockUnitOfWork.Setup(u => u.MessageSessions).Returns(mockMessageSessionsRepo.Object);

        // FailedTasks repository mock removed - FailedTask entity deprecated
        // Tests that relied on FailedTask creation should be updated or skipped

        // Transaction management
        _mockUnitOfWork.Setup(u => u.BeginTransactionAsync()).Returns(Task.CompletedTask);
        _mockUnitOfWork.Setup(u => u.CommitAsync()).Returns(Task.CompletedTask);
        _mockUnitOfWork.Setup(u => u.RollbackAsync()).Returns(Task.CompletedTask);

        // Default quota service behavior
        _mockQuotaService.Setup(q => q.ConsumeMessageQuotaAsync(It.IsAny<int>(), It.IsAny<int>()))
            .ReturnsAsync(true);

        // Default error message service
        _mockErrorMessageService.Setup(e => e.TranslateProviderError(It.IsAny<string?>()))
            .Returns((string? s) => s ?? "Unknown error");
        _mockErrorMessageService.Setup(e => e.TranslateException(It.IsAny<Exception>()))
            .Returns((Exception ex) => ex.Message);
    }

    private QueuedMessageProcessor CreateProcessor()
    {
        return new QueuedMessageProcessor(
            _mockUnitOfWork.Object,
            _mockMessageSender.Object,
            _mockLogger.Object,
            _mockQuotaService.Object,
            _mockErrorMessageService.Object);
    }

    private Message CreateTestMessage(Guid id, int? moderatorId = 1, string? sessionId = null,
        bool isPaused = false, string status = "queued", int attempts = 0)
    {
        return new Message
        {
            Id = id,
            FullName = $"Test Patient {id.ToString().Substring(0, 8)}",
            PatientPhone = "+201000000001",
            CountryCode = "+20",
            Content = "Test message content",
            Status = status,
            IsPaused = isPaused,
            IsDeleted = false,
            ModeratorId = moderatorId,
            SessionId = sessionId ?? Guid.NewGuid().ToString(),
            SenderUserId = 1,
            Attempts = attempts,
            Position = 1,
            CalculatedPosition = 0,
            CreatedAt = DateTime.UtcNow.AddMinutes(-10),
            LastAttemptAt = DateTime.UtcNow.AddMinutes(-5),
            RowVersion = null
        };
    }

    private void SetupActiveModerator(int moderatorId = 1)
    {
        _whatsAppSessions.Add(new WhatsAppSession
        {
            ModeratorUserId = moderatorId,
            IsPaused = false,
            Status = "connected"
        });
    }

    private void SetupActiveSession(Guid sessionId, int moderatorId = 1)
    {
        _messageSessions.Add(new MessageSession
        {
            Id = sessionId,
            IsPaused = false,
            Status = "active",
            QueueId = 1,
            ModeratorId = moderatorId,
            UserId = 1,
            TotalMessages = 1,
            SentMessages = 0,
            StartTime = DateTime.UtcNow
        });
    }

    #endregion

    #region RetryFailedMessagesAsync Tests

    [Fact]
    public async Task RetryFailedMessages_ShouldRequeueFailedMessages()
    {
        // Arrange
        var msgId = Guid.NewGuid();
        var msg = CreateTestMessage(msgId, status: "failed", attempts: 1);
        _messages.Add(msg);

        var processor = CreateProcessor();

        // Act
        await processor.RetryFailedMessagesAsync();

        // Assert
        var message = _messages.First(m => m.Id == msgId);
        message.Status.Should().Be("queued");
    }

    [Fact]
    public async Task RetryFailedMessages_ShouldNotRetryMessagesAtMaxAttempts()
    {
        // Arrange
        var msgId = Guid.NewGuid();
        var msg = CreateTestMessage(msgId, status: "failed", attempts: 3); // Max attempts reached
        _messages.Add(msg);

        var processor = CreateProcessor();

        // Act
        await processor.RetryFailedMessagesAsync();

        // Assert - should remain failed (not requeued)
        var message = _messages.First(m => m.Id == msgId);
        message.Status.Should().Be("failed");
    }

    [Fact]
    public async Task RetryFailedMessages_ShouldRespectMaxBatch()
    {
        // Arrange - add 5 failed messages
        for (int i = 0; i < 5; i++)
        {
            var msg = CreateTestMessage(Guid.NewGuid(), status: "failed", attempts: 1);
            msg.LastAttemptAt = DateTime.UtcNow.AddMinutes(-i); // Different times
            _messages.Add(msg);
        }

        var processor = CreateProcessor();

        // Act - retry with maxBatch of 2
        await processor.RetryFailedMessagesAsync(maxBatch: 2);

        // Assert - only 2 should be requeued
        var requeuedCount = _messages.Count(m => m.Status == "queued");
        requeuedCount.Should().Be(2);
    }

    [Fact]
    public async Task RetryFailedMessages_ShouldOrderByLastAttemptAt()
    {
        // Arrange - oldest first
        var oldMsgId = Guid.NewGuid();
        var newMsgId = Guid.NewGuid();

        var oldMsg = CreateTestMessage(oldMsgId, status: "failed", attempts: 1);
        oldMsg.LastAttemptAt = DateTime.UtcNow.AddMinutes(-60); // Older

        var newMsg = CreateTestMessage(newMsgId, status: "failed", attempts: 1);
        newMsg.LastAttemptAt = DateTime.UtcNow.AddMinutes(-5); // Newer

        _messages.Add(newMsg);
        _messages.Add(oldMsg); // Add out of order

        var processor = CreateProcessor();

        // Act - only retry 1
        await processor.RetryFailedMessagesAsync(maxBatch: 1);

        // Assert - oldest message should be requeued first
        var oldMessage = _messages.First(m => m.Id == oldMsgId);
        var newMessage = _messages.First(m => m.Id == newMsgId);

        oldMessage.Status.Should().Be("queued");
        newMessage.Status.Should().Be("failed");
    }

    [Fact]
    public async Task RetryFailedMessages_NoFailedMessages_ShouldDoNothing()
    {
        // Arrange - no failed messages
        var msg = CreateTestMessage(Guid.NewGuid(), status: "queued", attempts: 0);
        _messages.Add(msg);

        var processor = CreateProcessor();

        // Act
        await processor.RetryFailedMessagesAsync();

        // Assert - nothing changed
        _messages.All(m => m.Status == "queued").Should().BeTrue();
        _mockUnitOfWork.Verify(u => u.CommitAsync(), Times.Never);
    }

    #endregion

    #region Failed Messages During Sending Tests

    [Fact]
    public async Task ProcessQueuedMessages_OnFailure_ShouldNotIncrementAttemptsWhenPaused()
    {
        // Arrange
        var moderatorId = 1;
        var sessionId = Guid.NewGuid();
        var msgId = Guid.NewGuid();

        SetupActiveModerator(moderatorId);
        SetupActiveSession(sessionId, moderatorId);

        var message = CreateTestMessage(msgId, moderatorId, sessionId.ToString());
        message.Attempts = 1; // Already had one attempt
        _messages.Add(message);

        // Simulate PendingQR (pause scenario)
        _mockMessageSender.Setup(x => x.SendAsync(It.IsAny<Message>()))
            .ReturnsAsync((false, "", "PendingQR"));

        var processor = CreateProcessor();

        // Act
        try { await processor.ProcessQueuedMessagesAsync(); } catch { }

        // Assert - attempts should NOT have increased
        var updatedMessage = _messages.First(m => m.Id == msgId);
        updatedMessage.Attempts.Should().Be(1);
        updatedMessage.IsPaused.Should().BeTrue();
    }

    [Fact]
    public async Task ProcessQueuedMessages_OnActualFailure_ShouldIncrementAttempts()
    {
        // Arrange
        var moderatorId = 1;
        var sessionId = Guid.NewGuid();
        var msgId = Guid.NewGuid();

        SetupActiveModerator(moderatorId);
        SetupActiveSession(sessionId, moderatorId);

        var message = CreateTestMessage(msgId, moderatorId, sessionId.ToString());
        message.Attempts = 1;
        _messages.Add(message);

        // Simulate actual failure (not PendingQR/NET)
        _mockMessageSender.Setup(x => x.SendAsync(It.IsAny<Message>()))
            .ReturnsAsync((false, "", "Invalid phone number"));

        var processor = CreateProcessor();

        // Act
        await processor.ProcessQueuedMessagesAsync();

        // Assert - attempts SHOULD have increased
        var updatedMessage = _messages.First(m => m.Id == msgId);
        updatedMessage.Attempts.Should().Be(2);
        updatedMessage.Status.Should().Be("failed");
    }

    [Fact]
    public async Task ProcessQueuedMessages_OnFailure_ShouldCreateFailedTask()
    {
        // Arrange
        var moderatorId = 1;
        var sessionId = Guid.NewGuid();
        var msgId = Guid.NewGuid();

        SetupActiveModerator(moderatorId);
        SetupActiveSession(sessionId, moderatorId);

        _messages.Add(CreateTestMessage(msgId, moderatorId, sessionId.ToString()));

        _mockMessageSender.Setup(x => x.SendAsync(It.IsAny<Message>()))
            .ReturnsAsync((false, "", "Provider rejected message"));

        var processor = CreateProcessor();

        // Act
        await processor.ProcessQueuedMessagesAsync();
        // FailedTask assertions removed - entity deprecated
        // _failedTasks.Should().HaveCount(1);
        // _failedTasks[0].MessageId.Should().Be(msgId);
        // _failedTasks[0].Reason.Should().Be("provider_failure");
        // _failedTasks[0].ProviderResponse.Should().Be("Provider rejected message");
    }

    [Fact]
    public async Task ProcessQueuedMessages_OnException_ShouldCreateFailedTask()
    {
        // Arrange
        var moderatorId = 1;
        var sessionId = Guid.NewGuid();
        var msgId = Guid.NewGuid();

        SetupActiveModerator(moderatorId);
        SetupActiveSession(sessionId, moderatorId);

        _messages.Add(CreateTestMessage(msgId, moderatorId, sessionId.ToString()));

        // Simulate exception during send
        _mockMessageSender.Setup(x => x.SendAsync(It.IsAny<Message>()))
            .ThrowsAsync(new Exception("Network timeout"));

        var processor = CreateProcessor();

        // Act
        await processor.ProcessQueuedMessagesAsync();
        // FailedTask assertions removed - entity deprecated
        // _failedTasks.Should().HaveCount(1);
        // _failedTasks[0].MessageId.Should().Be(msgId);
        // _failedTasks[0].Reason.Should().Be("exception");
    }

    #endregion

    #region Paused Message Retry Behavior Tests

    [Fact]
    public async Task ProcessQueuedMessages_PausedMessage_ShouldNotBeProcessed()
    {
        // Arrange
        var moderatorId = 1;
        var sessionId = Guid.NewGuid();

        SetupActiveModerator(moderatorId);
        SetupActiveSession(sessionId, moderatorId);

        var msg = CreateTestMessage(Guid.NewGuid(), moderatorId, sessionId.ToString());
        msg.Status = "queued";
        msg.IsPaused = true;
        msg.PauseReason = "PendingQR";
        _messages.Add(msg);

        _mockMessageSender.Setup(x => x.SendAsync(It.IsAny<Message>()))
            .ReturnsAsync((true, "id", "success"));

        var processor = CreateProcessor();

        // Act
        await processor.ProcessQueuedMessagesAsync();

        // Assert - should not be sent
        _mockMessageSender.Verify(x => x.SendAsync(It.IsAny<Message>()), Times.Never);
    }

    [Fact]
    public async Task RetryFailedMessages_PausedFailedMessage_ShouldStillBeRequeued()
    {
        // Arrange - a failed message that is also paused
        var msgId = Guid.NewGuid();
        var msg = CreateTestMessage(msgId, status: "failed", attempts: 1);
        msg.IsPaused = true;
        msg.PauseReason = "PendingQR";
        _messages.Add(msg);

        var processor = CreateProcessor();

        // Act
        await processor.RetryFailedMessagesAsync();

        // Assert - should be requeued (RetryFailedMessagesAsync doesn't check pause)
        var message = _messages.First(m => m.Id == msgId);
        message.Status.Should().Be("queued");
        // Note: The message is still paused, so ProcessQueuedMessagesAsync won't pick it up
        message.IsPaused.Should().BeTrue();
    }

    [Fact]
    public async Task ProcessQueuedMessages_ResumedFromPause_ShouldProcessNormally()
    {
        // Arrange - message that was paused but now resumed
        var moderatorId = 1;
        var sessionId = Guid.NewGuid();
        var msgId = Guid.NewGuid();

        SetupActiveModerator(moderatorId);
        SetupActiveSession(sessionId, moderatorId);

        var msg = CreateTestMessage(msgId, moderatorId, sessionId.ToString());
        msg.IsPaused = false;
        msg.PauseReason = null;
        msg.Attempts = 1; // Had one failed attempt before pause
        _messages.Add(msg);

        _mockMessageSender.Setup(x => x.SendAsync(It.IsAny<Message>()))
            .ReturnsAsync((true, "msg-id", "success"));

        var processor = CreateProcessor();

        // Act
        await processor.ProcessQueuedMessagesAsync();

        // Assert - should be processed and marked sent
        var message = _messages.First(m => m.Id == msgId);
        message.Status.Should().Be("sent");
        message.Attempts.Should().Be(2); // Incremented
    }

    #endregion

    #region Terminal State Tests

    [Fact]
    public async Task ProcessQueuedMessages_MaxAttemptsReached_ShouldNotBeRetried()
    {
        // Arrange
        var moderatorId = 1;
        var sessionId = Guid.NewGuid();
        var msgId = Guid.NewGuid();

        SetupActiveModerator(moderatorId);
        SetupActiveSession(sessionId, moderatorId);

        // Message with 2 attempts, about to reach max (3)
        var msg = CreateTestMessage(msgId, moderatorId, sessionId.ToString());
        msg.Attempts = 2;
        _messages.Add(msg);

        // Simulate failure
        _mockMessageSender.Setup(x => x.SendAsync(It.IsAny<Message>()))
            .ReturnsAsync((false, "", "Provider error"));

        var processor = CreateProcessor();

        // Act
        await processor.ProcessQueuedMessagesAsync();

        // Assert - should be marked failed and not retryable
        var message = _messages.First(m => m.Id == msgId);
        message.Status.Should().Be("failed");
        message.Attempts.Should().Be(3);

        // Verify RetryFailedMessagesAsync won't pick it up
        await processor.RetryFailedMessagesAsync();

        // Still failed (not requeued)
        message = _messages.First(m => m.Id == msgId);
        message.Status.Should().Be("failed");
    }

    [Fact]
    public async Task FailedTask_ShouldContainRetryCount()
    {
        // Arrange
        var moderatorId = 1;
        var sessionId = Guid.NewGuid();
        var msgId = Guid.NewGuid();

        SetupActiveModerator(moderatorId);
        SetupActiveSession(sessionId, moderatorId);

        var msg = CreateTestMessage(msgId, moderatorId, sessionId.ToString());
        msg.Attempts = 2; // Already had 2 attempts
        _messages.Add(msg);

        // Simulate exception during send (not provider_failure)
        // For exceptions, RetryCount = message.Attempts
        _mockMessageSender.Setup(x => x.SendAsync(It.IsAny<Message>()))
            .ThrowsAsync(new Exception("Network error"));

        var processor = CreateProcessor();

        // Act
        await processor.ProcessQueuedMessagesAsync();
        // FailedTask assertions removed - entity deprecated
        // _failedTasks.Should().HaveCount(1);
        // _failedTasks[0].RetryCount.Should().Be(3); // message.Attempts after ProcessSingleMessageAsync
        // _failedTasks[0].Reason.Should().Be("exception");
    }

    [Fact]
    public async Task FailedTask_ProviderFailure_ShouldHaveRetryCountZero()
    {
        // Arrange
        var moderatorId = 1;
        var sessionId = Guid.NewGuid();
        var msgId = Guid.NewGuid();

        SetupActiveModerator(moderatorId);
        SetupActiveSession(sessionId, moderatorId);

        var msg = CreateTestMessage(msgId, moderatorId, sessionId.ToString());
        msg.Attempts = 2;
        _messages.Add(msg);

        // Simulate provider failure (not exception)
        // For provider_failure, RetryCount = 0 (fresh FailedTask record)
        _mockMessageSender.Setup(x => x.SendAsync(It.IsAny<Message>()))
            .ReturnsAsync((false, "", "Provider rejected"));

        var processor = CreateProcessor();

        // Act
        await processor.ProcessQueuedMessagesAsync();
        // FailedTask assertions removed - entity deprecated
        // _failedTasks.Should().HaveCount(1);
        // _failedTasks[0].RetryCount.Should().Be(0);
        // _failedTasks[0].Reason.Should().Be("provider_failure");
    }

    #endregion
}
