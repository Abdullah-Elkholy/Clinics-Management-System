using FluentAssertions;
using Clinics.Domain;

namespace Clinics.Api.Tests.Unit.Queue;

/// <summary>
/// Unit tests for queue eligibility and ordering logic.
/// 
/// Queue rules:
/// 1. Only messages with Status="queued" are eligible
/// 2. Messages with IsPaused=true are excluded
/// 3. Messages in paused sessions are excluded
/// 4. Messages from globally paused moderators are excluded
/// 5. Ordering: MessageSession.StartTime ASC, then Message.CreatedAt ASC
/// </summary>
public class QueueEligibilityTests
{
    #region Test Fixtures

    private static Message CreateMessage(
        string status = "queued",
        bool isPaused = false,
        bool isDeleted = false,
        int? moderatorId = 1,
        string? sessionId = null,
        DateTime? createdAt = null)
    {
        return new Message
        {
            Id = Guid.NewGuid(),
            Content = "Test message",
            PatientPhone = "1234567890",
            Status = status,
            IsPaused = isPaused,
            IsDeleted = isDeleted,
            ModeratorId = moderatorId,
            SessionId = sessionId,
            CreatedAt = createdAt ?? DateTime.UtcNow
        };
    }

    private static MessageSession CreateSession(
        bool isPaused = false,
        DateTime? startTime = null)
    {
        return new MessageSession
        {
            Id = Guid.NewGuid(),
            QueueId = 1,
            IsPaused = isPaused,
            Status = isPaused ? "paused" : "active",
            TotalMessages = 10,
            SentMessages = 0,
            StartTime = startTime ?? DateTime.UtcNow
        };
    }

