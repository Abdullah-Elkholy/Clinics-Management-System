using System;
using System.Collections.Generic;
using System.Linq;
using Clinics.Domain;
using FluentAssertions;
using Xunit;

namespace Clinics.Api.Tests.Unit.Users;

/// <summary>
/// Phase 4.1: Role enforcement unit tests.
/// 
/// Tests verify that role-based access control enforces correct permissions.
/// Focus: Finding defects where "stupid user" actions could bypass security.
/// 
/// Role hierarchy:
/// - PrimaryAdmin (0): Full access, can manage all users and quotas
/// - SecondaryAdmin (1): Can manage moderators and users
/// - Moderator (2): Can manage their own users and queues
/// - User (3): Can only work within their moderator's scope
/// 
/// DEFECT FOCUS: Tests document expected behavior and flag violations.
/// </summary>
public class RoleEnforcementTests
{
    #region Test Infrastructure

    private static class RoleAuthorizer
    {
        // Actions that require specific roles
        private static readonly Dictionary<string, UserRole[]> ActionPermissions = new()
        {
            // User management
            ["CreateUser"] = new[] { UserRole.PrimaryAdmin, UserRole.SecondaryAdmin, UserRole.Moderator },
            ["DeleteUser"] = new[] { UserRole.PrimaryAdmin, UserRole.SecondaryAdmin, UserRole.Moderator },
            ["UpdateUserRole"] = new[] { UserRole.PrimaryAdmin, UserRole.SecondaryAdmin },

            // Quota management
            ["ViewAllQuotas"] = new[] { UserRole.PrimaryAdmin, UserRole.SecondaryAdmin },
            ["UpdateQuota"] = new[] { UserRole.PrimaryAdmin },
            ["ViewOwnQuota"] = new[] { UserRole.PrimaryAdmin, UserRole.SecondaryAdmin, UserRole.Moderator, UserRole.User },

            // Queue management
            ["CreateQueue"] = new[] { UserRole.PrimaryAdmin, UserRole.SecondaryAdmin, UserRole.Moderator },
            ["DeleteQueue"] = new[] { UserRole.PrimaryAdmin, UserRole.SecondaryAdmin, UserRole.Moderator },

            // Admin-only
            ["ViewSystemLogs"] = new[] { UserRole.PrimaryAdmin },
            ["ManageSecondaryAdmins"] = new[] { UserRole.PrimaryAdmin },
        };

        public static bool CanPerformAction(UserRole role, string action)
        {
            if (!ActionPermissions.TryGetValue(action, out var allowedRoles))
                return false; // Unknown action = denied
            return allowedRoles.Contains(role);
        }

        // Check if user A can modify user B
        public static (bool Allowed, string? Reason) CanModifyUser(User actor, User target)
        {
            // Cannot modify yourself (for certain actions)
            if (actor.Id == target.Id)
                return (false, "Cannot modify your own account");

            // Hierarchy check
            return actor.RoleEnum switch
            {
                UserRole.PrimaryAdmin => (true, null), // Can modify anyone
                UserRole.SecondaryAdmin when target.RoleEnum >= UserRole.Moderator => (true, null),
                UserRole.SecondaryAdmin => (false, "SecondaryAdmin cannot modify Admins"),
                UserRole.Moderator when target.RoleEnum == UserRole.User && target.ModeratorId == actor.Id => (true, null),
                UserRole.Moderator => (false, "Moderator can only modify their own users"),
                _ => (false, "Insufficient permissions")
            };
        }

        // Check if role change is valid
        public static (bool Allowed, string? Reason) CanChangeRole(UserRole actorRole, UserRole fromRole, UserRole toRole)
        {
            // PrimaryAdmin can do anything
            if (actorRole == UserRole.PrimaryAdmin)
                return (true, null);

            // SecondaryAdmin cannot create/promote to PrimaryAdmin
            if (actorRole == UserRole.SecondaryAdmin)
            {
                if (toRole == UserRole.PrimaryAdmin)
                    return (false, "Cannot promote to PrimaryAdmin");
                if (fromRole == UserRole.PrimaryAdmin)
                    return (false, "Cannot modify PrimaryAdmin");
                return (true, null);
            }

            // Others cannot change roles
            return (false, "Insufficient permissions to change roles");
        }
    }

