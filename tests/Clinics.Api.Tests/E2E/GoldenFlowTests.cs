using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Clinics.Domain;
using FluentAssertions;
using Xunit;

namespace Clinics.Api.Tests.E2E;

/// <summary>
/// Phase 1.9: Minimal E2E tests for the golden "send + pause + resume" flow.
/// 
/// These tests simulate the complete lifecycle across layers:
/// - Message creation and queueing
/// - Pause at all 3 hierarchy levels (Message, Session, Global)
/// - Resume and continuation
/// - Edge cases: pause during sending, resume order preservation
/// 
/// IMPORTANT: Tests probe for edge cases and potential defects.
/// Failures should be logged in Defect Register.
/// </summary>
public class GoldenFlowTests
{
    #region Test Infrastructure

    /// <summary>
    /// Simulates the message lifecycle state machine
    /// </summary>
    private class MessageLifecycleSimulator
    {
        private readonly List<Message> _messages = new();
        private readonly List<MessageSession> _sessions = new();
        private readonly Dictionary<int, WhatsAppSession> _globalSessions = new();
        private readonly List<MessageStateChange> _stateHistory = new();

        public record MessageStateChange(Guid MessageId, string FromStatus, string ToStatus, DateTime Timestamp);

        public Guid CreateQueue(int moderatorId = 1)
        {
            var sessionId = Guid.NewGuid();
            _sessions.Add(new MessageSession
            {
                Id = sessionId,
                ModeratorId = moderatorId,
                QueueId = 1,
                UserId = 1,
                Status = "active",
                IsPaused = false,
                TotalMessages = 0,
                SentMessages = 0,
                StartTime = DateTime.UtcNow
            });

            if (!_globalSessions.ContainsKey(moderatorId))
            {
                _globalSessions[moderatorId] = new WhatsAppSession
                {
                    ModeratorUserId = moderatorId,
                    Status = "connected",
                    IsPaused = false
                };
            }

            return sessionId;
        }

        public Guid EnqueueMessage(Guid sessionId, string content = "Test message")
        {
            var session = _sessions.First(s => s.Id == sessionId);
            var message = new Message
            {
                Id = Guid.NewGuid(),
                SessionId = sessionId.ToString(),
                ModeratorId = session.ModeratorId,
                FullName = $"Patient_{_messages.Count + 1}",
                PatientPhone = $"+2010000000{_messages.Count:D2}",
                CountryCode = "+20",
                Content = content,
                Status = "queued",
                Position = _messages.Count + 1,
                CalculatedPosition = _messages.Count,
                CreatedAt = DateTime.UtcNow,
                IsPaused = false,
                IsDeleted = false,
                Attempts = 0
            };
            _messages.Add(message);
            session.TotalMessages++;
            session.OngoingMessages++;
            return message.Id;
        }

        public bool TrySendMessage(Guid messageId, out string? error)
        {
            var message = _messages.FirstOrDefault(m => m.Id == messageId);
            if (message == null)
            {
                error = "Message not found";
                return false;
            }

            // Check 3-tier hierarchy
            if (IsEffectivelyPaused(message))
            {
                error = "Message is paused";
                return false;
            }

            if (message.Status != "queued")
            {
                error = $"Invalid status: {message.Status}";
                return false;
            }

            // Simulate sending
            RecordStateChange(messageId, message.Status, "sending");
            message.Status = "sending";
            message.Attempts++;
            message.LastAttemptAt = DateTime.UtcNow;

            // Simulate success
            RecordStateChange(messageId, message.Status, "sent");
            message.Status = "sent";
            message.SentAt = DateTime.UtcNow;

            error = null;
            return true;
        }

        public bool IsEffectivelyPaused(Message message)
        {
            // Level 1: Global (WhatsAppSession)
            if (message.ModeratorId.HasValue &&
                _globalSessions.TryGetValue(message.ModeratorId.Value, out var globalSession) &&
                globalSession.IsPaused)
            {
                return true;
            }

            // Level 2: Session (MessageSession)
            if (!string.IsNullOrEmpty(message.SessionId) &&
                Guid.TryParse(message.SessionId, out var sessionGuid))
            {
                var session = _sessions.FirstOrDefault(s => s.Id == sessionGuid);
                if (session?.IsPaused == true)
                {
                    return true;
                }
            }

            // Level 3: Message
            return message.IsPaused;
        }