    private static WhatsAppSession CreateGlobalSession(
        int moderatorId,
        bool isPaused = false)
    {
        return new WhatsAppSession
        {
            Id = moderatorId,
            ModeratorUserId = moderatorId,
            IsPaused = isPaused,
            Status = "connected",
            CreatedAt = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Simulates the queue selection logic from QueuedMessageProcessor.
    /// This is the logic we're testing in isolation.
    /// </summary>
    private static List<Message> SelectEligibleMessages(
        IEnumerable<Message> messages,
        Dictionary<int, bool> globalSessionPauseStatus,
        Dictionary<Guid, (bool IsPaused, DateTime StartTime)> sessionInfo)
    {
        return messages
            .Where(m => m.Status == "queued" && !m.IsDeleted)
            .Where(m =>
            {
                // Check global pause
                if (m.ModeratorId.HasValue &&
                    globalSessionPauseStatus.TryGetValue(m.ModeratorId.Value, out var isGlobalPaused) &&
                    isGlobalPaused)
                {
                    return false;
                }

                // Check session pause
                if (!string.IsNullOrEmpty(m.SessionId) &&
                    Guid.TryParse(m.SessionId, out var sessionGuid) &&
                    sessionInfo.TryGetValue(sessionGuid, out var session) &&
                    session.IsPaused)
                {
                    return false;
                }

                // Check message pause
                return !m.IsPaused;
            })
            .OrderBy(m =>
            {
                // Order by session start time, then message created time
                if (!string.IsNullOrEmpty(m.SessionId) &&
                    Guid.TryParse(m.SessionId, out var sessionGuid) &&
                    sessionInfo.TryGetValue(sessionGuid, out var session))
                {
                    return session.StartTime;
                }
                return DateTime.MinValue;
            })
            .ThenBy(m => m.CreatedAt)
            .ToList();
    }

    #endregion

    #region Basic Eligibility Tests

    [Fact]
    public void QueueSelection_ShouldOnlyIncludeQueuedStatus()
    {
        // Arrange
        var messages = new[]
        {
            CreateMessage(status: "queued"),
            CreateMessage(status: "sending"),
            CreateMessage(status: "sent"),
            CreateMessage(status: "failed"),
            CreateMessage(status: "queued")
        };

        // Act
        var eligible = SelectEligibleMessages(
            messages,
            new Dictionary<int, bool>(),
            new Dictionary<Guid, (bool, DateTime)>());

        // Assert
        eligible.Should().HaveCount(2, "only 'queued' status messages are eligible");
        eligible.Should().OnlyContain(m => m.Status == "queued");
    }

    [Fact]
    public void QueueSelection_ShouldExcludeDeletedMessages()
    {
        // Arrange
        var messages = new[]
        {
            CreateMessage(isDeleted: false),
            CreateMessage(isDeleted: true),
            CreateMessage(isDeleted: false)
        };

        // Act
        var eligible = SelectEligibleMessages(
            messages,
            new Dictionary<int, bool>(),
            new Dictionary<Guid, (bool, DateTime)>());

        // Assert
        eligible.Should().HaveCount(2, "deleted messages are excluded");
        eligible.Should().OnlyContain(m => !m.IsDeleted);
    }

    [Fact]
    public void QueueSelection_ShouldExcludePausedMessages()
    {
        // Arrange
        var messages = new[]
        {
            CreateMessage(isPaused: false),
            CreateMessage(isPaused: true),
            CreateMessage(isPaused: false)
        };

        // Act
        var eligible = SelectEligibleMessages(
            messages,
            new Dictionary<int, bool>(),
            new Dictionary<Guid, (bool, DateTime)>());

        // Assert
        eligible.Should().HaveCount(2, "paused messages are excluded");
        eligible.Should().OnlyContain(m => !m.IsPaused);
    }

    #endregion

    #region Hierarchy Pause Tests

    [Fact]
    public void QueueSelection_ShouldExcludeMessagesFromPausedSessions()
    {
        // Arrange
        var pausedSession = CreateSession(isPaused: true);
        var activeSession = CreateSession(isPaused: false);

        var messages = new[]
        {
            CreateMessage(sessionId: pausedSession.Id.ToString()),
            CreateMessage(sessionId: activeSession.Id.ToString()),
            CreateMessage(sessionId: pausedSession.Id.ToString())
        };

        var sessionInfo = new Dictionary<Guid, (bool, DateTime)>
        {
            { pausedSession.Id, (true, pausedSession.StartTime) },
            { activeSession.Id, (false, activeSession.StartTime) }
        };

        // Act
        var eligible = SelectEligibleMessages(
            messages,
            new Dictionary<int, bool>(),
            sessionInfo);

        // Assert
        eligible.Should().HaveCount(1, "messages in paused sessions are excluded");
        eligible.Single().SessionId.Should().Be(activeSession.Id.ToString());
    }

    [Fact]
    public void QueueSelection_ShouldExcludeMessagesFromGloballyPausedModerators()
    {
        // Arrange
        var messages = new[]
        {
            CreateMessage(moderatorId: 1),
            CreateMessage(moderatorId: 2),
            CreateMessage(moderatorId: 1)
        };

        var globalPauseStatus = new Dictionary<int, bool>
        {
            { 1, true },  // Moderator 1 is globally paused
            { 2, false }  // Moderator 2 is not paused
        };

        // Act
        var eligible = SelectEligibleMessages(
            messages,
            globalPauseStatus,
            new Dictionary<Guid, (bool, DateTime)>());

        // Assert
        eligible.Should().HaveCount(1, "messages from globally paused moderators are excluded");
        eligible.Single().ModeratorId.Should().Be(2);
    }

    [Fact]
    public void QueueSelection_HierarchyPriority_GlobalPauseTakesPrecedence()
    {
        // Arrange - message is not paused, session is not paused, but global IS paused
        var session = CreateSession(isPaused: false);
        var message = CreateMessage(
            isPaused: false,
            moderatorId: 1,
            sessionId: session.Id.ToString());

        var globalPauseStatus = new Dictionary<int, bool> { { 1, true } };
        var sessionInfo = new Dictionary<Guid, (bool, DateTime)>
        {
            { session.Id, (false, session.StartTime) }
        };

        // Act
        var eligible = SelectEligibleMessages(
            new[] { message },
            globalPauseStatus,
            sessionInfo);

        // Assert
        eligible.Should().BeEmpty("global pause overrides message and session state");
    }

    #endregion

    #region Ordering Tests

    [Fact]
    public void QueueOrdering_ShouldRespectSessionStartTime()
    {
        // Arrange
        var earlierSession = CreateSession(startTime: DateTime.UtcNow.AddHours(-2));
        var laterSession = CreateSession(startTime: DateTime.UtcNow.AddHours(-1));

        var messages = new[]
        {
            CreateMessage(sessionId: laterSession.Id.ToString(), createdAt: DateTime.UtcNow.AddMinutes(-5)),
            CreateMessage(sessionId: earlierSession.Id.ToString(), createdAt: DateTime.UtcNow.AddMinutes(-10)),
            CreateMessage(sessionId: laterSession.Id.ToString(), createdAt: DateTime.UtcNow.AddMinutes(-3))
        };

        var sessionInfo = new Dictionary<Guid, (bool, DateTime)>
        {
            { earlierSession.Id, (false, earlierSession.StartTime) },
            { laterSession.Id, (false, laterSession.StartTime) }
        };

        // Act
        var ordered = SelectEligibleMessages(
            messages,
            new Dictionary<int, bool>(),
            sessionInfo);

        // Assert
        ordered.Should().HaveCount(3);
        ordered[0].SessionId.Should().Be(earlierSession.Id.ToString(), "earlier session comes first");
        ordered[1].SessionId.Should().Be(laterSession.Id.ToString());
        ordered[2].SessionId.Should().Be(laterSession.Id.ToString());
    }

    [Fact]
    public void QueueOrdering_WithinSession_ShouldRespectCreatedAt()
    {
        // Arrange
        var session = CreateSession();

        var message1 = CreateMessage(sessionId: session.Id.ToString(), createdAt: DateTime.UtcNow.AddMinutes(-10));
        var message2 = CreateMessage(sessionId: session.Id.ToString(), createdAt: DateTime.UtcNow.AddMinutes(-5));
        var message3 = CreateMessage(sessionId: session.Id.ToString(), createdAt: DateTime.UtcNow.AddMinutes(-15));

        var messages = new[] { message1, message2, message3 };

        var sessionInfo = new Dictionary<Guid, (bool, DateTime)>
        {
            { session.Id, (false, session.StartTime) }
        };

        // Act
        var ordered = SelectEligibleMessages(
            messages,
            new Dictionary<int, bool>(),
            sessionInfo);

        // Assert
        ordered.Should().HaveCount(3);
        // Within same session, should be ordered by CreatedAt (oldest first)
        ordered[0].CreatedAt.Should().Be(message3.CreatedAt);
        ordered[1].CreatedAt.Should().Be(message1.CreatedAt);
        ordered[2].CreatedAt.Should().Be(message2.CreatedAt);
    }

    [Fact]
    public void QueueOrdering_MessagesWithoutSession_ShouldComeFirst()
    {
        // Arrange - messages without session have DateTime.MinValue as session start
        var session = CreateSession(startTime: DateTime.UtcNow);

        var messageWithSession = CreateMessage(sessionId: session.Id.ToString(), createdAt: DateTime.UtcNow.AddMinutes(-5));
        var messageWithoutSession = CreateMessage(sessionId: null, createdAt: DateTime.UtcNow);

        var sessionInfo = new Dictionary<Guid, (bool, DateTime)>
        {
            { session.Id, (false, session.StartTime) }
        };

        // Act
        var ordered = SelectEligibleMessages(
            new[] { messageWithSession, messageWithoutSession },
            new Dictionary<int, bool>(),
            sessionInfo);

        // Assert
        ordered.Should().HaveCount(2);
        ordered[0].SessionId.Should().BeNull("messages without session have MinValue start time");
    }

    #endregion

    #region Edge Cases

    [Fact]
    public void QueueSelection_EmptyQueue_ShouldReturnEmpty()
    {
        // Arrange
        var messages = Array.Empty<Message>();

        // Act
        var eligible = SelectEligibleMessages(
            messages,
            new Dictionary<int, bool>(),
            new Dictionary<Guid, (bool, DateTime)>());

        // Assert
        eligible.Should().BeEmpty();
    }

    [Fact]
    public void QueueSelection_AllPaused_ShouldReturnEmpty()
    {
        // Arrange
        var messages = new[]
        {
            CreateMessage(isPaused: true),
            CreateMessage(isPaused: true),
            CreateMessage(isPaused: true)
        };

        // Act
        var eligible = SelectEligibleMessages(
            messages,
            new Dictionary<int, bool>(),
            new Dictionary<Guid, (bool, DateTime)>());

        // Assert
        eligible.Should().BeEmpty("all messages are paused");
    }

    [Fact]
    public void QueueSelection_MixedStatesAndHierarchy_ShouldFilterCorrectly()
    {
        // Arrange - complex scenario with multiple filtering rules
        var activeSession = CreateSession(isPaused: false);
        var pausedSession = CreateSession(isPaused: true);

        var messages = new[]
        {
            // Should be included
            CreateMessage(moderatorId: 1, sessionId: activeSession.Id.ToString()),
            
            // Excluded: message paused
            CreateMessage(moderatorId: 1, sessionId: activeSession.Id.ToString(), isPaused: true),
            
            // Excluded: session paused
            CreateMessage(moderatorId: 1, sessionId: pausedSession.Id.ToString()),
            
            // Excluded: moderator globally paused
            CreateMessage(moderatorId: 2, sessionId: activeSession.Id.ToString()),
            
            // Excluded: deleted
            CreateMessage(moderatorId: 1, sessionId: activeSession.Id.ToString(), isDeleted: true),
            
            // Excluded: wrong status
            CreateMessage(moderatorId: 1, sessionId: activeSession.Id.ToString(), status: "sent"),
            
            // Should be included
            CreateMessage(moderatorId: 1, sessionId: activeSession.Id.ToString())
        };

        var globalPauseStatus = new Dictionary<int, bool>
        {
            { 1, false },
            { 2, true }
        };

        var sessionInfo = new Dictionary<Guid, (bool, DateTime)>
        {
            { activeSession.Id, (false, activeSession.StartTime) },
            { pausedSession.Id, (true, pausedSession.StartTime) }
        };

        // Act
        var eligible = SelectEligibleMessages(messages, globalPauseStatus, sessionInfo);

        // Assert
        eligible.Should().HaveCount(2, "only 2 messages pass all filters");
    }

    [Fact]
    public void QueueSelection_MessageWithUnknownSession_ShouldBeIncluded()
    {
        // Arrange - session ID doesn't exist in lookup (shouldn't crash)
        var unknownSessionId = Guid.NewGuid().ToString();
        var message = CreateMessage(sessionId: unknownSessionId);

        // Act
        var eligible = SelectEligibleMessages(
            new[] { message },
            new Dictionary<int, bool>(),
            new Dictionary<Guid, (bool, DateTime)>());

        // Assert
        eligible.Should().HaveCount(1, "unknown session shouldn't block message");
    }

    [Fact]
    public void QueueSelection_MessageWithUnknownModerator_ShouldBeIncluded()
    {
        // Arrange - moderator ID doesn't exist in lookup (shouldn't crash)
        var message = CreateMessage(moderatorId: 999);

        // Act
        var eligible = SelectEligibleMessages(
            new[] { message },
            new Dictionary<int, bool>(), // No entry for moderator 999
            new Dictionary<Guid, (bool, DateTime)>());

        // Assert
        eligible.Should().HaveCount(1, "unknown moderator shouldn't block message");
    }

    #endregion

    #region Idempotency (Conceptual)

    [Fact]
    public void QueueSelection_SameMessageTwice_ShouldAppearOnce()
    {
        // Arrange - test that selection is deterministic
        var message = CreateMessage();

        // Act - run selection twice with same input
        var eligible1 = SelectEligibleMessages(
            new[] { message },
            new Dictionary<int, bool>(),
            new Dictionary<Guid, (bool, DateTime)>());

        var eligible2 = SelectEligibleMessages(
            new[] { message },
            new Dictionary<int, bool>(),
            new Dictionary<Guid, (bool, DateTime)>());

        // Assert
        eligible1.Should().BeEquivalentTo(eligible2, "selection is deterministic");
        eligible1.Single().Id.Should().Be(message.Id);
    }

    #endregion
}
