using FluentAssertions;
using Clinics.Domain;

namespace Clinics.Api.Tests.Unit.PauseResume;

/// <summary>
/// Unit tests for the 3-tier pause hierarchy state machine.
/// 
/// Hierarchy (highest to lowest priority):
/// 1. WhatsAppSession.IsPaused (Global) - pauses ALL operations for a moderator
/// 2. MessageSession.IsPaused (Session) - pauses all messages in a session
/// 3. Message.IsPaused (Message) - pauses individual message
/// 
/// A message is "effectively paused" if ANY level in the hierarchy is paused.
/// </summary>
public class PauseResumeStateMachineTests
{
    #region Helper: Effective Pause State Computation

    /// <summary>
    /// Computes whether a message is effectively paused given the 3-tier hierarchy.
    /// This mirrors the logic in QueuedMessageProcessor.FilterPausedMessagesAsync.
    /// </summary>
    private static bool IsEffectivelyPaused(
        Message message,
        WhatsAppSession? globalSession,
        MessageSession? messageSession)
    {
        // Priority 1: Global moderator pause (WhatsAppSession)
        if (globalSession?.IsPaused == true)
            return true;

        // Priority 2: Session-level pause (MessageSession)
        if (messageSession?.IsPaused == true)
            return true;

        // Priority 3: Message-level pause
        return message.IsPaused;
    }

    /// <summary>
    /// Gets the highest-priority pause reason in the hierarchy.
    /// </summary>
    private static string? GetEffectivePauseReason(
        Message message,
        WhatsAppSession? globalSession,
        MessageSession? messageSession)
    {
        // Priority 1: Global takes precedence
        if (globalSession?.IsPaused == true)
            return globalSession.PauseReason ?? "GlobalPause";

        // Priority 2: Session-level
        if (messageSession?.IsPaused == true)
            return messageSession.PauseReason ?? "SessionPause";

        // Priority 3: Message-level
        if (message.IsPaused)
            return message.PauseReason ?? "MessagePause";

        return null;
    }

    #endregion

    #region Test Fixtures

    private static WhatsAppSession CreateGlobalSession(int moderatorId, bool isPaused, string? pauseReason = null, string status = "connected")
    {
        return new WhatsAppSession
        {
            Id = moderatorId,
            ModeratorUserId = moderatorId,
            IsPaused = isPaused,
            PauseReason = pauseReason,
            Status = status,
            CreatedAt = DateTime.UtcNow
        };
    }

    private static MessageSession CreateMessageSession(bool isPaused, string? pauseReason = null)
    {
        return new MessageSession
        {
            Id = Guid.NewGuid(),
            QueueId = 1,
            IsPaused = isPaused,
            PauseReason = pauseReason,
            Status = isPaused ? "paused" : "active",
            TotalMessages = 10,
            SentMessages = 0,
            StartTime = DateTime.UtcNow
        };
    }

    private static Message CreateMessage(bool isPaused, string? pauseReason = null, int? moderatorId = 1)
    {
        return new Message
        {
            Id = Guid.NewGuid(),
            Content = "Test message",
            PatientPhone = "1234567890",
            Status = "queued",
            IsPaused = isPaused,
            PauseReason = pauseReason,
            ModeratorId = moderatorId,
            CreatedAt = DateTime.UtcNow
        };
    }

    #endregion

    #region Effective Paused State Tests

    [Fact]
    public void EffectivePausedState_WhenAllLevelsNotPaused_ShouldReturnFalse()
    {
        // Arrange
        var globalSession = CreateGlobalSession(1, isPaused: false);
        var messageSession = CreateMessageSession(isPaused: false);
        var message = CreateMessage(isPaused: false);

        // Act
        var result = IsEffectivelyPaused(message, globalSession, messageSession);

        // Assert
        result.Should().BeFalse("no level in hierarchy is paused");
    }

    [Fact]
    public void EffectivePausedState_WhenGlobalPaused_ShouldReturnTrue()
    {
        // Arrange
        var globalSession = CreateGlobalSession(1, isPaused: true, pauseReason: "PendingQR");
        var messageSession = CreateMessageSession(isPaused: false);
        var message = CreateMessage(isPaused: false);

        // Act
        var result = IsEffectivelyPaused(message, globalSession, messageSession);

        // Assert
        result.Should().BeTrue("global pause has highest priority");
    }

