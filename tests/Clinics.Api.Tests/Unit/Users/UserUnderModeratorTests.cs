using System;
using System.Collections.Generic;
using System.Linq;
using Clinics.Domain;
using FluentAssertions;
using Xunit;

namespace Clinics.Api.Tests.Unit.Users;

/// <summary>
/// Phase 7.1: User-Under-Moderator Authority Tests
/// 
/// Users linked to a Moderator should:
/// - Inherit access to Moderator's queues, patients, messages
/// - Share Moderator's quota
/// - NOT be able to manage other users
/// </summary>
public class UserUnderModeratorTests
{
    #region Test Infrastructure

    private class AuthorizationService
    {
        private readonly Dictionary<int, User> _users = new();
        private readonly Dictionary<int, TestQueue> _queues = new();

        public void AddUser(User user) => _users[user.Id] = user;
        public void AddQueue(TestQueue queue) => _queues[queue.Id] = queue;

        public bool CanAccessQueue(int actorId, int queueId)
        {
            if (!_users.TryGetValue(actorId, out var actor)) return false;
            if (!_queues.TryGetValue(queueId, out var queue)) return false;

            // Use RoleEnum for comparison
            if (actor.RoleEnum == UserRole.PrimaryAdmin || actor.RoleEnum == UserRole.SecondaryAdmin)
                return true;

            if (actor.RoleEnum == UserRole.Moderator && queue.ModeratorId == actorId)
                return true;

            if (actor.RoleEnum == UserRole.User && actor.ModeratorId.HasValue)
                return queue.ModeratorId == actor.ModeratorId.Value;

            return false;
        }

        public bool CanAddPatient(int actorId, int queueId) => CanAccessQueue(actorId, queueId);
        public bool CanSendMessages(int actorId, int queueId) => CanAccessQueue(actorId, queueId);

        public bool CanCreateUser(int actorId)
        {
            if (!_users.TryGetValue(actorId, out var actor)) return false;
            return actor.RoleEnum == UserRole.PrimaryAdmin ||
                   actor.RoleEnum == UserRole.SecondaryAdmin ||
                   actor.RoleEnum == UserRole.Moderator;
        }

        public bool CanDeleteUser(int actorId, int targetId)
        {
            if (!_users.TryGetValue(actorId, out var actor)) return false;
            if (!_users.TryGetValue(targetId, out var target)) return false;

            if (actor.RoleEnum == UserRole.User) return false;
            if (actor.RoleEnum == UserRole.Moderator)
                return target.ModeratorId == actorId;
            if (actor.RoleEnum == UserRole.SecondaryAdmin)
                return target.RoleEnum != UserRole.PrimaryAdmin && target.RoleEnum != UserRole.SecondaryAdmin;

            return actor.RoleEnum == UserRole.PrimaryAdmin;
        }

        public bool CanModifyUserRole(int actorId, int targetId)
        {
            if (!_users.TryGetValue(actorId, out var actor)) return false;
            if (actor.RoleEnum == UserRole.User) return false;
            return actor.RoleEnum == UserRole.PrimaryAdmin || actor.RoleEnum == UserRole.SecondaryAdmin;
        }

        public int GetQuotaOwnerId(int userId)
        {
            if (!_users.TryGetValue(userId, out var user)) return -1;
            if (user.RoleEnum == UserRole.User && user.ModeratorId.HasValue)
                return user.ModeratorId.Value;
            return userId;
        }
    }

    private class TestQueue
    {
        public int Id { get; set; }
        public int ModeratorId { get; set; }
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

    #region User Queue Access Tests

    [Fact]
    public void User_CanAccessModeratorQueue()
    {
        var service = new AuthorizationService();
        service.AddUser(CreateUser(1, "moderator"));
        service.AddUser(CreateUser(2, "user", modId: 1));
        service.AddQueue(new TestQueue { Id = 100, ModeratorId = 1 });

        service.CanAccessQueue(2, 100).Should().BeTrue("User should access Moderator's queue");
    }

    [Fact]
    public void User_CannotAccessOtherModeratorQueue()
    {
        var service = new AuthorizationService();
        service.AddUser(CreateUser(1, "moderator"));
        service.AddUser(CreateUser(2, "moderator"));
        service.AddUser(CreateUser(3, "user", modId: 1));
        service.AddQueue(new TestQueue { Id = 100, ModeratorId = 2 });

        service.CanAccessQueue(3, 100).Should().BeFalse("User should NOT access other Moderator's queue");
    }

    #endregion

    #region User Patient/Message Tests

    [Fact]
    public void User_CanAddPatientToModeratorQueue()
    {
        var service = new AuthorizationService();
        service.AddUser(CreateUser(1, "moderator"));
        service.AddUser(CreateUser(2, "user", modId: 1));
        service.AddQueue(new TestQueue { Id = 100, ModeratorId = 1 });

        service.CanAddPatient(2, 100).Should().BeTrue();
    }

    [Fact]
    public void User_CanSendMessagesFromModeratorQueue()
    {
        var service = new AuthorizationService();
        service.AddUser(CreateUser(1, "moderator"));
        service.AddUser(CreateUser(2, "user", modId: 1));
        service.AddQueue(new TestQueue { Id = 100, ModeratorId = 1 });

        service.CanSendMessages(2, 100).Should().BeTrue();
    }

    #endregion

    #region User CANNOT Manage Users

    [Fact]
    public void User_CannotCreateUsers()
    {
        var service = new AuthorizationService();
        service.AddUser(CreateUser(1, "user", modId: 10));

        service.CanCreateUser(1).Should().BeFalse("User role CANNOT create users");
    }

    [Fact]
    public void User_CannotDeleteOtherUsers()
    {
        var service = new AuthorizationService();
        service.AddUser(CreateUser(1, "user", modId: 10));
        service.AddUser(CreateUser(2, "user", modId: 10));

        service.CanDeleteUser(1, 2).Should().BeFalse("User CANNOT delete others");
    }

    [Fact]
    public void User_CannotModifyUserRoles()
    {
        var service = new AuthorizationService();
        service.AddUser(CreateUser(1, "user", modId: 10));
        service.AddUser(CreateUser(2, "user", modId: 10));

        service.CanModifyUserRole(1, 2).Should().BeFalse("User CANNOT modify roles");
    }

    #endregion

    #region Quota Sharing

    [Fact]
    public void User_SharesModeratorQuota()
    {
        var service = new AuthorizationService();
        service.AddUser(CreateUser(10, "moderator"));
        service.AddUser(CreateUser(1, "user", modId: 10));

        service.GetQuotaOwnerId(1).Should().Be(10, "User's quota from Moderator");
    }

    [Fact]
    public void Moderator_UsesOwnQuota()
    {
        var service = new AuthorizationService();
        service.AddUser(CreateUser(10, "moderator"));

        service.GetQuotaOwnerId(10).Should().Be(10);
    }

    #endregion
}
