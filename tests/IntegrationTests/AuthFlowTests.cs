using System.Net.Http.Headers;
using System.Net.Http;
using Microsoft.EntityFrameworkCore;
using System.Linq;
using System.Collections.Generic;
using Microsoft.Extensions.Configuration;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using Clinics.Infrastructure;
using IntegrationTests.Common;

namespace IntegrationTests;

public class AuthFlowTests : IClassFixture<CustomWebApplicationFactory<Program>>
{
    private readonly CustomWebApplicationFactory<Program> _factory;

    public AuthFlowTests(CustomWebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Login_Refresh_GetUsers_AdminFlow()
    {
        var client = _factory.CreateClient();

        // Seed the database with a test user and moderator (FK support)
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            db.Database.EnsureCreated();
            
            // Create primary admin first
            var admin = TestDataFactory.CreatePrimaryAdmin(id: 1);
            var hasher = new Microsoft.AspNetCore.Identity.PasswordHasher<Clinics.Domain.User>();
            admin.PasswordHash = hasher.HashPassword(admin, "Admin123!");
            db.Users.Add(admin);
            db.SaveChanges();
        }

        // Login
        var loginBody = JsonSerializer.Serialize(new { username = "admin", password = "Admin123!" });
        var resp = await client.PostAsync("/api/auth/login", new StringContent(loginBody, Encoding.UTF8, "application/json"));
        
        resp.EnsureSuccessStatusCode();
        
        var json = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        var accessToken = json.RootElement.GetProperty("data").GetProperty("accessToken").GetString();
        accessToken.Should().NotBeNullOrEmpty();

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        // Call admin endpoint
        var usersResp = await client.GetAsync("/api/users");
        usersResp.EnsureSuccessStatusCode();
        var usersJson = await usersResp.Content.ReadAsStringAsync();
        usersJson.Should().Contain("admin");
    }
}
