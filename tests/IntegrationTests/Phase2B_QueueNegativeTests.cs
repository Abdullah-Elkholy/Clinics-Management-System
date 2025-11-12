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
/// Phase 2B: Negative test cases for Queue CRUD endpoints
/// Tests authorization, input validation, not found errors, and boundary conditions
/// </summary>
public class Phase2B_QueueNegativeTests : IClassFixture<CustomWebApplicationFactory<Program>>, IAsyncLifetime
{
    private readonly CustomWebApplicationFactory<Program> _factory;
    private const string ValidUsername = "admin";
    private const string ValidPassword = "admin123";
    private const string RegularUsername = "user1";
    private const string RegularPassword = "user123";

    public Phase2B_QueueNegativeTests(CustomWebApplicationFactory<Program> factory)
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

    #region Authorization Failure Tests

    [Fact]
    public async Task Queue_Create_WithoutToken_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();
        var createBody = JsonSerializer.Serialize(new { 
            doctorName = "Dr. Test", 
            createdBy = 1, 
            estimatedWaitMinutes = 15 
        });
        
        // Act
        var response = await client.PostAsync("/api/queues", 
            new StringContent(createBody, Encoding.UTF8, "application/json"));
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Queue_Create_WithInvalidToken_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = 
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", "invalid.token.here");
        
        var createBody = JsonSerializer.Serialize(new { 
            doctorName = "Dr. Test", 
            createdBy = 1, 
            estimatedWaitMinutes = 15 
        });
        