        public void PauseMessage(Guid messageId, string reason = "UserPaused")
        {
            var message = _messages.First(m => m.Id == messageId);
            message.IsPaused = true;
            message.PauseReason = reason;
            message.PausedAt = DateTime.UtcNow;
        }

        public void ResumeMessage(Guid messageId)
        {
            var message = _messages.First(m => m.Id == messageId);
            message.IsPaused = false;
            message.PauseReason = null;
        }

        public void PauseSession(Guid sessionId)
        {
            var session = _sessions.First(s => s.Id == sessionId);
            session.IsPaused = true;
            session.PausedAt = DateTime.UtcNow;
        }

        public void ResumeSession(Guid sessionId)
        {
            var session = _sessions.First(s => s.Id == sessionId);
            session.IsPaused = false;
        }

        public void PauseGlobal(int moderatorId, string reason = "UserPaused")
        {
            if (_globalSessions.TryGetValue(moderatorId, out var session))
            {
                session.IsPaused = true;
                session.PauseReason = reason;
                session.PausedAt = DateTime.UtcNow;
            }
        }

        public void ResumeGlobal(int moderatorId)
        {
            if (_globalSessions.TryGetValue(moderatorId, out var session))
            {
                session.IsPaused = false;
                session.PauseReason = null;
            }
        }

        public Message GetMessage(Guid messageId) => _messages.First(m => m.Id == messageId);
        public IReadOnlyList<Message> GetAllMessages() => _messages.AsReadOnly();
        public IEnumerable<Message> GetQueuedMessages() => _messages.Where(m => m.Status == "queued" && !m.IsDeleted);
        public IEnumerable<Message> GetSendableMessages() => GetQueuedMessages().Where(m => !IsEffectivelyPaused(m));
        public IReadOnlyList<MessageStateChange> GetStateHistory() => _stateHistory.AsReadOnly();

        private void RecordStateChange(Guid messageId, string from, string to)
        {
            _stateHistory.Add(new MessageStateChange(messageId, from, to, DateTime.UtcNow));
        }
    }

    #endregion

    #region Golden Path: Successful Send Flow

    [Fact]
    public void GoldenPath_QueueAndSend_SingleMessage_ShouldSucceed()
    {
        // Arrange
        var sim = new MessageLifecycleSimulator();
        var sessionId = sim.CreateQueue();
        var msgId = sim.EnqueueMessage(sessionId, "Hello World");

        // Act
        var success = sim.TrySendMessage(msgId, out var error);

        // Assert
        success.Should().BeTrue();
        error.Should().BeNull();
        var msg = sim.GetMessage(msgId);
        msg.Status.Should().Be("sent");
        msg.Attempts.Should().Be(1);
        msg.SentAt.Should().NotBeNull();
    }

    [Fact]
    public void GoldenPath_QueueAndSend_MultipleMessages_ShouldMaintainOrder()
    {
        // Arrange
        var sim = new MessageLifecycleSimulator();
        var sessionId = sim.CreateQueue();
        var msg1 = sim.EnqueueMessage(sessionId, "First");
        var msg2 = sim.EnqueueMessage(sessionId, "Second");
        var msg3 = sim.EnqueueMessage(sessionId, "Third");

        // Act - send in order
        var results = new List<(Guid Id, bool Success)>();
        foreach (var id in new[] { msg1, msg2, msg3 })
        {
            results.Add((id, sim.TrySendMessage(id, out _)));
        }

        // Assert
        results.Should().AllSatisfy(r => r.Success.Should().BeTrue());

        var history = sim.GetStateHistory();
        var sentOrder = history.Where(h => h.ToStatus == "sent").Select(h => h.MessageId).ToList();
        sentOrder.Should().ContainInOrder(msg1, msg2, msg3);
    }

    #endregion

    #region Pause During Queue (Before Send)

