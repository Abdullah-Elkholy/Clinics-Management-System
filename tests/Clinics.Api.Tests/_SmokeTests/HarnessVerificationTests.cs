using FluentAssertions;
using Clinics.Domain;

namespace Clinics.Api.Tests._SmokeTests;

/// <summary>
/// Smoke tests to verify the test harness is correctly configured.
/// These tests validate that:
/// 1. xUnit runner works
/// 2. FluentAssertions is available
/// 3. Project references resolve (can access Domain, Application, Infrastructure, Api types)
/// </summary>
public class HarnessVerificationTests
{
    [Fact]
    public void TestRunner_ShouldExecute()
    {
        // Arrange & Act & Assert
        true.Should().BeTrue("xUnit runner is working");
    }

    [Fact]
    public void DomainTypes_ShouldBeAccessible()
    {
        // Arrange & Act
        var message = new Message
        {
            Id = Guid.NewGuid(),
            Content = "Test message",
            PatientPhone = "1234567890",
            Status = "queued"
        };

        // Assert
        message.Should().NotBeNull();
        message.Content.Should().Be("Test message");
    }

    [Fact]
    public void FluentAssertions_ShouldWork()
    {
        // Arrange
        var numbers = new[] { 1, 2, 3 };

        // Act & Assert
        numbers.Should().HaveCount(3);
        numbers.Should().Contain(2);
        numbers.Should().BeInAscendingOrder();
    }
}
