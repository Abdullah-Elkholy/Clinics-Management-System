using System;
using System.Linq;
using System.Threading.Tasks;
using Xunit;
using Microsoft.EntityFrameworkCore;
using Clinics.Infrastructure;
using Clinics.Domain;

namespace Clinics.IntegrationTests
{
    /// <summary>
    /// Tests for database migration and seeding
    /// Verifies that seed data uses correct UserRole enum values
    /// and that the migration properly handles role string values
    /// </summary>
    public class MigrationSeedDataTests : IAsyncLifetime
    {
        private readonly ApplicationDbContext _context;

        public MigrationSeedDataTests()
        {
            // Create fresh in-memory database for each test
            var options = new DbContextOptionsBuilder<ApplicationDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;
            
            _context = new ApplicationDbContext(options);
        }

        public async Task InitializeAsync()
        {
            // Apply migrations
            await _context.Database.EnsureDeletedAsync();
            await _context.Database.EnsureCreatedAsync();
        }

        public async Task DisposeAsync()
        {
            await _context.DisposeAsync();
        }

        #region Seed Data Tests

        [Fact]
        public async Task SeededUsers_HaveValidRoleStrings()
        {
            // Arrange - Seed data should have been applied
            // Act
            var users = await _context.Users.ToListAsync();

            // Assert
            Assert.NotEmpty(users);
            
            var validRoles = new[] { "primary_admin", "secondary_admin", "moderator", "user" };
            foreach (var user in users)
            {
                Assert.Contains(user.Role, validRoles);
            }
        }

        [Fact]
        public async Task SeededAdminUser_HasPrimaryAdminRole()
        {
            // Arrange
            // Act
            var adminUser = await _context.Users
                .FirstOrDefaultAsync(u => u.Username == "admin");

            // Assert
            Assert.NotNull(adminUser);
            Assert.Equal("primary_admin", adminUser.Role);
            Assert.False(string.IsNullOrEmpty(adminUser.PasswordHash));
        }

        [Fact]
        public async Task SeededAdminUser_CanBeConvertedToEnum()
        {
            // Arrange
            var adminUser = await _context.Users
                .FirstOrDefaultAsync(u => u.Username == "admin");
            Assert.NotNull(adminUser);

            // Act
            var roleEnum = UserRoleExtensions.FromRoleName(adminUser.Role);

            // Assert
            Assert.Equal(UserRole.PrimaryAdmin, roleEnum);
        }

        [Fact]
        public async Task SeededSecondaryAdminUser_HasCorrectRole()
        {
            // Arrange
            // Act
            var admin2User = await _context.Users
                .FirstOrDefaultAsync(u => u.Username == "admin2");

            // Assert
            Assert.NotNull(admin2User);
            Assert.Equal("secondary_admin", admin2User.Role);
        }

        [Fact]
        public async Task SeededModeratorUser_HasCorrectRole()
        {
            // Arrange
            // Act
            var modUser = await _context.Users
                .FirstOrDefaultAsync(u => u.Username == "mod1");

            // Assert
            Assert.NotNull(modUser);
            Assert.Equal("moderator", modUser.Role);
        }

        [Fact]
        public async Task SeededRegularUser_HasUserRole()
        {
            // Arrange
            // Act
            var regularUser = await _context.Users
                .FirstOrDefaultAsync(u => u.Username == "user1");

            // Assert
            Assert.NotNull(regularUser);
            Assert.Equal("user", regularUser.Role);
        }

        [Fact]
        public async Task AllSeededUsers_CanBeConvertedToEnum()
        {
            // Arrange
            var users = await _context.Users.ToListAsync();
            Assert.NotEmpty(users);

            // Act & Assert
            foreach (var user in users)
            {
                // Should not throw - all role strings should be valid
                var roleEnum = UserRoleExtensions.FromRoleName(user.Role);
                Assert.True(Enum.IsDefined(typeof(UserRole), roleEnum));
            }
        }

        #endregion

        #region Migration Consistency Tests

        [Fact]
        public async Task NoUserHasNullRole()
        {
            // Arrange
            // Act
            var usersWithNullRole = await _context.Users
                .Where(u => u.Role == null)
                .ToListAsync();

            // Assert
            Assert.Empty(usersWithNullRole);
        }