    [Fact]
    public void Pause_MessageLevel_ShouldPreventSend()
    {
        // Arrange
        var sim = new MessageLifecycleSimulator();
        var sessionId = sim.CreateQueue();
        var msgId = sim.EnqueueMessage(sessionId);

        // Act - pause then try send
        sim.PauseMessage(msgId);
        var success = sim.TrySendMessage(msgId, out var error);

        // Assert
        success.Should().BeFalse();
        error.Should().Contain("paused");
        sim.GetMessage(msgId).Status.Should().Be("queued");
    }

    [Fact]
    public void Pause_SessionLevel_ShouldPreventAllSessionMessages()
    {
        // Arrange
        var sim = new MessageLifecycleSimulator();
        var sessionId = sim.CreateQueue();
        var msg1 = sim.EnqueueMessage(sessionId, "First");
        var msg2 = sim.EnqueueMessage(sessionId, "Second");

        // Act - pause at session level
        sim.PauseSession(sessionId);

        // Assert - both messages should be effectively paused
        sim.TrySendMessage(msg1, out _).Should().BeFalse();
        sim.TrySendMessage(msg2, out _).Should().BeFalse();
        sim.GetSendableMessages().Should().BeEmpty();
    }

    [Fact]
    public void Pause_GlobalLevel_ShouldPreventAllModeratorMessages()
    {
        // Arrange
        var sim = new MessageLifecycleSimulator();
        var moderatorId = 1;
        var session1 = sim.CreateQueue(moderatorId);
        var session2 = sim.CreateQueue(moderatorId);
        var msg1 = sim.EnqueueMessage(session1);
        var msg2 = sim.EnqueueMessage(session2);

        // Act - global pause
        sim.PauseGlobal(moderatorId);

        // Assert
        sim.TrySendMessage(msg1, out _).Should().BeFalse();
        sim.TrySendMessage(msg2, out _).Should().BeFalse();
        sim.GetSendableMessages().Should().BeEmpty();
    }

    [Fact]
    public void Pause_GlobalLevel_ShouldNotAffectOtherModerators()
    {
        // Arrange
        var sim = new MessageLifecycleSimulator();
        var session1 = sim.CreateQueue(moderatorId: 1);
        var session2 = sim.CreateQueue(moderatorId: 2);
        var msg1 = sim.EnqueueMessage(session1);
        var msg2 = sim.EnqueueMessage(session2);

        // Act - pause only moderator 1
        sim.PauseGlobal(1);

        // Assert - moderator 2's message should still be sendable
        sim.TrySendMessage(msg1, out _).Should().BeFalse();
        sim.TrySendMessage(msg2, out _).Should().BeTrue();
    }

    #endregion

    #region Resume and Continuation

    [Fact]
    public void Resume_MessageLevel_ShouldAllowSend()
    {
        // Arrange
        var sim = new MessageLifecycleSimulator();
        var sessionId = sim.CreateQueue();
        var msgId = sim.EnqueueMessage(sessionId);
        sim.PauseMessage(msgId);

        // Act - resume then send
        sim.ResumeMessage(msgId);
        var success = sim.TrySendMessage(msgId, out _);

        // Assert
        success.Should().BeTrue();
        sim.GetMessage(msgId).Status.Should().Be("sent");
    }

    [Fact]
    public void Resume_SessionLevel_ShouldAllowAllSessionMessages()
    {
        // Arrange
        var sim = new MessageLifecycleSimulator();
        var sessionId = sim.CreateQueue();
        var msg1 = sim.EnqueueMessage(sessionId);
        var msg2 = sim.EnqueueMessage(sessionId);
        sim.PauseSession(sessionId);

        // Act
        sim.ResumeSession(sessionId);

        // Assert
        sim.TrySendMessage(msg1, out _).Should().BeTrue();
        sim.TrySendMessage(msg2, out _).Should().BeTrue();
    }

    [Fact]
    public void Resume_GlobalLevel_ShouldAllowAllModeratorMessages()
    {
        // Arrange
        var sim = new MessageLifecycleSimulator();
        var moderatorId = 1;
        var session1 = sim.CreateQueue(moderatorId);
        var session2 = sim.CreateQueue(moderatorId);
        var msg1 = sim.EnqueueMessage(session1);
        var msg2 = sim.EnqueueMessage(session2);
        sim.PauseGlobal(moderatorId);

        // Act
        sim.ResumeGlobal(moderatorId);

        // Assert
        sim.TrySendMessage(msg1, out _).Should().BeTrue();
        sim.TrySendMessage(msg2, out _).Should().BeTrue();
    }