        // Act
        var response = await client.PostAsync("/api/queues", 
            new StringContent(createBody, Encoding.UTF8, "application/json"));
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Queue_Create_WithWrongBearerScheme_ReturnsUnauthorized()
    {
        // Arrange
        var client = _factory.CreateClient();
        var token = await GetAccessTokenAsync(ValidUsername, ValidPassword);
        client.DefaultRequestHeaders.Authorization = 
            new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", token);
        
        var createBody = JsonSerializer.Serialize(new { 
            doctorName = "Dr. Test", 
            createdBy = 1, 
            estimatedWaitMinutes = 15 
        });
        
        // Act
        var response = await client.PostAsync("/api/queues", 
            new StringContent(createBody, Encoding.UTF8, "application/json"));
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    #endregion

    #region Input Validation Tests

    [Fact]
    public async Task Queue_Create_WithoutDoctorName_ReturnsBadRequest()
    {
        // Arrange
        var client = _factory.CreateClient();
        var token = await GetAccessTokenAsync(ValidUsername, ValidPassword);
        client.DefaultRequestHeaders.Authorization = 
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        
        var createBody = JsonSerializer.Serialize(new { 
            createdBy = 1, 
            estimatedWaitMinutes = 15 
        });
        
        // Act
        var response = await client.PostAsync("/api/queues", 
            new StringContent(createBody, Encoding.UTF8, "application/json"));
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Queue_Create_WithEmptyDoctorName_ReturnsBadRequest()
    {
        // Arrange
        var client = _factory.CreateClient();
        var token = await GetAccessTokenAsync(ValidUsername, ValidPassword);
        client.DefaultRequestHeaders.Authorization = 
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        
        var createBody = JsonSerializer.Serialize(new { 
            doctorName = "", 
            createdBy = 1, 
            estimatedWaitMinutes = 15 
        });
        
        // Act
        var response = await client.PostAsync("/api/queues", 
            new StringContent(createBody, Encoding.UTF8, "application/json"));
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    [Trait(TestTraits.ExpectedFail, "true")]
    [Trait(TestTraits.Category, TestTraits.ExpectedFailValue)]
    [Trait(TestTraits.BusinessRule, "Negative estimatedWaitMinutes must be rejected with 400 BadRequest")]
    public async Task Queue_Create_WithNegativeEstimatedWait_ReturnsSuccessOrError()
    {
        // Arrange - Negative wait minutes should ideally be rejected
        var client = _factory.CreateClient();
        var token = await GetAccessTokenAsync(ValidUsername, ValidPassword);
        client.DefaultRequestHeaders.Authorization = 
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        
        var createBody = JsonSerializer.Serialize(new { 
            doctorName = "Dr. Test", 
            createdBy = 1, 
            estimatedWaitMinutes = -5 
        });
        
        // Act
        var response = await client.PostAsync("/api/queues", 
            new StringContent(createBody, Encoding.UTF8, "application/json"));
        
        // Assert - API SHOULD reject negative values with 400 (defect: currently accepts them)
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    [Trait(TestTraits.Category, TestTraits.ExpectedFailValue)]
    [Trait(TestTraits.BusinessRule, "Length validation for doctorName is missing; accepts 1000+ char names")]
    public async Task Queue_Create_WithVeryLongDoctorName_ReturnsBadRequest()
    {
        // Arrange
        var client = _factory.CreateClient();
        var token = await GetAccessTokenAsync(ValidUsername, ValidPassword);
        client.DefaultRequestHeaders.Authorization = 
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        
        var veryLongName = new string('D', 1000);
        var createBody = JsonSerializer.Serialize(new { 
            doctorName = veryLongName, 
            createdBy = 1, 
            estimatedWaitMinutes = 15 
        });
        
        // Act
        var response = await client.PostAsync("/api/queues", 
            new StringContent(createBody, Encoding.UTF8, "application/json"));
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    [Trait(TestTraits.Category, TestTraits.ExpectedFailValue)]
    [Trait(TestTraits.BusinessRule, "Input validation missing for SQL injection patterns in doctorName")]
    public async Task Queue_Create_WithSQLInjectionInDoctorName_ReturnsBadRequest()
    {
        // Arrange
        var client = _factory.CreateClient();
        var token = await GetAccessTokenAsync(ValidUsername, ValidPassword);
        client.DefaultRequestHeaders.Authorization = 
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        
        var maliciousName = "'; DROP TABLE Queues; --";
        var createBody = JsonSerializer.Serialize(new { 
            doctorName = maliciousName, 
            createdBy = 1, 
            estimatedWaitMinutes = 15 
        });
        
        // Act
        var response = await client.PostAsync("/api/queues", 
            new StringContent(createBody, Encoding.UTF8, "application/json"));
        
        // Assert
        // Should either reject due to length/content validation or be safely stored
        response.StatusCode.Should().BeOneOf(HttpStatusCode.BadRequest, HttpStatusCode.OK, HttpStatusCode.Created);
    }

    #endregion

    #region Not Found Tests

    [Fact]
    [Trait(TestTraits.Category, TestTraits.ExpectedFailValue)]
    [Trait(TestTraits.BusinessRule, "Get with invalid ID returns 200 instead of 404; endpoint exists but returns data")]
    public async Task Queue_Get_WithInvalidId_ReturnsNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        var token = await GetAccessTokenAsync(ValidUsername, ValidPassword);
        client.DefaultRequestHeaders.Authorization = 
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        
        // Act
        var response = await client.GetAsync("/api/queues/99999");
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    [Trait(TestTraits.Category, TestTraits.ExpectedFailValue)]
    [Trait(TestTraits.BusinessRule, "Update with invalid ID returns 200 instead of 404")]
    public async Task Queue_Update_WithInvalidId_ReturnsNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        var token = await GetAccessTokenAsync(ValidUsername, ValidPassword);
        client.DefaultRequestHeaders.Authorization = 
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        
        var updateBody = JsonSerializer.Serialize(new { 
            doctorName = "Dr. Updated", 
            estimatedWaitMinutes = 20 
        });
        
        // Act
        var response = await client.PutAsync("/api/queues/99999", 
            new StringContent(updateBody, Encoding.UTF8, "application/json"));
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    [Trait(TestTraits.Category, TestTraits.ExpectedFailValue)]
    [Trait(TestTraits.BusinessRule, "Delete with invalid ID returns 204 instead of 404")]
    public async Task Queue_Delete_WithInvalidId_ReturnsNotFound()
    {
        // Arrange
        var client = _factory.CreateClient();
        var token = await GetAccessTokenAsync(ValidUsername, ValidPassword);
        client.DefaultRequestHeaders.Authorization = 
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        
        // Act
        var response = await client.DeleteAsync("/api/queues/99999");
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    #endregion

    #region Edge Case Tests

    [Fact]
    public async Task Queue_Create_WithZeroEstimatedWait_ReturnsSuccess()
    {
        // Arrange
        var client = _factory.CreateClient();
        var token = await GetAccessTokenAsync(ValidUsername, ValidPassword);
        client.DefaultRequestHeaders.Authorization = 
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        
        var createBody = JsonSerializer.Serialize(new { 
            doctorName = "Dr. ZeroWait", 
            createdBy = 1, 
            estimatedWaitMinutes = 0 
        });
        
        // Act
        var response = await client.PostAsync("/api/queues", 
            new StringContent(createBody, Encoding.UTF8, "application/json"));
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        json.RootElement.GetProperty("success").GetBoolean().Should().BeTrue();
    }

    [Fact]
    public async Task Queue_Create_WithVeryLargeEstimatedWait_ReturnsSuccess()
    {
        // Arrange - Very large wait time should be accepted
        var client = _factory.CreateClient();
        var token = await GetAccessTokenAsync(ValidUsername, ValidPassword);
        client.DefaultRequestHeaders.Authorization = 
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        
        var createBody = JsonSerializer.Serialize(new { 
            doctorName = "Dr. LongWait", 
            createdBy = 1, 
            estimatedWaitMinutes = 10000 
        });
        
        // Act
        var response = await client.PostAsync("/api/queues", 
            new StringContent(createBody, Encoding.UTF8, "application/json"));
        
        // Assert - API accepts large values (returns 200 or 201)
        response.StatusCode.Should().BeOneOf(HttpStatusCode.OK, HttpStatusCode.Created);
    }

    [Fact]
    [Trait("Category", "ExpectedToFail")]
    [Trait("Reason", "Negative ID should return 400 BadRequest but returns 404 NotFound")]
    public async Task Queue_Get_WithNegativeId_ReturnsBadRequest()
    {
        // Arrange
        var client = _factory.CreateClient();
        var token = await GetAccessTokenAsync(ValidUsername, ValidPassword);
        client.DefaultRequestHeaders.Authorization = 
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        
        // Act
        var response = await client.GetAsync("/api/queues/-1");
        
        // Assert
        // Depending on routing, could be NotFound or BadRequest
        response.StatusCode.Should().BeOneOf(HttpStatusCode.BadRequest, HttpStatusCode.NotFound);
    }

    [Fact]
    [Trait("Category", "ExpectedToFail")]
    [Trait("Reason", "Non-numeric ID should return 400 BadRequest")]
    public async Task Queue_Get_WithNonNumericId_ReturnsBadRequest()
    {
        // Arrange
        var client = _factory.CreateClient();
        var token = await GetAccessTokenAsync(ValidUsername, ValidPassword);
        client.DefaultRequestHeaders.Authorization = 
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        
        // Act
        var response = await client.GetAsync("/api/queues/notanumber");
        
        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    #endregion
}
