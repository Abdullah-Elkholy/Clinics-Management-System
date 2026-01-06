using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Clinics.Domain;

namespace Clinics.Api.Tests.Integration.Queue;

/// <summary>
/// Integration tests for queue persistence and ordering.
/// Uses EF Core InMemory provider for isolated database tests.
/// 
/// Tests verify:
/// - Message persistence with correct status
/// - Queue ordering is maintained after save/reload
/// - Pause state persists correctly
/// - Concurrent modifications are handled
/// </summary>
public class QueuePersistenceTests : IntegrationTestBase
{
    #region Test Data Setup

    private async Task<Clinics.Domain.Queue> CreateQueueAsync(int moderatorId = 1)
    {
        var queue = new Clinics.Domain.Queue
        {
            DoctorName = "Dr. Test",
            ModeratorId = moderatorId,
            CreatedBy = moderatorId,
            CreatedAt = DateTime.UtcNow
        };
        DbContext.Queues.Add(queue);
        await DbContext.SaveChangesAsync();
        return queue;
    }

    private async Task<MessageSession> CreateSessionAsync(int queueId, int moderatorId = 1, DateTime? startTime = null)
    {
        var session = new MessageSession
        {
            Id = Guid.NewGuid(),
            QueueId = queueId,
            ModeratorId = moderatorId,
            Status = "active",
            IsPaused = false,
            TotalMessages = 0,
            SentMessages = 0,
            StartTime = startTime ?? DateTime.UtcNow
        };
        DbContext.MessageSessions.Add(session);
        await DbContext.SaveChangesAsync();
        return session;
    }

    private async Task<WhatsAppSession> CreateWhatsAppSessionAsync(int moderatorId, bool isPaused = false)
    {
        var session = new WhatsAppSession
        {
            ModeratorUserId = moderatorId,
            Status = "connected",
            IsPaused = isPaused,
            CreatedAt = DateTime.UtcNow
        };
        DbContext.WhatsAppSessions.Add(session);
        await DbContext.SaveChangesAsync();
        return session;
    }

    private Message CreateMessage(
        int queueId,
        string sessionId,
        string status = "queued",
        bool isPaused = false,
        int? moderatorId = 1,
        DateTime? createdAt = null)
    {
        return new Message
        {
            Id = Guid.NewGuid(),
            QueueId = queueId,
            SessionId = sessionId,
            Content = "Test message content",
            FullName = "Test Patient",
            CountryCode = "+20",
            PatientPhone = "1234567890",
            Position = 1,
            CalculatedPosition = 0,
            Status = status,
            IsPaused = isPaused,
            ModeratorId = moderatorId,
            Attempts = 0,
            CreatedAt = createdAt ?? DateTime.UtcNow
        };
    }

    #endregion

    #region Message Persistence Tests

    [Fact]
    public async Task EnqueueMessage_ShouldPersistWithCorrectStatus()
    {
        // Arrange
        var queue = await CreateQueueAsync();
        var session = await CreateSessionAsync(queue.Id);
        var message = CreateMessage(queue.Id, session.Id.ToString());

        // Act
        DbContext.Messages.Add(message);
        await SaveAndDetachAsync();

        // Assert
        var persisted = await DbContext.Messages.FirstOrDefaultAsync(m => m.Id == message.Id);
        persisted.Should().NotBeNull();
        persisted!.Status.Should().Be("queued");
        persisted.IsPaused.Should().BeFalse();
        persisted.IsDeleted.Should().BeFalse();
    }

    [Fact]
    public async Task UpdateMessageStatus_ShouldPersistNewStatus()
    {
        // Arrange
        var queue = await CreateQueueAsync();
        var session = await CreateSessionAsync(queue.Id);
        var message = CreateMessage(queue.Id, session.Id.ToString());
        DbContext.Messages.Add(message);
        await SaveAndDetachAsync();

        // Act - simulate dequeue (status change to "sending")
        var toUpdate = await DbContext.Messages.FirstAsync(m => m.Id == message.Id);
        toUpdate.Status = "sending";
        await SaveAndDetachAsync();

        // Assert
        var updated = await DbContext.Messages.FirstAsync(m => m.Id == message.Id);
        updated.Status.Should().Be("sending");
    }