    [Fact]
    public void Resume_PreservesQueueOrder()
    {
        // Arrange
        var sim = new MessageLifecycleSimulator();
        var sessionId = sim.CreateQueue();
        var msg1 = sim.EnqueueMessage(sessionId, "First");
        var msg2 = sim.EnqueueMessage(sessionId, "Second");
        var msg3 = sim.EnqueueMessage(sessionId, "Third");
        sim.PauseSession(sessionId);

        // Act - resume and send
        sim.ResumeSession(sessionId);
        var sendable = sim.GetSendableMessages().OrderBy(m => m.CreatedAt).ToList();

        // Assert - order preserved
        sendable.Select(m => m.Content).Should().ContainInOrder("First", "Second", "Third");
    }

    #endregion

    #region Hierarchical Override Behavior

    [Fact]
    public void Hierarchy_GlobalPause_OverridesSessionResume()
    {
        // Arrange
        var sim = new MessageLifecycleSimulator();
        var moderatorId = 1;
        var sessionId = sim.CreateQueue(moderatorId);
        var msgId = sim.EnqueueMessage(sessionId);

        // Global paused, session not paused
        sim.PauseGlobal(moderatorId);
        sim.ResumeSession(sessionId); // This should not matter

        // Act
        var success = sim.TrySendMessage(msgId, out _);

        // Assert - global takes precedence
        success.Should().BeFalse();
    }

    [Fact]
    public void Hierarchy_SessionPause_OverridesMessageResume()
    {
        // Arrange
        var sim = new MessageLifecycleSimulator();
        var sessionId = sim.CreateQueue();
        var msgId = sim.EnqueueMessage(sessionId);

        // Session paused, message not paused
        sim.PauseSession(sessionId);
        sim.ResumeMessage(msgId);

        // Act
        var success = sim.TrySendMessage(msgId, out _);

        // Assert
        success.Should().BeFalse();
    }

    [Fact]
    public void Hierarchy_MessagePause_IndependentOfSessionResume()
    {
        // Arrange
        var sim = new MessageLifecycleSimulator();
        var sessionId = sim.CreateQueue();
        var msgId = sim.EnqueueMessage(sessionId);

        // Message paused at its own level
        sim.PauseMessage(msgId);
        sim.ResumeSession(sessionId); // Doesn't affect message-level pause

        // Act
        var success = sim.TrySendMessage(msgId, out _);

        // Assert
        success.Should().BeFalse();
        sim.GetMessage(msgId).IsPaused.Should().BeTrue();
    }

    [Fact]
    public void Hierarchy_AllLevelsPaused_AnyResume_StillPaused()
    {
        // Arrange
        var sim = new MessageLifecycleSimulator();
        var moderatorId = 1;
        var sessionId = sim.CreateQueue(moderatorId);
        var msgId = sim.EnqueueMessage(sessionId);

        // Pause everything
        sim.PauseGlobal(moderatorId);
        sim.PauseSession(sessionId);
        sim.PauseMessage(msgId);

        // Resume only session
        sim.ResumeSession(sessionId);

        // Act
        var success = sim.TrySendMessage(msgId, out _);

        // Assert - still paused (global and message level)
        success.Should().BeFalse();
    }

    #endregion

    #region Edge Cases: Pause During Active Processing

    [Fact]
    public void EdgeCase_PartialSend_BeforePause_ShouldDocument()
    {
        // Arrange - simulate sending first two, then pause
        var sim = new MessageLifecycleSimulator();
        var sessionId = sim.CreateQueue();
        var msg1 = sim.EnqueueMessage(sessionId, "First");
        var msg2 = sim.EnqueueMessage(sessionId, "Second");
        var msg3 = sim.EnqueueMessage(sessionId, "Third");

        // Act - send first two, then pause, then try third
        sim.TrySendMessage(msg1, out _);
        sim.TrySendMessage(msg2, out _);
        sim.PauseSession(sessionId);
        var thirdSuccess = sim.TrySendMessage(msg3, out _);

        // Assert
        sim.GetMessage(msg1).Status.Should().Be("sent");
        sim.GetMessage(msg2).Status.Should().Be("sent");
        thirdSuccess.Should().BeFalse();
        sim.GetMessage(msg3).Status.Should().Be("queued");
    }

