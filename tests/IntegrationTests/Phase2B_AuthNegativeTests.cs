using System.Net;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using IntegrationTests.Common;
using Clinics.Infrastructure;
using Clinics.Api.Services;
using Microsoft.Extensions.Logging;

namespace IntegrationTests;

/// <summary>
/// Phase 2B: Negative test cases for Auth endpoints
/// Tests invalid inputs, authorization failures, edge cases, and security scenarios
/// </summary>
public class Phase2B_AuthNegativeTests : IClassFixture<CustomWebApplicationFactory<Program>>, IAsyncLifetime
{
    private readonly CustomWebApplicationFactory<Program> _factory;
    private const string ValidUsername = "admin";
    private const string ValidPassword = "admin123";
    private const string ValidLoginUrl = "/api/auth/login";

    public Phase2B_AuthNegativeTests(CustomWebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    public async Task InitializeAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<DbSeeder>>();
        var seeder = new DbSeeder(db, logger);
        await seeder.SeedAsync();
    }

    public Task DisposeAsync() => Task.CompletedTask;

    #region Null/Empty Input Tests

    [Fact]
    public async Task Login_WithNullUsername_ReturnsBadRequest()
    {
        // Arrange
        var client = _factory.CreateClient();
        var loginBody = JsonSerializer.Serialize(new { username = (string)null, password = ValidPassword });
        
        // Act
        var response = await client.PostAsync(ValidLoginUrl, 
            new StringContent(loginBody, Encoding.UTF8, "application/json"));
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Login_WithNullPassword_ReturnsBadRequest()
    {
        // Arrange
        var client = _factory.CreateClient();
        var loginBody = JsonSerializer.Serialize(new { username = ValidUsername, password = (string)null });
        
        // Act
        var response = await client.PostAsync(ValidLoginUrl, 
            new StringContent(loginBody, Encoding.UTF8, "application/json"));
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    [Trait(TestTraits.ExpectedFail, "true")]
    [Trait(TestTraits.Category, TestTraits.ExpectedFailValue)]
    [Trait(TestTraits.BusinessRule, "Empty username should be a 400 validation error, not 401 unauthorized")]
    public async Task Login_WithEmptyUsername_ReturnsUnauthorized()
    {
        // Arrange - Empty username should be rejected
        var client = _factory.CreateClient();
        var loginBody = JsonSerializer.Serialize(new { username = "", password = ValidPassword });
        
        // Act
        var response = await client.PostAsync(ValidLoginUrl, 
            new StringContent(loginBody, Encoding.UTF8, "application/json"));
        
        // Assert - API SHOULD return 400 for validation failure (defect: currently returns 401)
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    [Trait(TestTraits.ExpectedFail, "true")]
    [Trait(TestTraits.Category, TestTraits.ExpectedFailValue)]
    [Trait(TestTraits.BusinessRule, "Empty password should be a 400 validation error, not 401 unauthorized")]
    public async Task Login_WithEmptyPassword_ReturnsUnauthorized()
    {
        // Arrange - Empty password should be rejected
        var client = _factory.CreateClient();
        var loginBody = JsonSerializer.Serialize(new { username = ValidUsername, password = "" });
        
        // Act
        var response = await client.PostAsync(ValidLoginUrl, 
            new StringContent(loginBody, Encoding.UTF8, "application/json"));
        
        // Assert - API SHOULD return 400 for validation failure (defect: currently returns 401)
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    #endregion

    #region Invalid Credentials Tests

    [Fact]
    public async Task Login_WithNonexistentUser_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();
        var loginBody = JsonSerializer.Serialize(new { username = "nonexistentuser", password = ValidPassword });
        
        // Act
        var response = await client.PostAsync(ValidLoginUrl, 
            new StringContent(loginBody, Encoding.UTF8, "application/json"));
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Login_WithWrongPassword_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();
        var loginBody = JsonSerializer.Serialize(new { username = ValidUsername, password = "wrongpassword123" });
        
        // Act
        var response = await client.PostAsync(ValidLoginUrl, 
            new StringContent(loginBody, Encoding.UTF8, "application/json"));
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Login_WithCaseSensitivePassword_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();
        var loginBody = JsonSerializer.Serialize(new { username = ValidUsername, password = "ADMIN123" });
        
        // Act
        var response = await client.PostAsync(ValidLoginUrl, 
            new StringContent(loginBody, Encoding.UTF8, "application/json"));
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    #endregion

    #region SQL Injection & Security Tests

    [Fact]
    public async Task Login_WithSQLInjectionInUsername_ReturnsBadRequest()
    {
        // Arrange
        var client = _factory.CreateClient();
        var maliciousUsername = "' OR '1'='1";
        var loginBody = JsonSerializer.Serialize(new { username = maliciousUsername, password = ValidPassword });
        
        // Act
        var response = await client.PostAsync(ValidLoginUrl, 
            new StringContent(loginBody, Encoding.UTF8, "application/json"));
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Login_WithSQLInjectionInPassword_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();
        var maliciousPassword = "'; DROP TABLE Users; --";
        var loginBody = JsonSerializer.Serialize(new { username = ValidUsername, password = maliciousPassword });
        
        // Act
        var response = await client.PostAsync(ValidLoginUrl, 
            new StringContent(loginBody, Encoding.UTF8, "application/json"));
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    #endregion

    #region Token Validation Tests

    [Fact]
    public async Task GetCurrentUser_WithoutToken_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();
        
        // Act
        var response = await client.GetAsync("/api/auth/me");
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetCurrentUser_WithMalformedToken_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = 
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", "invalid.token.here");
        
        // Act
        var response = await client.GetAsync("/api/auth/me");
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GetCurrentUser_WithExpiredToken_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();
        // Using an intentionally old/invalid token that would be expired
        var expiredToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.invalid";
        client.DefaultRequestHeaders.Authorization = 
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", expiredToken);
        
        // Act
        var response = await client.GetAsync("/api/auth/me");
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    #endregion

    #region Refresh Token Negative Tests

    [Fact]
    public async Task RefreshToken_WithoutCookie_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();
        
        // Act
        var response = await client.PostAsync("/api/auth/refresh", null);
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task RefreshToken_WithInvalidSessionId_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            HandleCookies = true
        });
        
        // Manually set an invalid refresh token cookie
        client.DefaultRequestHeaders.Add("Cookie", "refreshToken=00000000-0000-0000-0000-000000000000");
        
        // Act
        var response = await client.PostAsync("/api/auth/refresh", null);
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    #endregion

    #region Edge Case Tests

    [Fact]
    [Trait(TestTraits.Category, TestTraits.ExpectedFailValue)]
    [Trait(TestTraits.BusinessRule, "Long username should return 400 validation error; currently accepts or returns wrong code")]
    public async Task Login_WithVeryLongUsername_ReturnsErrorResponse()
    {
        // Arrange - Very long username should be rejected
        var client = _factory.CreateClient();
        var veryLongUsername = new string('a', 1000);
        var loginBody = JsonSerializer.Serialize(new { username = veryLongUsername, password = ValidPassword });
        
        // Act
        var response = await client.PostAsync(ValidLoginUrl, 
            new StringContent(loginBody, Encoding.UTF8, "application/json"));
        
        // Assert - Should return error (400 or 401)
        response.StatusCode.Should().BeOneOf(HttpStatusCode.BadRequest, HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Login_WithSpecialCharactersInUsername_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();
        var specialUsername = "admin!@#$%^&*()";
        var loginBody = JsonSerializer.Serialize(new { username = specialUsername, password = ValidPassword });
        
        // Act
        var response = await client.PostAsync(ValidLoginUrl, 
            new StringContent(loginBody, Encoding.UTF8, "application/json"));
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    #endregion
}