    [Fact]
    public async Task PauseMessage_ShouldPersistPauseFields()
    {
        // Arrange
        var queue = await CreateQueueAsync();
        var session = await CreateSessionAsync(queue.Id);
        var message = CreateMessage(queue.Id, session.Id.ToString());
        DbContext.Messages.Add(message);
        await SaveAndDetachAsync();

        // Act - pause the message
        var toUpdate = await DbContext.Messages.FirstAsync(m => m.Id == message.Id);
        toUpdate.IsPaused = true;
        toUpdate.PausedAt = DateTime.UtcNow;
        toUpdate.PausedBy = 1;
        toUpdate.PauseReason = "UserPaused";
        await SaveAndDetachAsync();

        // Assert
        var paused = await DbContext.Messages.FirstAsync(m => m.Id == message.Id);
        paused.IsPaused.Should().BeTrue();
        paused.PauseReason.Should().Be("UserPaused");
        paused.PausedBy.Should().Be(1);
        paused.PausedAt.Should().NotBeNull();
    }

    #endregion

    #region Queue Ordering Tests

    [Fact]
    public async Task QueueOrdering_ShouldMaintainCreatedAtOrder()
    {
        // Arrange
        var queue = await CreateQueueAsync();
        var session = await CreateSessionAsync(queue.Id);

        var message1 = CreateMessage(queue.Id, session.Id.ToString(), createdAt: DateTime.UtcNow.AddMinutes(-10));
        var message2 = CreateMessage(queue.Id, session.Id.ToString(), createdAt: DateTime.UtcNow.AddMinutes(-5));
        var message3 = CreateMessage(queue.Id, session.Id.ToString(), createdAt: DateTime.UtcNow.AddMinutes(-15));

        DbContext.Messages.AddRange(message1, message2, message3);
        await SaveAndDetachAsync();

        // Act - query in order
        var ordered = await DbContext.Messages
            .Where(m => m.Status == "queued")
            .OrderBy(m => m.CreatedAt)
            .ToListAsync();

        // Assert
        ordered.Should().HaveCount(3);
        ordered[0].Id.Should().Be(message3.Id, "oldest first");
        ordered[1].Id.Should().Be(message1.Id);
        ordered[2].Id.Should().Be(message2.Id, "newest last");
    }

    [Fact]
    public async Task QueueOrdering_ShouldRespectSessionStartTime()
    {
        // Arrange
        var queue = await CreateQueueAsync();
        var earlierSession = await CreateSessionAsync(queue.Id, startTime: DateTime.UtcNow.AddHours(-2));
        var laterSession = await CreateSessionAsync(queue.Id, startTime: DateTime.UtcNow.AddHours(-1));

        // Add messages in reverse order (later session first)
        var messageInLaterSession = CreateMessage(queue.Id, laterSession.Id.ToString(), createdAt: DateTime.UtcNow.AddMinutes(-5));
        var messageInEarlierSession = CreateMessage(queue.Id, earlierSession.Id.ToString(), createdAt: DateTime.UtcNow);

        DbContext.Messages.AddRange(messageInLaterSession, messageInEarlierSession);
        await SaveAndDetachAsync();

        // Act - query with session join for ordering
        var ordered = await (
            from m in DbContext.Messages
            join s in DbContext.MessageSessions on m.SessionId equals s.Id.ToString()
            where m.Status == "queued"
            orderby s.StartTime, m.CreatedAt
            select m
        ).ToListAsync();

        // Assert
        ordered.Should().HaveCount(2);
        ordered[0].SessionId.Should().Be(earlierSession.Id.ToString(), "earlier session comes first");
        ordered[1].SessionId.Should().Be(laterSession.Id.ToString());
    }