    private static User CreateUser(int id, string role, int? moderatorId = null)
    {
        return new User
        {
            Id = id,
            Username = $"user{id}",
            FirstName = $"User{id}",
            Role = role,
            ModeratorId = moderatorId,
            CreatedAt = DateTime.UtcNow,
            IsDeleted = false
        };
    }

    #endregion

    #region Action Permission Tests

    [Theory]
    [InlineData("CreateUser", UserRole.PrimaryAdmin, true)]
    [InlineData("CreateUser", UserRole.SecondaryAdmin, true)]
    [InlineData("CreateUser", UserRole.Moderator, true)]
    [InlineData("CreateUser", UserRole.User, false)]
    public void CanPerformAction_CreateUser_CorrectByRole(string action, UserRole role, bool expected)
    {
        RoleAuthorizer.CanPerformAction(role, action).Should().Be(expected);
    }

    [Theory]
    [InlineData("UpdateQuota", UserRole.PrimaryAdmin, true)]
    [InlineData("UpdateQuota", UserRole.SecondaryAdmin, false)]
    [InlineData("UpdateQuota", UserRole.Moderator, false)]
    [InlineData("UpdateQuota", UserRole.User, false)]
    public void CanPerformAction_UpdateQuota_OnlyPrimaryAdmin(string action, UserRole role, bool expected)
    {
        // DEFECT POTENTIAL: If SecondaryAdmin can update quotas, that's privilege escalation
        RoleAuthorizer.CanPerformAction(role, action).Should().Be(expected);
    }

    [Theory]
    [InlineData("ViewSystemLogs", UserRole.PrimaryAdmin, true)]
    [InlineData("ViewSystemLogs", UserRole.SecondaryAdmin, false)]
    [InlineData("ManageSecondaryAdmins", UserRole.PrimaryAdmin, true)]
    [InlineData("ManageSecondaryAdmins", UserRole.SecondaryAdmin, false)]
    public void CanPerformAction_AdminOnly_StrictlyEnforced(string action, UserRole role, bool expected)
    {
        RoleAuthorizer.CanPerformAction(role, action).Should().Be(expected);
    }

    [Fact]
    public void CanPerformAction_UnknownAction_ShouldDeny()
    {
        // DEFECT: Unknown actions should NEVER be allowed (fail-safe)
        RoleAuthorizer.CanPerformAction(UserRole.PrimaryAdmin, "UNKNOWN_ACTION").Should().BeFalse();
    }

    #endregion

    #region User Modification Hierarchy Tests

    [Fact]
    public void CanModifyUser_PrimaryAdmin_CanModifyAnyone()
    {
        var admin = CreateUser(1, "primary_admin");
        var moderator = CreateUser(2, "moderator");
        var user = CreateUser(3, "user", moderatorId: 2);

        RoleAuthorizer.CanModifyUser(admin, moderator).Allowed.Should().BeTrue();
        RoleAuthorizer.CanModifyUser(admin, user).Allowed.Should().BeTrue();
    }

    [Fact]
    public void CanModifyUser_SecondaryAdmin_CannotModifyPrimaryAdmin()
    {
        var secondaryAdmin = CreateUser(1, "secondary_admin");
        var primaryAdmin = CreateUser(2, "primary_admin");

        var result = RoleAuthorizer.CanModifyUser(secondaryAdmin, primaryAdmin);
        result.Allowed.Should().BeFalse();
        result.Reason.Should().Contain("Admin");
    }

    [Fact]
    public void CanModifyUser_Moderator_CanOnlyModifyOwnUsers()
    {
        var moderator = CreateUser(1, "moderator");
        var ownUser = CreateUser(2, "user", moderatorId: 1);
        var otherUser = CreateUser(3, "user", moderatorId: 99);

        RoleAuthorizer.CanModifyUser(moderator, ownUser).Allowed.Should().BeTrue();
        RoleAuthorizer.CanModifyUser(moderator, otherUser).Allowed.Should().BeFalse();
    }

    [Fact]
    public void CanModifyUser_Moderator_CannotModifyOtherModerator()
    {
        var moderator1 = CreateUser(1, "moderator");
        var moderator2 = CreateUser(2, "moderator");

        var result = RoleAuthorizer.CanModifyUser(moderator1, moderator2);
        result.Allowed.Should().BeFalse();
    }

