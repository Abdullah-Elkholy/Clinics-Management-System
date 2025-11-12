using Microsoft.Extensions.Configuration;
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

public class QueueCrudTests : IClassFixture<CustomWebApplicationFactory<Program>>, IAsyncLifetime
{
    private readonly CustomWebApplicationFactory<Program> _factory;

    public QueueCrudTests(CustomWebApplicationFactory<Program> factory)
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

    [Fact]
    [Trait("ExpectedToFail", "true")]
    [Trait("Category", "ExpectedToFail")]
    [Trait("BusinessRule", "Soft-deleted queue should not be retrievable; GET after delete should return 404 due to soft-delete filtering")] 
    public async Task Queue_CRUD_Flow_Works()
    {
        var client = _factory.CreateClient();

        // First, login to get an access token using seeded admin credentials
        var loginBody = JsonSerializer.Serialize(new { username = "admin", password = "admin123" });
        var loginResp = await client.PostAsync("/api/auth/login", new StringContent(loginBody, Encoding.UTF8, "application/json"));
        loginResp.EnsureSuccessStatusCode();
        var loginJson = JsonDocument.Parse(await loginResp.Content.ReadAsStringAsync());
        var accessToken = loginJson.RootElement.GetProperty("data").GetProperty("accessToken").GetString();
        accessToken.Should().NotBeNullOrEmpty();

        // Add authorization header for all subsequent requests
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

        // Create queue
        var createBody = JsonSerializer.Serialize(new { doctorName = "Dr. Test", description = "desc", createdBy = 1, estimatedWaitMinutes = 5 });
        var createResp = await client.PostAsync("/api/queues", new StringContent(createBody, Encoding.UTF8, "application/json"));
        createResp.EnsureSuccessStatusCode();
        var createJson = JsonDocument.Parse(await createResp.Content.ReadAsStringAsync());
        createJson.RootElement.GetProperty("success").GetBoolean().Should().BeTrue();
        var createdQueue = createJson.RootElement.GetProperty("queue");
        var id = createdQueue.GetProperty("id").GetInt32();
        id.Should().BeGreaterThan(0);

        // Get All
        var listResp = await client.GetAsync("/api/queues");
        listResp.EnsureSuccessStatusCode();
        var listJson = JsonDocument.Parse(await listResp.Content.ReadAsStringAsync());
        listJson.RootElement.GetProperty("success").GetBoolean().Should().BeTrue();
        var arr = listJson.RootElement.GetProperty("data");
        arr.GetArrayLength().Should().BeGreaterOrEqualTo(1);

        // Get single
        var getResp = await client.GetAsync($"/api/queues/{id}");
        getResp.EnsureSuccessStatusCode();
        var getJson = JsonDocument.Parse(await getResp.Content.ReadAsStringAsync());
        getJson.RootElement.GetProperty("success").GetBoolean().Should().BeTrue();
        getJson.RootElement.GetProperty("data").GetProperty("doctorName").GetString().Should().Be("Dr. Test");

        // Update
        var updateBody = JsonSerializer.Serialize(new { doctorName = "Dr. Updated", description = "newdesc", estimatedWaitMinutes = 10, currentPosition = 2 });
        var updateResp = await client.PutAsync($"/api/queues/{id}", new StringContent(updateBody, Encoding.UTF8, "application/json"));
        updateResp.EnsureSuccessStatusCode();
        var updateJson = JsonDocument.Parse(await updateResp.Content.ReadAsStringAsync());
        updateJson.RootElement.GetProperty("success").GetBoolean().Should().BeTrue();

        // Verify updated via get
        var get2 = await client.GetAsync($"/api/queues/{id}");
        get2.EnsureSuccessStatusCode();
        var get2Json = JsonDocument.Parse(await get2.Content.ReadAsStringAsync());
        get2Json.RootElement.GetProperty("data").GetProperty("doctorName").GetString().Should().Be("Dr. Updated");

        // Delete
        var del = await client.DeleteAsync($"/api/queues/{id}");
        del.EnsureSuccessStatusCode();
        var delJson = JsonDocument.Parse(await del.Content.ReadAsStringAsync());
        delJson.RootElement.GetProperty("success").GetBoolean().Should().BeTrue();

        // Ensure not found
        var getDeleted = await client.GetAsync($"/api/queues/{id}");
        getDeleted.StatusCode.Should().Be(System.Net.HttpStatusCode.NotFound);
    }
}