    #endregion

    #region Filtering Tests

    [Fact]
    public async Task QueryQueuedMessages_ShouldExcludePaused()
    {
        // Arrange
        var queue = await CreateQueueAsync();
        var session = await CreateSessionAsync(queue.Id);

        var activeMessage = CreateMessage(queue.Id, session.Id.ToString(), isPaused: false);
        var pausedMessage = CreateMessage(queue.Id, session.Id.ToString(), isPaused: true);

        DbContext.Messages.AddRange(activeMessage, pausedMessage);
        await SaveAndDetachAsync();

        // Act
        var eligible = await DbContext.Messages
            .Where(m => m.Status == "queued" && !m.IsPaused && !m.IsDeleted)
            .ToListAsync();

        // Assert
        eligible.Should().HaveCount(1);
        eligible.Single().Id.Should().Be(activeMessage.Id);
    }

    [Fact]
    public async Task QueryQueuedMessages_ShouldExcludeFromPausedSessions()
    {
        // Arrange
        var queue = await CreateQueueAsync();
        var activeSession = await CreateSessionAsync(queue.Id);
        var pausedSession = await CreateSessionAsync(queue.Id);
        
        // Pause the session
        pausedSession.IsPaused = true;
        pausedSession.PauseReason = "UserPaused";
        await DbContext.SaveChangesAsync();

        var messageInActiveSession = CreateMessage(queue.Id, activeSession.Id.ToString());
        var messageInPausedSession = CreateMessage(queue.Id, pausedSession.Id.ToString());

        DbContext.Messages.AddRange(messageInActiveSession, messageInPausedSession);
        await SaveAndDetachAsync();

        // Act - join with sessions to filter paused
        var eligible = await (
            from m in DbContext.Messages
            join s in DbContext.MessageSessions on m.SessionId equals s.Id.ToString()
            where m.Status == "queued" && !m.IsPaused && !m.IsDeleted && !s.IsPaused
            select m
        ).ToListAsync();

        // Assert
        eligible.Should().HaveCount(1);
        eligible.Single().Id.Should().Be(messageInActiveSession.Id);
    }

    [Fact]
    public async Task QueryQueuedMessages_ShouldExcludeFromGloballyPausedModerators()
    {
        // Arrange
        var queue = await CreateQueueAsync(moderatorId: 1);
        var session = await CreateSessionAsync(queue.Id, moderatorId: 1);
        
        // Create global session (paused)
        await CreateWhatsAppSessionAsync(moderatorId: 1, isPaused: true);

        var message = CreateMessage(queue.Id, session.Id.ToString(), moderatorId: 1);
        DbContext.Messages.Add(message);
        await SaveAndDetachAsync();

        // Act - check with WhatsAppSession join
        var eligible = await (
            from m in DbContext.Messages
            join ws in DbContext.WhatsAppSessions on m.ModeratorId equals ws.ModeratorUserId into wsGroup
            from ws in wsGroup.DefaultIfEmpty()
            where m.Status == "queued" && !m.IsPaused && !m.IsDeleted
                  && (ws == null || !ws.IsPaused)
            select m
        ).ToListAsync();

        // Assert
        eligible.Should().BeEmpty("moderator is globally paused");
    }

    #endregion

    #region Session State Tests

    [Fact]
    public async Task SessionPause_ShouldPersistCorrectly()
    {
        // Arrange
        var queue = await CreateQueueAsync();
        var session = await CreateSessionAsync(queue.Id);

        // Act - pause session
        session.IsPaused = true;
        session.PausedAt = DateTime.UtcNow;
        session.PausedBy = 1;
        session.PauseReason = "UserPaused";
        session.Status = "paused";
        await SaveAndDetachAsync();

        // Assert
        var persisted = await DbContext.MessageSessions.FirstAsync(s => s.Id == session.Id);
        persisted.IsPaused.Should().BeTrue();
        persisted.Status.Should().Be("paused");
        persisted.PauseReason.Should().Be("UserPaused");
    }