    [Fact]
    public void EdgeCase_PendingQR_ShouldPauseAndPreservePendingMessages()
    {
        // Arrange
        var sim = new MessageLifecycleSimulator();
        var moderatorId = 1;
        var sessionId = sim.CreateQueue(moderatorId);
        var msg1 = sim.EnqueueMessage(sessionId, "First");
        var msg2 = sim.EnqueueMessage(sessionId, "Second");
        var msg3 = sim.EnqueueMessage(sessionId, "Third");

        // Simulate: first message sent, then PendingQR triggers global pause
        sim.TrySendMessage(msg1, out _);
        sim.PauseGlobal(moderatorId, "PendingQR");

        // Act - try remaining messages
        var msg2Result = sim.TrySendMessage(msg2, out _);
        var msg3Result = sim.TrySendMessage(msg3, out _);

        // Assert
        msg2Result.Should().BeFalse();
        msg3Result.Should().BeFalse();
        sim.GetQueuedMessages().Count().Should().Be(2);
    }

    #endregion

    #region Complex Scenario: Full Flow

    [Fact]
    public void CompleteFlow_Send_PauseGlobal_PartialProgress_Resume_Complete()
    {
        // Arrange
        var sim = new MessageLifecycleSimulator();
        var moderatorId = 1;
        var sessionId = sim.CreateQueue(moderatorId);

        // 5 messages
        var messages = Enumerable.Range(1, 5)
            .Select(i => sim.EnqueueMessage(sessionId, $"Message {i}"))
            .ToList();

        // Phase 1: Send first 2
        sim.TrySendMessage(messages[0], out _);
        sim.TrySendMessage(messages[1], out _);

        // Phase 2: Global pause (simulates PendingQR or user action)
        sim.PauseGlobal(moderatorId, "PendingQR");

        // Verify pause
        sim.TrySendMessage(messages[2], out _).Should().BeFalse();

        // Phase 3: Resume (user scanned QR)
        sim.ResumeGlobal(moderatorId);

        // Phase 4: Complete remaining
        sim.TrySendMessage(messages[2], out _).Should().BeTrue();
        sim.TrySendMessage(messages[3], out _).Should().BeTrue();
        sim.TrySendMessage(messages[4], out _).Should().BeTrue();

        // Assert final state
        sim.GetAllMessages().All(m => m.Status == "sent").Should().BeTrue();

        var history = sim.GetStateHistory();
        history.Count(h => h.ToStatus == "sent").Should().Be(5);
    }

    [Fact]
    public void CompleteFlow_MultipleSessionsMultipleModerators()
    {
        // Arrange
        var sim = new MessageLifecycleSimulator();

        // Moderator 1: 2 sessions
        var mod1Session1 = sim.CreateQueue(moderatorId: 1);
        var mod1Session2 = sim.CreateQueue(moderatorId: 1);
        var m1s1m1 = sim.EnqueueMessage(mod1Session1, "Mod1-S1-M1");
        var m1s2m1 = sim.EnqueueMessage(mod1Session2, "Mod1-S2-M1");

        // Moderator 2: 1 session
        var mod2Session1 = sim.CreateQueue(moderatorId: 2);
        var m2s1m1 = sim.EnqueueMessage(mod2Session1, "Mod2-S1-M1");

        // Pause moderator 1 globally
        sim.PauseGlobal(1);

        // Act
        var mod1Results = new[] { m1s1m1, m1s2m1 }.Select(m => sim.TrySendMessage(m, out _)).ToList();
        var mod2Result = sim.TrySendMessage(m2s1m1, out _);

        // Assert
        mod1Results.Should().AllSatisfy(r => r.Should().BeFalse());
        mod2Result.Should().BeTrue();
    }

    #endregion
}
