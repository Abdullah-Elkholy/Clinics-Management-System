using Clinics.Domain;
using System;

namespace IntegrationTests.Common;

/// <summary>
/// Central test data factory using builder pattern.
/// Ensures consistent, deterministic test entities across all integration tests.
/// Reduces duplication and enables easy trait-based test discovery.
/// </summary>
public static class TestDataFactory
{
    /// <summary>
    /// Creates a test user with primary_admin role and hashed password.
    /// </summary>
    public static User CreateTestAdmin()
    {
        return new User
        {
            Id = 1,
            Username = "testadmin",
            FirstName = "Test",
            LastName = "Admin",
            Email = "admin@clinic.test",
            PasswordHash = HashPassword("password123"),
            Role = "primary_admin",
            IsActive = true
        };
    }

    /// <summary>
    /// Creates a test user with secondary_admin role.
    /// </summary>
    public static User CreateTestSecondaryAdmin()
    {
        return new User
        {
            Id = 2,
            Username = "secondary",
            FirstName = "Secondary",
            LastName = "Admin",
            Email = "secondary@clinic.test",
            PasswordHash = HashPassword("password456"),
            Role = "secondary_admin",
            IsActive = true
        };
    }

    /// <summary>
    /// Creates a test user with moderator role.
    /// </summary>
    public static User CreateTestModerator()
    {
        return new User
        {
            Id = 3,
            Username = "moderator",
            FirstName = "Test",
            LastName = "Moderator",
            Email = "moderator@clinic.test",
            PasswordHash = HashPassword("password789"),
            Role = "moderator",
            IsActive = true
        };
    }

    /// <summary>
    /// Creates a test user with regular user role.
    /// </summary>
    public static User CreateTestUser()
    {
        return new User
        {
            Id = 4,
            Username = "user",
            FirstName = "Regular",
            LastName = "User",
            Email = "user@clinic.test",
            PasswordHash = HashPassword("pass1234"),
            Role = "user",
            IsActive = true
        };
    }

    /// <summary>
    /// Creates a test queue with basic configuration.
    /// </summary>
    public static Queue CreateTestQueue(User moderator = null, int id = 10)
    {
        return new Queue
        {
            Id = id,
            DoctorName = "Test Doctor",
            Position = 1,
            EstimatedWait = 30,
            ModeratorId = moderator?.Id ?? 1,
            IsActive = true,
            IsSoftDeleted = false,
            CreatedAt = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Creates a test message template.
    /// </summary>
    public static MessageTemplate CreateTestTemplate(int id = 100, string name = "Test Template")
    {
        return new MessageTemplate
        {
            Id = id,
            Name = name,
            Description = "Test template for unit testing",
            MessageBody = "Hello {{PatientName}}, your appointment is at {{Time}}",
            CreatedAt = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Creates a test patient for a queue.
    /// </summary>
    public static Patient CreateTestPatient(int queueId = 10, int id = 1000)
    {
        return new Patient
        {
            Id = id,
            FullName = "John Doe",
            PhoneNumber = "+1234567890",
            QueueId = queueId,
            Position = 1,
            CreatedAt = DateTime.UtcNow,
            IsSoftDeleted = false
        };
    }

    /// <summary>
    /// Simple password hashing for test consistency.
    /// IMPORTANT: This is NOT cryptographically secure; for tests only.
    /// </summary>
    private static string HashPassword(string password)
    {
        using (var sha = System.Security.Cryptography.SHA256.Create())
        {
            var hashedBytes = sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(password));
            return System.Convert.ToBase64String(hashedBytes);
        }
    }
}
