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

namespace IntegrationTests;

public class AuthFlowTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

        public AuthFlowTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder => {
            builder.ConfigureAppConfiguration((context, conf) => {
                var dict = new Dictionary<string, string>
                {
                    ["USE_LOCAL_SQL"] = "false",
                    ["Jwt:Key"] = "TestKey_ThisIsALongerKeyForHmacSha256_ReplaceInProduction_123456"
                };
                conf.AddInMemoryCollection(dict);
            });
        });
    }

    [Fact]
    public async Task Login_Refresh_GetUsers_AdminFlow()
    {
        var client = _factory.CreateClient();

        // Ensure SEED_ADMIN is true for tests via environment (we can't easily set env here, so create admin user directly via DbContext)
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<Clinics.Infrastructure.ApplicationDbContext>();
            if (!db.Roles.Any(r => r.Name == "primary_admin"))
            {
                var r = new Clinics.Domain.Role { Name = "primary_admin", DisplayName = "admin" };
                db.Roles.Add(r);
                db.SaveChanges();
                var admin = new Clinics.Domain.User { Username = "testadmin", FullName = "Test Admin", RoleId = r.Id };
                var hasher = new Microsoft.AspNetCore.Identity.PasswordHasher<Clinics.Domain.User>();
                admin.PasswordHash = hasher.HashPassword(admin, "Admin123!");
                db.Users.Add(admin);
                db.SaveChanges();
            }
        }

        // Login
        var loginBody = JsonSerializer.Serialize(new { username = "testadmin", password = "Admin123!" });
        var resp = await client.PostAsync("/api/auth/login", new StringContent(loginBody, Encoding.UTF8, "application/json"));
        resp.EnsureSuccessStatusCode();
        var json = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        var accessToken = json.RootElement.GetProperty("data").GetProperty("AccessToken").GetString();
        accessToken.Should().NotBeNullOrEmpty();

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        // Call admin endpoint
        var usersResp = await client.GetAsync("/api/users");
        usersResp.EnsureSuccessStatusCode();
        var usersJson = await usersResp.Content.ReadAsStringAsync();
        usersJson.Should().Contain("testadmin");
    }
}
