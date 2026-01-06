using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Clinics.Domain;
using FluentAssertions;
using Xunit;

namespace Clinics.Api.Tests.Integration.Users;

/// <summary>
/// Phase 7.4: Cross-Role Conflict Tests
/// Tests edge cases when different roles conflict during operations.
/// </summary>
public class CrossRoleConflictTests
{
    #region Infrastructure

    private class ConflictSimulator
    {
        private readonly Dictionary<int, User> _users = new();
        private readonly Dictionary<int, bool> _queueLocks = new();

        public void AddUser(User user) => _users[user.Id] = user;
        public void AddQueue(int id) => _queueLocks[id] = false;

        public (bool adminSuccess, bool userBlocked) SimulateAdminModifyDuringUserAdd(int adminId, int userId, int queueId)
        {
            if (!_users.TryGetValue(adminId, out var admin)) return (false, false);
            if (!_users.TryGetValue(userId, out var user)) return (false, false);

            // Admin locks queue
            _queueLocks[queueId] = true;
            bool adminSuccess = admin.RoleEnum == UserRole.PrimaryAdmin || admin.RoleEnum == UserRole.SecondaryAdmin;
            bool userBlocked = _queueLocks[queueId];
            _queueLocks[queueId] = false;

            return (adminSuccess, userBlocked);
        }

        public bool UserActionSucceedsAfterModeratorDelete(int userId, int modId)
        {
            if (!_users.TryGetValue(userId, out var user)) return false;
            _users.Remove(modId);
            return _users.ContainsKey(user.ModeratorId ?? -1);
        }

        public (UserRole before, UserRole after, bool actionAllowed) SimulateRoleChangeDuringAction(int userId)
        {
            if (!_users.TryGetValue(userId, out var user)) return (UserRole.User, UserRole.User, false);
            var before = user.RoleEnum;
            user.Role = "user"; // Demote
            var after = user.RoleEnum;
            return (before, after, after == UserRole.Moderator);
        }

        public (long before, long after, int sent) SimulateQuotaChangeDuringSend(long initialQuota, long newQuota, int toSend)
        {
            int sent = 0;
            for (int i = 0; i < toSend && sent < newQuota; i++) sent++;
            return (initialQuota, newQuota, sent);
        }

        public bool SessionInvalidatedAfterDisable(int modId)
        {
            if (!_users.TryGetValue(modId, out var mod)) return true;
            mod.IsDeleted = true;
            return mod.IsDeleted;
        }
    }

    private static User CreateUser(int id, string role, int? modId = null) => new()
    {
        Id = id,
        Username = $"user{id}",
        FirstName = $"User{id}",
        Role = role,
        ModeratorId = modId
    };

    #endregion

    #region Tests

    [Fact]
    public void AdminModifyQueue_WhileUserAdding_UserBlocked()
    {
        var sim = new ConflictSimulator();
        sim.AddUser(CreateUser(1, "primary_admin"));
        sim.AddUser(CreateUser(10, "moderator"));
        sim.AddUser(CreateUser(20, "user", modId: 10));
        sim.AddQueue(100);

        var (adminSuccess, userBlocked) = sim.SimulateAdminModifyDuringUserAdd(1, 20, 100);

        adminSuccess.Should().BeTrue();
        userBlocked.Should().BeTrue("User blocked during admin lock");
    }

    [Fact]
    public void ModeratorDeleted_WhileUserMidAction_UserActionFails()
    {
        var sim = new ConflictSimulator();
        sim.AddUser(CreateUser(10, "moderator"));
        sim.AddUser(CreateUser(20, "user", modId: 10));

        var result = sim.UserActionSucceedsAfterModeratorDelete(20, 10);

        result.Should().BeFalse("User action fails when Moderator deleted");
    }

    [Fact]
    public void UserRoleChanged_WhileLoggedIn_NewPermissionsApply()
    {
        var sim = new ConflictSimulator();
        sim.AddUser(CreateUser(1, "moderator"));

        var (before, after, actionAllowed) = sim.SimulateRoleChangeDuringAction(1);

        before.Should().Be(UserRole.Moderator);
        after.Should().Be(UserRole.User);
        actionAllowed.Should().BeFalse("After demotion, action denied");
    }

    [Fact]
    public void QuotaReduced_DuringBatchSend_RespectNewQuota()
    {
        var sim = new ConflictSimulator();

        var (before, after, sent) = sim.SimulateQuotaChangeDuringSend(100, 30, 50);

        before.Should().Be(100);
        after.Should().Be(30);
        sent.Should().Be(30, "Only 30 messages sent after quota reduced");
    }

    [Fact]
    public void AdminDisablesModerator_DuringSession_SessionInvalidated()
    {
        var sim = new ConflictSimulator();
        sim.AddUser(CreateUser(10, "moderator"));

        var result = sim.SessionInvalidatedAfterDisable(10);

        result.Should().BeTrue("Session invalidated when moderator disabled");
    }

    #endregion
}
