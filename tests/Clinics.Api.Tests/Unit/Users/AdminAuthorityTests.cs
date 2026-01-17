using System;
using System.Collections.Generic;
using Clinics.Domain;
using FluentAssertions;
using Xunit;

namespace Clinics.Api.Tests.Unit.Users;

/// <summary>
/// Phase 7.3: Admin Full Authority Tests
/// Verify PrimaryAdmin and SecondaryAdmin permission boundaries.
/// </summary>
public class AdminAuthorityTests
{
    #region Infrastructure

    private class AdminAuthService
    {
        private readonly Dictionary<int, User> _users = new();

        public void AddUser(User user) => _users[user.Id] = user;

        public bool CanCreateUserWithRole(int actorId, UserRole newUserRole)
        {
            if (!_users.TryGetValue(actorId, out var actor)) return false;
            return actor.RoleEnum switch
            {
                UserRole.PrimaryAdmin => true,
                UserRole.SecondaryAdmin => newUserRole != UserRole.PrimaryAdmin,
                UserRole.Moderator => newUserRole == UserRole.User,
                _ => false
            };
        }

        public bool CanDeleteUser(int actorId, int targetId)
        {
            if (!_users.TryGetValue(actorId, out var actor)) return false;
            if (!_users.TryGetValue(targetId, out var target)) return false;
            if (actorId == targetId) return false;

            return actor.RoleEnum switch
            {
                UserRole.PrimaryAdmin => true,
                UserRole.SecondaryAdmin => target.RoleEnum != UserRole.PrimaryAdmin && target.RoleEnum != UserRole.SecondaryAdmin,
                UserRole.Moderator => target.RoleEnum == UserRole.User && target.ModeratorId == actorId,
                _ => false
            };
        }

        public bool CanModifyQuota(int actorId, int targetId)
        {
            if (!_users.TryGetValue(actorId, out var actor)) return false;
            return actor.RoleEnum == UserRole.PrimaryAdmin;
        }

        public bool CanAccessAnyQueue(int actorId)
        {
            if (!_users.TryGetValue(actorId, out var actor)) return false;
            return actor.RoleEnum == UserRole.PrimaryAdmin || actor.RoleEnum == UserRole.SecondaryAdmin;
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

    #region PrimaryAdmin Tests

    [Fact]
    public void PrimaryAdmin_CanCreateSecondaryAdmin()
    {
        var service = new AdminAuthService();
        service.AddUser(CreateUser(1, "primary_admin"));

        service.CanCreateUserWithRole(1, UserRole.SecondaryAdmin).Should().BeTrue();
    }

    [Fact]
    public void PrimaryAdmin_CanCreateAnyRole()
    {
        var service = new AdminAuthService();
        service.AddUser(CreateUser(1, "primary_admin"));

        service.CanCreateUserWithRole(1, UserRole.PrimaryAdmin).Should().BeTrue();
        service.CanCreateUserWithRole(1, UserRole.SecondaryAdmin).Should().BeTrue();
        service.CanCreateUserWithRole(1, UserRole.Moderator).Should().BeTrue();
        service.CanCreateUserWithRole(1, UserRole.User).Should().BeTrue();
    }

    [Fact]
    public void PrimaryAdmin_CanDeleteSecondaryAdmin()
    {
        var service = new AdminAuthService();
        service.AddUser(CreateUser(1, "primary_admin"));
        service.AddUser(CreateUser(2, "secondary_admin"));

        service.CanDeleteUser(1, 2).Should().BeTrue();
    }

    [Fact]
    public void PrimaryAdmin_CanModifyAnyQuota()
    {
        var service = new AdminAuthService();
        service.AddUser(CreateUser(1, "primary_admin"));
        service.AddUser(CreateUser(10, "moderator"));

        service.CanModifyQuota(1, 10).Should().BeTrue();
    }

    #endregion

    #region SecondaryAdmin Tests

    [Fact]
    public void SecondaryAdmin_CanCreateModerator()
    {
        var service = new AdminAuthService();
        service.AddUser(CreateUser(1, "secondary_admin"));

        service.CanCreateUserWithRole(1, UserRole.Moderator).Should().BeTrue();
    }

    [Fact]
    public void SecondaryAdmin_CannotCreatePrimaryAdmin()
    {
        var service = new AdminAuthService();
        service.AddUser(CreateUser(1, "secondary_admin"));

        service.CanCreateUserWithRole(1, UserRole.PrimaryAdmin).Should().BeFalse("SecondaryAdmin CANNOT escalate");
    }

    [Fact]
    public void SecondaryAdmin_CannotDeletePrimaryAdmin()
    {
        var service = new AdminAuthService();
        service.AddUser(CreateUser(1, "secondary_admin"));
        service.AddUser(CreateUser(2, "primary_admin"));

        service.CanDeleteUser(1, 2).Should().BeFalse();
    }

    [Fact]
    public void SecondaryAdmin_CanAccessAnyQueue()
    {
        var service = new AdminAuthService();
        service.AddUser(CreateUser(1, "secondary_admin"));

        service.CanAccessAnyQueue(1).Should().BeTrue();
    }

    [Fact]
    public void SecondaryAdmin_CannotModifyQuota()
    {
        var service = new AdminAuthService();
        service.AddUser(CreateUser(1, "secondary_admin"));
        service.AddUser(CreateUser(10, "moderator"));

        service.CanModifyQuota(1, 10).Should().BeFalse("Only PrimaryAdmin can modify quota");
    }

    #endregion

    #region Edge Cases

    [Fact]
    public void Moderator_CannotAccessOtherModeratorQueues()
    {
        var service = new AdminAuthService();
        service.AddUser(CreateUser(1, "moderator"));

        service.CanAccessAnyQueue(1).Should().BeFalse();
    }

    [Fact]
    public void NoOne_CanDeleteSelf()
    {
        var service = new AdminAuthService();
        service.AddUser(CreateUser(1, "primary_admin"));

        service.CanDeleteUser(1, 1).Should().BeFalse();
    }

    #endregion
}