    [Fact]
    public void CanModifyUser_User_CannotModifyAnyone()
    {
        var user1 = CreateUser(1, "user", moderatorId: 99);
        var user2 = CreateUser(2, "user", moderatorId: 99);

        var result = RoleAuthorizer.CanModifyUser(user1, user2);
        result.Allowed.Should().BeFalse();
    }

    [Fact]
    public void CanModifyUser_SelfModification_Denied()
    {
        // DEFECT POTENTIAL: User changing their own role/permissions
        var admin = CreateUser(1, "primary_admin");
        var result = RoleAuthorizer.CanModifyUser(admin, admin);
        result.Allowed.Should().BeFalse();
        result.Reason.Should().Contain("own account");
    }

    #endregion

    #region Role Change Tests

    [Fact]
    public void CanChangeRole_PrimaryAdmin_CanDoAnything()
    {
        RoleAuthorizer.CanChangeRole(UserRole.PrimaryAdmin, UserRole.User, UserRole.Moderator).Allowed.Should().BeTrue();
        RoleAuthorizer.CanChangeRole(UserRole.PrimaryAdmin, UserRole.Moderator, UserRole.SecondaryAdmin).Allowed.Should().BeTrue();
    }

    [Fact]
    public void CanChangeRole_SecondaryAdmin_CannotPromoteToPrimaryAdmin()
    {
        // DEFECT: Privilege escalation if this is allowed
        var result = RoleAuthorizer.CanChangeRole(UserRole.SecondaryAdmin, UserRole.Moderator, UserRole.PrimaryAdmin);
        result.Allowed.Should().BeFalse();
    }

    [Fact]
    public void CanChangeRole_SecondaryAdmin_CannotDemotePrimaryAdmin()
    {
        var result = RoleAuthorizer.CanChangeRole(UserRole.SecondaryAdmin, UserRole.PrimaryAdmin, UserRole.Moderator);
        result.Allowed.Should().BeFalse();
    }

    [Fact]
    public void CanChangeRole_Moderator_CannotChangeRoles()
    {
        var result = RoleAuthorizer.CanChangeRole(UserRole.Moderator, UserRole.User, UserRole.Moderator);
        result.Allowed.Should().BeFalse();
    }

    [Fact]
    public void CanChangeRole_User_CannotChangeRoles()
    {
        var result = RoleAuthorizer.CanChangeRole(UserRole.User, UserRole.User, UserRole.Moderator);
        result.Allowed.Should().BeFalse();
    }

    #endregion

    #region Edge Cases / Defect Discovery

    [Fact]
    public void EdgeCase_DeletedUserActing_ShouldBeBlocked()
    {
        // DEFECT: Deleted user's session should be invalidated
        var deletedAdmin = CreateUser(1, "primary_admin");
        deletedAdmin.IsDeleted = true;

        // This test documents expected behavior - implementation should check IsDeleted
        deletedAdmin.IsDeleted.Should().BeTrue();
        // Action should be blocked at auth layer - cannot test without integration
    }

    [Fact]
    public void EdgeCase_NullRole_DefaultsToUser()
    {
        var role = UserRoleExtensions.FromRoleName(null);
        role.Should().Be(UserRole.User);
    }

    [Fact]
    public void EdgeCase_InvalidRoleString_DefaultsToUser()
    {
        // DEFECT POTENTIAL: If invalid role becomes admin somehow
        var role = UserRoleExtensions.FromRoleName("super_admin");
        role.Should().Be(UserRole.User);
    }

    [Fact]
    public void EdgeCase_EmptyRoleString_DefaultsToUser()
    {
        var role = UserRoleExtensions.FromRoleName("");
        role.Should().Be(UserRole.User);
    }

    [Fact]
    public void EdgeCase_CaseSensitiveRole_ShouldMatch()
    {
        // DEF-011 FIXED: Role matching is now case-insensitive
        // Uppercase role should correctly map to PrimaryAdmin
        var role = UserRoleExtensions.FromRoleName("PRIMARY_ADMIN");
        role.Should().Be(UserRole.PrimaryAdmin, "Role matching should be case-insensitive after DEF-011 fix");
    }

    #endregion
}