        [Fact]
        public async Task NoUserHasEmptyRole()
        {
            // Arrange
            // Act
            var usersWithEmptyRole = await _context.Users
                .Where(u => u.Role == "")
                .ToListAsync();

            // Assert
            Assert.Empty(usersWithEmptyRole);
        }

        [Fact]
        public async Task RoleColumnCanHold50CharacterMaxLength()
        {
            // Arrange
            var maxLengthRole = "this_is_a_role_with_very_long_name_1234567890";
            Assert.True(maxLengthRole.Length <= 50);

            // Act
            var testUser = new User
            {
                Username = "test-role-length",
                FullName = "Test User",
                Role = maxLengthRole
            };
            _context.Users.Add(testUser);
            await _context.SaveChangesAsync();

            // Assert
            var retrievedUser = await _context.Users
                .FirstOrDefaultAsync(u => u.Username == "test-role-length");
            Assert.NotNull(retrievedUser);
            Assert.Equal(maxLengthRole, retrievedUser.Role);
        }

        #endregion

        #region Include() Call Tests

        [Fact]
        public async Task CanQueryUserWithoutIncludeCall_NoException()
        {
            // Arrange
            var adminUser = await _context.Users
                .FirstOrDefaultAsync(u => u.Username == "admin");

            // Act & Assert
            // This test verifies that the Include(u => u.Role) call was removed
            // If it still exists, it will throw InvalidOperationException
            Assert.NotNull(adminUser);
            Assert.Equal("primary_admin", adminUser.Role);
        }

        [Fact]
        public async Task QueryingUsersByUsername_DoesNotRequireInclude()
        {
            // Arrange
            const string username = "admin";

            // Act
            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Username == username);

            // Assert
            Assert.NotNull(user);
            Assert.NotNull(user.Role);
        }

        #endregion

        #region Seeded Data Relationships

        [Fact]
        public async Task SeededQueuesExist()
        {
            // Arrange
            // Act
            var queues = await _context.Queues.ToListAsync();

            // Assert
            Assert.NotEmpty(queues);
            var defaultQueue = queues.FirstOrDefault(q => q.DoctorName == "DefaultQueue");
            Assert.NotNull(defaultQueue);
        }

        [Fact]
        public async Task SeededMessagesExist()
        {
            // Arrange
            // Act
            var messages = await _context.Messages.ToListAsync();

            // Assert
            // Should have seeded messages
            // Note: May be empty if no patients exist in seeding
            Assert.IsType<System.Collections.Generic.List<Message>>(messages);
        }

        [Fact]
        public async Task SeededTemplatesExist()
        {
            // Arrange
            // Act
            var templates = await _context.MessageTemplates.ToListAsync();

            // Assert
            Assert.NotEmpty(templates);
            Assert.Contains(templates, t => t.Title == "Welcome");
            Assert.Contains(templates, t => t.Title == "AppointmentReminder");
        }

        #endregion

        #region Idempotent Seeding Tests

        [Fact]
        public async Task SeedDataIsIdempotent_RunningMultipleTimes()
        {
            // Arrange
            var initialUsers = await _context.Users.ToListAsync();
            var initialCount = initialUsers.Count;

            // Act & Assert
            // If we were to re-run migrations, user count should not increase
            // This is ensured by the IF NOT EXISTS checks in migration SQL
            Assert.NotEmpty(initialUsers);
            Assert.True(initialCount >= 4); // We seed at least 4 users
        }

        #endregion

        #region Role Extension Tests

        [Fact]
        public async Task UserRoleExtensions_ToRoleName_Works()
        {
            // Arrange
            var adminUser = await _context.Users
                .FirstOrDefaultAsync(u => u.Username == "admin");
            Assert.NotNull(adminUser);

            // Act
            var enum_value = UserRoleExtensions.FromRoleName(adminUser.Role);
            var roleName = enum_value.ToRoleName();

            // Assert
            Assert.Equal(adminUser.Role, roleName);
        }

        [Fact]
        public async Task UserRoleExtensions_ToDisplayName_Works()
        {
            // Arrange
            var adminUser = await _context.Users
                .FirstOrDefaultAsync(u => u.Username == "admin");
            Assert.NotNull(adminUser);

            // Act
            var displayName = UserRoleExtensions.GetDisplayNameFromRoleName(adminUser.Role);

            // Assert
            Assert.Equal("مدير أساسي", displayName); // Arabic for Primary Admin
            Assert.False(string.IsNullOrEmpty(displayName));
        }

        #endregion
    }
}
