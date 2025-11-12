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
/// Phase 2B: Negative test cases for Patient CRUD endpoints
/// Tests authorization, input validation, phone number validation, and boundary conditions
/// </summary>
public class Phase2B_PatientNegativeTests : IClassFixture<CustomWebApplicationFactory<Program>>, IAsyncLifetime
{
    private readonly CustomWebApplicationFactory<Program> _factory;
    private const string ValidUsername = "admin";
    private const string ValidPassword = "admin123";

    public Phase2B_PatientNegativeTests(CustomWebApplicationFactory<Program> factory)
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

    private async Task<string> GetAccessTokenAsync(string username, string password)
    {
        var client = _factory.CreateClient();
        var loginBody = JsonSerializer.Serialize(new { username, password });
        var response = await client.PostAsync("/api/auth/login", 
            new StringContent(loginBody, Encoding.UTF8, "application/json"));
        response.EnsureSuccessStatusCode();
        
        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return json.RootElement.GetProperty("data").GetProperty("accessToken").GetString() ?? "";
    }

    #region Required Field Tests

    [Fact]
    [Trait(TestTraits.ExpectedFail, "true")]
    [Trait(TestTraits.Category, TestTraits.ExpectedFailValue)]
    [Trait(TestTraits.BusinessRule, "Creating a patient without fullName must return 400 not 500")]
    public async Task Patient_Create_WithoutFullName_ReturnsBadRequest()
    {
        // Arrange - Arrange - Test that API rejects patient without required fullName field
        var client = _factory.CreateClient();
        var token = await GetAccessTokenAsync(ValidUsername, ValidPassword);
        client.DefaultRequestHeaders.Authorization = 
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        
        var createBody = JsonSerializer.Serialize(new { 
            queueId = 1, 
            phoneNumber = "+2001012345678",
            position = 1,
            status = "waiting"
        });
        
        // Act
        var response = await client.PostAsync("/api/patients", 
            new StringContent(createBody, Encoding.UTF8, "application/json"));
        
        // Assert - API SHOULD return 400 Bad Request for missing required field
        // Currently returns 500 (defect #1)
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    [Trait(TestTraits.ExpectedFail, "true")]
    [Trait(TestTraits.Category, TestTraits.ExpectedFailValue)]
    [Trait(TestTraits.BusinessRule, "Creating a patient without phoneNumber must return 400 not 500")]
    public async Task Patient_Create_WithoutPhoneNumber_ReturnsBadRequest()
    {
        // Arrange - Test that API rejects patient without required phoneNumber field
        var client = _factory.CreateClient();
        var token = await GetAccessTokenAsync(ValidUsername, ValidPassword);
        client.DefaultRequestHeaders.Authorization = 
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        
        var createBody = JsonSerializer.Serialize(new { 
            queueId = 1,
            fullName = "Ahmed Mohammed",
            position = 1,
            status = "waiting"
        });
        
        // Act
        var response = await client.PostAsync("/api/patients", 
            new StringContent(createBody, Encoding.UTF8, "application/json"));
        
        // Assert - API SHOULD return 400 Bad Request for missing required field
        // Currently returns 500 (defect)
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    [Trait(TestTraits.ExpectedFail, "true")]
    [Trait(TestTraits.Category, TestTraits.ExpectedFailValue)]
    [Trait(TestTraits.BusinessRule, "Empty fullName should trigger model validation (400) not 500 crash")]
    public async Task Patient_Create_WithEmptyFullName_ReturnsBadRequest()
    {
        // Arrange - Empty fullName should be rejected (StringLength MinimumLength = 2)
        var client = _factory.CreateClient();
        var token = await GetAccessTokenAsync(ValidUsername, ValidPassword);
        client.DefaultRequestHeaders.Authorization = 
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        
        var createBody = JsonSerializer.Serialize(new { 
            queueId = 1,
            fullName = "",
            phoneNumber = "+2001012345678",
            position = 1,
            status = "waiting"
        });
        
        // Act
        var response = await client.PostAsync("/api/patients", 
            new StringContent(createBody, Encoding.UTF8, "application/json"));
        
        // Assert - API SHOULD return 400 for validation failure
        // Currently returns 500 (defect)
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    #endregion

    #region Phone Number Validation Tests

    [Fact]
    [Trait(TestTraits.ExpectedFail, "true")]
    [Trait(TestTraits.Category, TestTraits.ExpectedFailValue)]
    [Trait(TestTraits.BusinessRule, "Empty phoneNumber should return 400 validation error")]
    public async Task Patient_Create_WithEmptyPhoneNumber_ReturnsBadRequest()
    {
        // Arrange - Empty phone should be rejected
        var client = _factory.CreateClient();
        var token = await GetAccessTokenAsync(ValidUsername, ValidPassword);
        client.DefaultRequestHeaders.Authorization = 
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        
        var createBody = JsonSerializer.Serialize(new { 
            queueId = 1,
            fullName = "Ahmed Mohammed",
            phoneNumber = "",
            position = 1,
            status = "waiting"
        });
        
        // Act
        var response = await client.PostAsync("/api/patients", 
            new StringContent(createBody, Encoding.UTF8, "application/json"));
        
        // Assert - API SHOULD return 400 for validation failure
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    [Trait(TestTraits.ExpectedFail, "true")]
    [Trait(TestTraits.Category, TestTraits.ExpectedFailValue)]
    [Trait(TestTraits.BusinessRule, "Invalid phone format should be rejected with 400 not 500")]
    public async Task Patient_Create_WithInvalidPhoneFormat_ReturnsErrorResponse()
    {
        // Arrange - Invalid phone format should fail [Phone] validation
        var client = _factory.CreateClient();
        var token = await GetAccessTokenAsync(ValidUsername, ValidPassword);
        client.DefaultRequestHeaders.Authorization = 
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        
        var createBody = JsonSerializer.Serialize(new { 
            queueId = 1,
            fullName = "Ahmed Mohammed",
            phoneNumber = "notaphone",
            position = 1,
            status = "waiting"
        });
        
        // Act
        var response = await client.PostAsync("/api/patients", 
            new StringContent(createBody, Encoding.UTF8, "application/json"));
        
        // Assert - API SHOULD return 400 for validation failure (defect: currently returns 500)
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    [Trait(TestTraits.ExpectedFail, "true")]
    [Trait(TestTraits.Category, TestTraits.ExpectedFailValue)]
    [Trait(TestTraits.BusinessRule, "Too short phone number should return 400 validation error")]
    public async Task Patient_Create_WithTooShortPhoneNumber_ReturnsErrorResponse()
    {
        // Arrange - Phone number too short should fail validation
        var client = _factory.CreateClient();
        var token = await GetAccessTokenAsync(ValidUsername, ValidPassword);
        client.DefaultRequestHeaders.Authorization = 
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        
        var createBody = JsonSerializer.Serialize(new { 
            queueId = 1,
            fullName = "Ahmed Mohammed",
            phoneNumber = "+20123",
            position = 1,
            status = "waiting"
        });
        
        // Act
        var response = await client.PostAsync("/api/patients", 
            new StringContent(createBody, Encoding.UTF8, "application/json"));
        
        // Assert - API SHOULD return 400 for validation failure (defect: currently returns 500)
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    [Trait(TestTraits.ExpectedFail, "true")]
    [Trait(TestTraits.Category, TestTraits.ExpectedFailValue)]
    [Trait(TestTraits.BusinessRule, "SQL injection attempt in phone should be rejected gracefully (400)")]
    public async Task Patient_Create_WithSQLInjectionInPhoneNumber_ReturnsErrorResponse()
    {
        // Arrange - SQL injection attempt should be rejected
        var client = _factory.CreateClient();
        var token = await GetAccessTokenAsync(ValidUsername, ValidPassword);
        client.DefaultRequestHeaders.Authorization = 
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        
        var maliciousPhone = "'; DROP TABLE Patients; --";
        var createBody = JsonSerializer.Serialize(new { 
            queueId = 1,
            fullName = "Ahmed Mohammed",
            phoneNumber = maliciousPhone,
            position = 1,
            status = "waiting"
        });
        
        // Act
        var response = await client.PostAsync("/api/patients", 
            new StringContent(createBody, Encoding.UTF8, "application/json"));
        
        // Assert - API SHOULD reject via validation (defect: currently returns 500)
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    #endregion

    #region Not Found Tests

    [Fact]
    [Trait(TestTraits.ExpectedFail, "true")]
    [Trait(TestTraits.Category, TestTraits.ExpectedFailValue)]
    [Trait(TestTraits.BusinessRule, "GET /api/patients/{id} should exist and return 404 for invalid id; currently 405")]
    public async Task Patient_Get_WithInvalidId_ReturnsNotFoundOrMethodNotAllowed()
    {
        // Arrange - Test getting a single patient by ID
        var client = _factory.CreateClient();
        var token = await GetAccessTokenAsync(ValidUsername, ValidPassword);
        client.DefaultRequestHeaders.Authorization = 
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        
        // Act
        var response = await client.GetAsync("/api/patients/99999");
        
        // Assert - API SHOULD return 404 for non-existent patient (defect: endpoint missing, returns 405)
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    #endregion

    #region Authorization Tests

    [Fact]
    public async Task Patient_Create_WithoutToken_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();
        var createBody = JsonSerializer.Serialize(new { 
            queueId = 1,
            fullName = "Ahmed Mohammed",
            phoneNumber = "+2001012345678",
            position = 1,
            status = "waiting"
        });
        
        // Act
        var response = await client.PostAsync("/api/patients", 
            new StringContent(createBody, Encoding.UTF8, "application/json"));
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Patient_Create_WithInvalidToken_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = 
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", "invalid.token.here");
        
        var createBody = JsonSerializer.Serialize(new { 
            queueId = 1,
            fullName = "Ahmed Mohammed",
            phoneNumber = "+2001012345678",
            position = 1,
            status = "waiting"
        });
        
        // Act
        var response = await client.PostAsync("/api/patients", 
            new StringContent(createBody, Encoding.UTF8, "application/json"));
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    #endregion

    #region Edge Case Tests

    [Fact]
    [Trait(TestTraits.ExpectedFail, "true")]
    [Trait(TestTraits.Category, TestTraits.ExpectedFailValue)]
    [Trait(TestTraits.BusinessRule, "Very long fullName must be rejected by length validation (400)")]
    public async Task Patient_Create_WithVeryLongFullName_ReturnsErrorResponse()
    {
        // Arrange - Full name exceeds max length (100 characters)
        var client = _factory.CreateClient();
        var token = await GetAccessTokenAsync(ValidUsername, ValidPassword);
        client.DefaultRequestHeaders.Authorization = 
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        
        var veryLongName = new string('A', 1000);
        var createBody = JsonSerializer.Serialize(new { 
            queueId = 1,
            fullName = veryLongName,
            phoneNumber = "+2001012345678",
            position = 1,
            status = "waiting"
        });
        
        // Act
        var response = await client.PostAsync("/api/patients", 
            new StringContent(createBody, Encoding.UTF8, "application/json"));
        
        // Assert - API SHOULD reject due to StringLength validation (defect: currently returns 500)
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    [Trait(TestTraits.ExpectedFail, "true")]
    [Trait(TestTraits.Category, TestTraits.ExpectedFailValue)]
    [Trait(TestTraits.BusinessRule, "Invalid queueId should return 400/404 not 500")]
    public async Task Patient_Create_WithInvalidQueueId_ReturnsErrorResponse()
    {
        // Arrange - Non-existent queue should be rejected
        var client = _factory.CreateClient();
        var token = await GetAccessTokenAsync(ValidUsername, ValidPassword);
        client.DefaultRequestHeaders.Authorization = 
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        
        var createBody = JsonSerializer.Serialize(new { 
            queueId = 99999,
            fullName = "Ahmed Mohammed",
            phoneNumber = "+2001012345678",
            position = 1,
            status = "waiting"
        });
        
        // Act
        var response = await client.PostAsync("/api/patients", 
            new StringContent(createBody, Encoding.UTF8, "application/json"));
        
        // Assert - API SHOULD return 400 or 404 (defect: currently returns 500 or accepts invalid queue)
        response.StatusCode.Should().BeOneOf(HttpStatusCode.BadRequest, HttpStatusCode.NotFound);
    }

    #endregion
}