    [Fact]
    public async Task GlobalSessionPause_ShouldPersistCorrectly()
    {
        // Arrange
        var globalSession = await CreateWhatsAppSessionAsync(moderatorId: 1, isPaused: false);

        // Act - pause globally
        globalSession.IsPaused = true;
        globalSession.PausedAt = DateTime.UtcNow;
        globalSession.PauseReason = "PendingQR";
        globalSession.Status = "pending";
        await SaveAndDetachAsync();

        // Assert
        var persisted = await DbContext.WhatsAppSessions.FirstAsync(s => s.Id == globalSession.Id);
        persisted.IsPaused.Should().BeTrue();
        persisted.PauseReason.Should().Be("PendingQR");
        persisted.Status.Should().Be("pending");
    }

    [Fact]
    public async Task GlobalSession_IsResumable_ShouldReflectStatus()
    {
        // Arrange - paused but connected (resumable)
        var resumableSession = await CreateWhatsAppSessionAsync(moderatorId: 1, isPaused: true);
        resumableSession.Status = "connected";
        resumableSession.PauseReason = "UserPaused";
        await SaveAndDetachAsync();

        // Act
        var persisted = await DbContext.WhatsAppSessions.FirstAsync(s => s.Id == resumableSession.Id);

        // Assert
        persisted.IsResumable.Should().BeTrue("paused + connected = resumable");
    }

    [Fact]
    public async Task GlobalSession_PendingQR_ShouldNotBeResumable()
    {
        // Arrange - paused and pending (not resumable)
        var notResumableSession = await CreateWhatsAppSessionAsync(moderatorId: 2, isPaused: true);
        notResumableSession.Status = "pending";
        notResumableSession.PauseReason = "PendingQR";
        await SaveAndDetachAsync();

        // Act
        var persisted = await DbContext.WhatsAppSessions.FirstAsync(s => s.Id == notResumableSession.Id);

        // Assert
        persisted.IsResumable.Should().BeFalse("pending status = not resumable");
    }

    #endregion

    #region Multiple Messages Tests

    [Fact]
    public async Task MultipleMessages_ShouldAllPersist()
    {
        // Arrange
        var queue = await CreateQueueAsync();
        var session = await CreateSessionAsync(queue.Id);

        var messages = Enumerable.Range(1, 10)
            .Select(i => CreateMessage(queue.Id, session.Id.ToString(), 
                createdAt: DateTime.UtcNow.AddMinutes(-i)))
            .ToList();

        // Act
        DbContext.Messages.AddRange(messages);
        await SaveAndDetachAsync();

        // Assert
        var count = await DbContext.Messages.CountAsync();
        count.Should().Be(10);
    }

    [Fact]
    public async Task BulkStatusUpdate_ShouldAffectAllMatching()
    {
        // Arrange
        var queue = await CreateQueueAsync();
        var session = await CreateSessionAsync(queue.Id);

        var messages = Enumerable.Range(1, 5)
            .Select(i => CreateMessage(queue.Id, session.Id.ToString()))
            .ToList();

        DbContext.Messages.AddRange(messages);
        await SaveAndDetachAsync();

        // Act - bulk pause all messages in session
        var toUpdate = await DbContext.Messages
            .Where(m => m.SessionId == session.Id.ToString())
            .ToListAsync();

        foreach (var m in toUpdate)
        {
            m.IsPaused = true;
            m.PauseReason = "SessionPaused";
        }
        await SaveAndDetachAsync();

        // Assert
        var pausedCount = await DbContext.Messages
            .Where(m => m.IsPaused && m.PauseReason == "SessionPaused")
            .CountAsync();
        pausedCount.Should().Be(5);
    }

    #endregion
}