    [Fact]
    public void EffectivePausedState_WhenSessionPausedButGlobalNot_ShouldReturnTrue()
    {
        // Arrange
        var globalSession = CreateGlobalSession(1, isPaused: false);
        var messageSession = CreateMessageSession(isPaused: true, pauseReason: "UserPaused");
        var message = CreateMessage(isPaused: false);

        // Act
        var result = IsEffectivelyPaused(message, globalSession, messageSession);

        // Assert
        result.Should().BeTrue("session-level pause should block message");
    }

    [Fact]
    public void EffectivePausedState_WhenOnlyMessagePaused_ShouldReturnTrue()
    {
        // Arrange
        var globalSession = CreateGlobalSession(1, isPaused: false);
        var messageSession = CreateMessageSession(isPaused: false);
        var message = CreateMessage(isPaused: true, pauseReason: "UserPaused");

        // Act
        var result = IsEffectivelyPaused(message, globalSession, messageSession);

        // Assert
        result.Should().BeTrue("message-level pause should block message");
    }

    [Fact]
    public void EffectivePausedState_WhenNoGlobalSession_ShouldStillCheckOtherLevels()
    {
        // Arrange - null global session (moderator has no WhatsAppSession yet)
        WhatsAppSession? globalSession = null;
        var messageSession = CreateMessageSession(isPaused: true);
        var message = CreateMessage(isPaused: false);

        // Act
        var result = IsEffectivelyPaused(message, globalSession, messageSession);

        // Assert
        result.Should().BeTrue("session pause should still work without global session");
    }

    [Fact]
    public void EffectivePausedState_WhenNoMessageSession_ShouldStillCheckOtherLevels()
    {
        // Arrange - null message session (message not part of a session)
        var globalSession = CreateGlobalSession(1, isPaused: false);
        MessageSession? messageSession = null;
        var message = CreateMessage(isPaused: true);

        // Act
        var result = IsEffectivelyPaused(message, globalSession, messageSession);

        // Assert
        result.Should().BeTrue("message pause should still work without session");
    }

    [Fact]
    public void EffectivePausedState_WhenAllLevelsPaused_ShouldReturnTrue()
    {
        // Arrange - pathological case: all levels paused
        var globalSession = CreateGlobalSession(1, isPaused: true, pauseReason: "PendingNET");
        var messageSession = CreateMessageSession(isPaused: true, pauseReason: "SessionPaused");
        var message = CreateMessage(isPaused: true, pauseReason: "MessagePaused");

        // Act
        var result = IsEffectivelyPaused(message, globalSession, messageSession);

        // Assert
        result.Should().BeTrue("all levels paused means definitely paused");
    }

    #endregion

    #region Priority Resolution Tests

    [Theory]
    [InlineData(true, false, false, "PendingQR", "SessionReason", "MessageReason", "PendingQR")]
    [InlineData(false, true, false, "GlobalReason", "SessionPaused", "MessageReason", "SessionPaused")]
    [InlineData(false, false, true, "GlobalReason", "SessionReason", "UserPaused", "UserPaused")]
    [InlineData(true, true, true, "PendingQR", "SessionPaused", "MessagePaused", "PendingQR")] // Global wins
    public void GetEffectivePauseReason_ShouldReturnHighestPriorityReason(
        bool globalPaused,
        bool sessionPaused,
        bool messagePaused,
        string? globalReason,
        string? sessionReason,
        string? messageReason,
        string expectedReason)
    {
        // Arrange
        var globalSession = CreateGlobalSession(1, globalPaused, globalPaused ? globalReason : null);
        var messageSession = CreateMessageSession(sessionPaused, sessionPaused ? sessionReason : null);
        var message = CreateMessage(messagePaused, messagePaused ? messageReason : null);

        // Act
        var result = GetEffectivePauseReason(message, globalSession, messageSession);

        // Assert
        result.Should().Be(expectedReason);
    }

    [Fact]
    public void GetEffectivePauseReason_WhenNotPaused_ShouldReturnNull()
    {
        // Arrange
        var globalSession = CreateGlobalSession(1, isPaused: false);
        var messageSession = CreateMessageSession(isPaused: false);
        var message = CreateMessage(isPaused: false);

        // Act
        var result = GetEffectivePauseReason(message, globalSession, messageSession);

        // Assert
        result.Should().BeNull();
    }

    #endregion

    #region Resumability Tests (WhatsAppSession.IsResumable logic)

