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
/// Integration tests for pause/resume during sending operations.
/// Phase 1.5: Tests verify that pause correctly stops processing 
/// and resume correctly continues from the right point.
/// </summary>
public class PauseResumeSendingTests
{
    #region Test Setup Helpers

    private readonly Mock<IUnitOfWork> _mockUnitOfWork;
    private readonly Mock<IMessageSender> _mockMessageSender;
    private readonly Mock<ILogger<QueuedMessageProcessor>> _mockLogger;
    private readonly Mock<IQuotaService> _mockQuotaService;
    private readonly Mock<IArabicErrorMessageService> _mockErrorMessageService;

    // In-memory stores for mocking repository behavior
    private readonly List<Message> _messages = new();
    private readonly List<WhatsAppSession> _whatsAppSessions = new();
    private readonly List<MessageSession> _messageSessions = new();
    private readonly List<FailedTask> _failedTasks = new();

    public PauseResumeSendingTests()
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

        // FailedTasks repository mock
        var mockFailedTasksRepo = new Mock<IRepository<FailedTask>>();
        mockFailedTasksRepo.Setup(r => r.AddAsync(It.IsAny<FailedTask>()))
            .ReturnsAsync((FailedTask ft) =>
            {
                _failedTasks.Add(ft);
                return ft;
            });
        _mockUnitOfWork.Setup(u => u.FailedTasks).Returns(mockFailedTasksRepo.Object);

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
        bool isPaused = false, string status = "queued")
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
            Attempts = 0,
            Position = 1,
            CalculatedPosition = 0,
            CreatedAt = DateTime.UtcNow.AddMinutes(-10),
            RowVersion = null
        };
    }

    #endregion

    #region Phase 1.5: Pause During Sending Tests

    [Fact]
    public async Task ProcessQueuedMessages_WhenGloballyPaused_ShouldSkipAllMessages()
    {
        // Arrange
        var moderatorId = 1;
        _whatsAppSessions.Add(new WhatsAppSession
        {
            ModeratorUserId = moderatorId,
            IsPaused = true,
            PauseReason = "UserPaused",
            Status = "connected"
        });

        _messages.Add(CreateTestMessage(Guid.NewGuid(), moderatorId));
        _messages.Add(CreateTestMessage(Guid.NewGuid(), moderatorId));
        _messages.Add(CreateTestMessage(Guid.NewGuid(), moderatorId));

        var processor = CreateProcessor();

        // Act
        await processor.ProcessQueuedMessagesAsync();

        // Assert - no messages should have been sent
        _mockMessageSender.Verify(x => x.SendAsync(It.IsAny<Message>()), Times.Never);
    }

    [Fact]
    public async Task ProcessQueuedMessages_WhenSessionPaused_ShouldSkipSessionMessages()
    {
        // Arrange
        var moderatorId = 1;
        var pausedSessionId = Guid.NewGuid();
        var activeSessionId = Guid.NewGuid();
        var activeMessageId = Guid.NewGuid();

        _whatsAppSessions.Add(new WhatsAppSession
        {
            ModeratorUserId = moderatorId,
            IsPaused = false,
            Status = "connected"
        });

        _messageSessions.Add(new MessageSession
        {
            Id = pausedSessionId,
            IsPaused = true,
            Status = "active",
            QueueId = 1,
            ModeratorId = moderatorId,
            UserId = 1,
            TotalMessages = 2,
            SentMessages = 0,
            StartTime = DateTime.UtcNow
        });
        _messageSessions.Add(new MessageSession
        {
            Id = activeSessionId,
            IsPaused = false,
            Status = "active",
            QueueId = 1,
            ModeratorId = moderatorId,
            UserId = 1,
            TotalMessages = 1,
            SentMessages = 0,
            StartTime = DateTime.UtcNow
        });

        // 2 messages in paused session, 1 in active session
        _messages.Add(CreateTestMessage(Guid.NewGuid(), moderatorId, pausedSessionId.ToString()));
        _messages.Add(CreateTestMessage(Guid.NewGuid(), moderatorId, pausedSessionId.ToString()));
        _messages.Add(CreateTestMessage(activeMessageId, moderatorId, activeSessionId.ToString()));

        _mockMessageSender.Setup(x => x.SendAsync(It.IsAny<Message>()))
            .ReturnsAsync((true, "provider-id", "success"));

        var processor = CreateProcessor();

        // Act
        await processor.ProcessQueuedMessagesAsync();

        // Assert - only the message from active session should be sent
        _mockMessageSender.Verify(x => x.SendAsync(It.Is<Message>(m => m.Id == activeMessageId)), Times.Once);
        _mockMessageSender.Verify(x => x.SendAsync(It.Is<Message>(m => m.SessionId == pausedSessionId.ToString())), Times.Never);
    }

    [Fact]
    public async Task ProcessQueuedMessages_WhenMessagePaused_ShouldSkipOnlyThatMessage()
    {
        // Arrange
        var moderatorId = 1;
        var sessionId = Guid.NewGuid();
        var msg1Id = Guid.NewGuid();
        var msg2Id = Guid.NewGuid();
        var msg3Id = Guid.NewGuid();

        _whatsAppSessions.Add(new WhatsAppSession
        {
            ModeratorUserId = moderatorId,
            IsPaused = false,
            Status = "connected"
        });

        _messageSessions.Add(new MessageSession
        {
            Id = sessionId,
            IsPaused = false,
            Status = "active",
            QueueId = 1,
            ModeratorId = moderatorId,
            UserId = 1,
            TotalMessages = 3,
            SentMessages = 0,
            StartTime = DateTime.UtcNow
        });

        _messages.Add(CreateTestMessage(msg1Id, moderatorId, sessionId.ToString(), isPaused: false));
        _messages.Add(CreateTestMessage(msg2Id, moderatorId, sessionId.ToString(), isPaused: true)); // Paused
        _messages.Add(CreateTestMessage(msg3Id, moderatorId, sessionId.ToString(), isPaused: false));

        _mockMessageSender.Setup(x => x.SendAsync(It.IsAny<Message>()))
            .ReturnsAsync((true, "provider-id", "success"));

        var processor = CreateProcessor();

        // Act
        await processor.ProcessQueuedMessagesAsync();

        // Assert - messages 1 and 3 should be sent, message 2 should be skipped
        _mockMessageSender.Verify(x => x.SendAsync(It.Is<Message>(m => m.Id == msg1Id)), Times.Once);
        _mockMessageSender.Verify(x => x.SendAsync(It.Is<Message>(m => m.Id == msg2Id)), Times.Never);
        _mockMessageSender.Verify(x => x.SendAsync(It.Is<Message>(m => m.Id == msg3Id)), Times.Once);
    }

    [Fact]
    public async Task ProcessQueuedMessages_PendingQR_ShouldPauseMessageAndWhatsAppSession()
    {
        // Arrange
        var moderatorId = 1;
        var sessionId = Guid.NewGuid();
        var msgId = Guid.NewGuid();

        _whatsAppSessions.Add(new WhatsAppSession
        {
            ModeratorUserId = moderatorId,
            IsPaused = false,
            Status = "connected"
        });

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

        _messages.Add(CreateTestMessage(msgId, moderatorId, sessionId.ToString()));

        // Simulate PendingQR response
        _mockMessageSender.Setup(x => x.SendAsync(It.IsAny<Message>()))
            .ReturnsAsync((false, "", "PendingQR - Authentication required"));

        var processor = CreateProcessor();

        // Act & Assert - should throw and rollback
        var exception = await Assert.ThrowsAsync<InvalidOperationException>(
            () => processor.ProcessQueuedMessagesAsync());

        exception.Message.Should().Contain("WhatsApp session requires authentication");

        // Verify message was paused with correct reason
        var message = _messages.First(m => m.Id == msgId);
        message.IsPaused.Should().BeTrue();
        message.PauseReason.Should().Contain("PendingQR");
        message.Status.Should().Be("queued"); // Reset to queued
        message.Attempts.Should().Be(0); // Not counted as attempt

        // Verify WhatsAppSession was paused
        var whatsAppSession = _whatsAppSessions.First(ws => ws.ModeratorUserId == moderatorId);
        whatsAppSession.IsPaused.Should().BeTrue();
        whatsAppSession.PauseReason.Should().Contain("PendingQR");
        whatsAppSession.Status.Should().Be("pending");

        // Verify rollback was called
        _mockUnitOfWork.Verify(u => u.RollbackAsync(), Times.Once);
    }

    [Fact]
    public async Task ProcessQueuedMessages_PendingNET_ShouldPauseWithResumableReason()
    {
        // Arrange
        var moderatorId = 1;
        var sessionId = Guid.NewGuid();
        var msgId = Guid.NewGuid();

        _whatsAppSessions.Add(new WhatsAppSession
        {
            ModeratorUserId = moderatorId,
            IsPaused = false,
            Status = "connected"
        });

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

        _messages.Add(CreateTestMessage(msgId, moderatorId, sessionId.ToString()));

        // Simulate network failure
        _mockMessageSender.Setup(x => x.SendAsync(It.IsAny<Message>()))
            .ReturnsAsync((false, "", "PendingNET - Network failure"));

        var processor = CreateProcessor();

        // Act & Assert
        var exception = await Assert.ThrowsAsync<InvalidOperationException>(
            () => processor.ProcessQueuedMessagesAsync());

        exception.Message.Should().Contain("Network failure detected");

        // Verify message was paused
        var message = _messages.First(m => m.Id == msgId);
        message.IsPaused.Should().BeTrue();
        message.PauseReason.Should().Contain("PendingNET");
        message.Attempts.Should().Be(0); // Not counted as attempt

        // Verify WhatsAppSession was paused (but NOT set to "pending" status)
        var whatsAppSession = _whatsAppSessions.First(ws => ws.ModeratorUserId == moderatorId);
        whatsAppSession.IsPaused.Should().BeTrue();
        whatsAppSession.PauseReason.Should().Contain("PendingNET");
    }

    [Fact]
    public async Task ProcessQueuedMessages_AttemptCounter_ShouldNotIncrementWhenPaused()
    {
        // Arrange
        var moderatorId = 1;
        var sessionId = Guid.NewGuid();
        var msgId = Guid.NewGuid();

        _whatsAppSessions.Add(new WhatsAppSession
        {
            ModeratorUserId = moderatorId,
            IsPaused = false,
            Status = "connected"
        });

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

        var message = CreateTestMessage(msgId, moderatorId, sessionId.ToString());
        message.Attempts = 1; // Already had one attempt
        _messages.Add(message);

        // Simulate PendingQR
        _mockMessageSender.Setup(x => x.SendAsync(It.IsAny<Message>()))
            .ReturnsAsync((false, "", "PendingQR"));

        var processor = CreateProcessor();

        // Act
        try { await processor.ProcessQueuedMessagesAsync(); } catch { }

        // Assert - attempts should still be 1 (not incremented)
        var updatedMessage = _messages.First(m => m.Id == msgId);
        updatedMessage.Attempts.Should().Be(1);
    }

    [Fact]
    public async Task ProcessQueuedMessages_SuccessfulSend_ShouldIncrementAttempts()
    {
        // Arrange
        var moderatorId = 1;
        var sessionId = Guid.NewGuid();
        var msgId = Guid.NewGuid();

        _whatsAppSessions.Add(new WhatsAppSession
        {
            ModeratorUserId = moderatorId,
            IsPaused = false,
            Status = "connected"
        });

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

        _messages.Add(CreateTestMessage(msgId, moderatorId, sessionId.ToString()));

        _mockMessageSender.Setup(x => x.SendAsync(It.IsAny<Message>()))
            .ReturnsAsync((true, "msg-123", "success"));

        var processor = CreateProcessor();

        // Act
        await processor.ProcessQueuedMessagesAsync();

        // Assert
        var message = _messages.First(m => m.Id == msgId);
        message.Attempts.Should().Be(1);
        message.Status.Should().Be("sent");
    }

    [Fact]
    public async Task ProcessQueuedMessages_HierarchyPriority_GlobalOverridesSessionAndMessage()
    {
        // Arrange: Global paused, but session and message are not
        var moderatorId = 1;
        var sessionId = Guid.NewGuid();

        _whatsAppSessions.Add(new WhatsAppSession
        {
            ModeratorUserId = moderatorId,
            IsPaused = true, // GLOBAL PAUSE
            Status = "connected"
        });

        _messageSessions.Add(new MessageSession
        {
            Id = sessionId,
            IsPaused = false, // Session not paused
            Status = "active",
            QueueId = 1,
            ModeratorId = moderatorId,
            UserId = 1,
            TotalMessages = 1,
            SentMessages = 0,
            StartTime = DateTime.UtcNow
        });

        _messages.Add(CreateTestMessage(Guid.NewGuid(), moderatorId, sessionId.ToString(), isPaused: false));

        var processor = CreateProcessor();

        // Act
        await processor.ProcessQueuedMessagesAsync();

        // Assert - nothing should be sent because global is paused
        _mockMessageSender.Verify(x => x.SendAsync(It.IsAny<Message>()), Times.Never);
    }

    [Fact]
    public async Task ProcessQueuedMessages_MultipleModeratorsSomePaused_ShouldOnlyProcessUnpaused()
    {
        // Arrange: Moderator 1 paused, Moderator 2 active
        _whatsAppSessions.Add(new WhatsAppSession
        {
            ModeratorUserId = 1,
            IsPaused = true,
            Status = "connected"
        });
        _whatsAppSessions.Add(new WhatsAppSession
        {
            ModeratorUserId = 2,
            IsPaused = false,
            Status = "connected"
        });

        var session1 = Guid.NewGuid();
        var session2 = Guid.NewGuid();
        var msg2Id = Guid.NewGuid();

        _messageSessions.Add(new MessageSession
        {
            Id = session1,
            IsPaused = false,
            Status = "active",
            QueueId = 1,
            ModeratorId = 1,
            UserId = 1,
            TotalMessages = 1,
            SentMessages = 0,
            StartTime = DateTime.UtcNow
        });
        _messageSessions.Add(new MessageSession
        {
            Id = session2,
            IsPaused = false,
            Status = "active",
            QueueId = 1,
            ModeratorId = 2,
            UserId = 2,
            TotalMessages = 1,
            SentMessages = 0,
            StartTime = DateTime.UtcNow
        });

        _messages.Add(CreateTestMessage(Guid.NewGuid(), moderatorId: 1, sessionId: session1.ToString()));
        _messages.Add(CreateTestMessage(msg2Id, moderatorId: 2, sessionId: session2.ToString()));

        _mockMessageSender.Setup(x => x.SendAsync(It.IsAny<Message>()))
            .ReturnsAsync((true, "id", "success"));

        var processor = CreateProcessor();

        // Act
        await processor.ProcessQueuedMessagesAsync();

        // Assert - only moderator 2's message should be sent
        _mockMessageSender.Verify(x => x.SendAsync(It.Is<Message>(m => m.Id == msg2Id)), Times.Once);
        _mockMessageSender.Verify(x => x.SendAsync(It.Is<Message>(m => m.ModeratorId == 1)), Times.Never);
    }

    [Fact]
    public async Task ProcessQueuedMessages_NoModerator_ShouldStillProcess()
    {
        // Arrange: Message without moderator should be processed
        var sessionId = Guid.NewGuid();
        var msgId = Guid.NewGuid();

        _messageSessions.Add(new MessageSession
        {
            Id = sessionId,
            IsPaused = false,
            Status = "active",
            QueueId = 1,
            ModeratorId = 1, // Session has moderator but message doesn't
            UserId = 1,
            TotalMessages = 1,
            SentMessages = 0,
            StartTime = DateTime.UtcNow
        });

        var message = CreateTestMessage(msgId, moderatorId: null, sessionId: sessionId.ToString());
        _messages.Add(message);

        _mockMessageSender.Setup(x => x.SendAsync(It.IsAny<Message>()))
            .ReturnsAsync((true, "id", "success"));

        var processor = CreateProcessor();

        // Act
        await processor.ProcessQueuedMessagesAsync();

        // Assert - should be processed (no global pause check applies)
        _mockMessageSender.Verify(x => x.SendAsync(It.Is<Message>(m => m.Id == msgId)), Times.Once);
    }

    [Fact]
    public async Task ProcessQueuedMessages_FailedSend_ShouldCreateFailedTask()
    {
        // Arrange
        var moderatorId = 1;
        var sessionId = Guid.NewGuid();
        var msgId = Guid.NewGuid();

        _whatsAppSessions.Add(new WhatsAppSession
        {
            ModeratorUserId = moderatorId,
            IsPaused = false,
            Status = "connected"
        });

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

        _messages.Add(CreateTestMessage(msgId, moderatorId, sessionId.ToString()));

        _mockMessageSender.Setup(x => x.SendAsync(It.IsAny<Message>()))
            .ReturnsAsync((false, "", "Invalid phone number"));

        var processor = CreateProcessor();

        // Act
        await processor.ProcessQueuedMessagesAsync();

        // Assert
        var message = _messages.First(m => m.Id == msgId);
        message.Status.Should().Be("failed");
        message.Attempts.Should().Be(1); // Actual attempt

        _failedTasks.Should().HaveCount(1);
        _failedTasks[0].MessageId.Should().Be(msgId);
        _failedTasks[0].Reason.Should().Be("provider_failure");
    }

    #endregion

    #region Resume After Pause Tests

    [Fact]
    public async Task ProcessQueuedMessages_AfterGlobalResume_ShouldProcessMessages()
    {
        // Arrange: Initially paused, then resumed
        var moderatorId = 1;
        var sessionId = Guid.NewGuid();
        var msgId = Guid.NewGuid();

        _whatsAppSessions.Add(new WhatsAppSession
        {
            ModeratorUserId = moderatorId,
            IsPaused = false, // Resumed
            Status = "connected"
        });

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

        // Message was paused but now the global is resumed
        var message = CreateTestMessage(msgId, moderatorId, sessionId.ToString());
        message.IsPaused = false; // Also resumed at message level
        message.PauseReason = null;
        _messages.Add(message);

        _mockMessageSender.Setup(x => x.SendAsync(It.IsAny<Message>()))
            .ReturnsAsync((true, "id", "success"));

        var processor = CreateProcessor();

        // Act
        await processor.ProcessQueuedMessagesAsync();

        // Assert - should now be processed
        _mockMessageSender.Verify(x => x.SendAsync(It.Is<Message>(m => m.Id == msgId)), Times.Once);
    }

    [Fact]
    public async Task ProcessQueuedMessages_OrderPreserved_AfterResume()
    {
        // Arrange: Multiple messages should maintain order after resume
        var moderatorId = 1;
        var sessionId = Guid.NewGuid();
        var msg1Id = Guid.NewGuid();
        var msg2Id = Guid.NewGuid();
        var msg3Id = Guid.NewGuid();

        _whatsAppSessions.Add(new WhatsAppSession
        {
            ModeratorUserId = moderatorId,
            IsPaused = false,
            Status = "connected"
        });

        _messageSessions.Add(new MessageSession
        {
            Id = sessionId,
            IsPaused = false,
            Status = "active",
            QueueId = 1,
            ModeratorId = moderatorId,
            UserId = 1,
            TotalMessages = 3,
            SentMessages = 0,
            StartTime = DateTime.UtcNow
        });

        // Add messages with specific CreatedAt order
        var msg1 = CreateTestMessage(msg1Id, moderatorId, sessionId.ToString());
        msg1.CreatedAt = DateTime.UtcNow.AddMinutes(-10);
        var msg2 = CreateTestMessage(msg2Id, moderatorId, sessionId.ToString());
        msg2.CreatedAt = DateTime.UtcNow.AddMinutes(-5);
        var msg3 = CreateTestMessage(msg3Id, moderatorId, sessionId.ToString());
        msg3.CreatedAt = DateTime.UtcNow.AddMinutes(-1);

        _messages.AddRange(new[] { msg3, msg1, msg2 }); // Add out of order

        var sentOrder = new List<Guid>();
        _mockMessageSender.Setup(x => x.SendAsync(It.IsAny<Message>()))
            .ReturnsAsync((Message m) =>
            {
                sentOrder.Add(m.Id);
                return (true, "id", "success");
            });

        var processor = CreateProcessor();

        // Act
        await processor.ProcessQueuedMessagesAsync();

        // Assert - should be processed in CreatedAt order
        sentOrder.Should().ContainInOrder(msg1Id, msg2Id, msg3Id);
    }

    #endregion
}
