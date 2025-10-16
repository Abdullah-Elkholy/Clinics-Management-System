using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace IntegrationTests;

public class E2ETests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public E2ETests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task FullFlow_AgainstRealSql_OnlyRunsWhenEnvSet()
    {
        var run = Environment.GetEnvironmentVariable("RUN_E2E");
        if (string.IsNullOrEmpty(run) || run.ToLower() != "true")
        {
            // Skip test when not explicitly enabled
            return;
        }

        var conn = Environment.GetEnvironmentVariable("E2E_CONNECTION") ?? "Server=BODYELKHOLY\\SQL2022;Database=ClinicsDb;User Id=sa;Password=123456;TrustServerCertificate=True;";

        var factory = _factory.WithWebHostBuilder(builder => {
            builder.ConfigureAppConfiguration((context, conf) => {
                var dict = new System.Collections.Generic.Dictionary<string,string>() {
                    ["USE_LOCAL_SQL"] = "true",
                    ["LocalSqlServer"] = conn,
                    ["SEED_ADMIN"] = "true",
                    ["Jwt:Key"] = "TestKeyForE2E_ReplaceInProd_1234567890"
                };
                conf.AddInMemoryCollection(dict);
            });
        });

        var client = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });

        // Ensure migrations are applied by calling the endpoint that needs DB, or trigger migrations via startup
        // Perform login
        var loginBody = JsonSerializer.Serialize(new { username = "admin", password = "Admin123!" });
        var resp = await client.PostAsync("/api/auth/login", new StringContent(loginBody, Encoding.UTF8, "application/json"));
        resp.EnsureSuccessStatusCode();
        var json = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        var accessToken = json.RootElement.GetProperty("data").GetProperty("AccessToken").GetString();
        accessToken.Should().NotBeNullOrEmpty();

        // Call users
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);
        var usersResp = await client.GetAsync("/api/users");
        usersResp.EnsureSuccessStatusCode();
    }
}