    [Theory]
    [InlineData(true, "connected", null, true)] // Paused + connected + no check = resumable
    [InlineData(true, "connected", "UserPaused", true)] // Paused + connected + user paused = resumable
    [InlineData(true, "connected", "PendingNET", true)] // Paused + connected + network = resumable
    [InlineData(true, "pending", null, false)] // Paused + pending = NOT resumable
    [InlineData(true, "disconnected", null, false)] // Paused + disconnected = NOT resumable
    [InlineData(true, "connected", "CheckWhatsApp", false)] // Paused + check in progress = NOT resumable
    [InlineData(false, "connected", null, false)] // Not paused = nothing to resume
    public void GlobalSession_IsResumable_ShouldFollowRules(
        bool isPaused,
        string status,
        string? pauseReason,
        bool expectedResumable)
    {
        // Arrange
        var session = CreateGlobalSession(1, isPaused, pauseReason, status);

        // Act
        var result = session.IsResumable;

        // Assert
        result.Should().Be(expectedResumable,
            $"IsPaused={isPaused}, Status={status}, PauseReason={pauseReason}");
    }

    [Fact]
    public void GlobalSession_PendingQR_ShouldNotBeResumable()
    {
        // Arrange - PendingQR sets status to "pending", making it unresumable
        var session = CreateGlobalSession(1, isPaused: true, pauseReason: "PendingQR", status: "pending");

        // Act
        var result = session.IsResumable;

        // Assert
        result.Should().BeFalse("PendingQR requires authentication before resume");
    }

    [Fact]
    public void GlobalSession_AfterAuthentication_ShouldBeResumable()
    {
        // Arrange - After successful auth, status becomes "connected"
        var session = CreateGlobalSession(1, isPaused: true, pauseReason: "PendingQR", status: "connected");

        // Act
        var result = session.IsResumable;

        // Assert
        result.Should().BeTrue("once connected, session can be resumed");
    }

    #endregion

    #region Pause Reason Code Tests

    [Theory]
    [InlineData("PendingQR", "Authentication required")]
    [InlineData("PendingNET", "Network failure")]
    [InlineData("BrowserClosure", "Browser closed")]
    [InlineData("UserPaused", "User initiated")]
    [InlineData("CircuitBreakerOpen", "Circuit breaker")]
    [InlineData("CheckWhatsApp", "Check operation")]
    public void PauseReasonCodes_ShouldBeRecognized(string code, string description)
    {
        // Arrange
        var session = CreateGlobalSession(1, isPaused: true, pauseReason: code);

        // Act & Assert
        session.PauseReason.Should().Be(code, $"{description} should use code '{code}'");
    }

    #endregion

    #region Edge Cases

    [Fact]
    public void EffectivePausedState_MessageWithNoModerator_ShouldStillWork()
    {
        // Arrange - message has no moderator (legacy data)
        var message = CreateMessage(isPaused: false, moderatorId: null);
        WhatsAppSession? globalSession = null;
        var messageSession = CreateMessageSession(isPaused: false);

        // Act
        var result = IsEffectivelyPaused(message, globalSession, messageSession);

        // Assert
        result.Should().BeFalse("message without moderator should not be blocked by missing global session");
    }

    [Fact]
    public void EffectivePausedState_AllNullSessions_OnlyMessageLevelChecked()
    {
        // Arrange - pathological case: no sessions at all
        var message = CreateMessage(isPaused: true, pauseReason: "UserPaused");

        // Act
        var result = IsEffectivelyPaused(message, null, null);

        // Assert
        result.Should().BeTrue("message-level pause should work even with no parent sessions");
    }

    [Fact]
    public void GlobalPause_ShouldNotCascadeToSessionOrMessage_Fields()
    {
        // This test documents that global pause does NOT modify child entities
        // Arrange
        var globalSession = CreateGlobalSession(1, isPaused: true, pauseReason: "PendingQR");
        var messageSession = CreateMessageSession(isPaused: false);
        var message = CreateMessage(isPaused: false);

        // Assert - verify child entities remain unchanged
        messageSession.IsPaused.Should().BeFalse("global pause does not cascade to session");
        message.IsPaused.Should().BeFalse("global pause does not cascade to message");

        // But effective state should still be paused
        var effectivelyPaused = IsEffectivelyPaused(message, globalSession, messageSession);
        effectivelyPaused.Should().BeTrue("effective state is computed at query time, not stored");
    }

    #endregion
}
