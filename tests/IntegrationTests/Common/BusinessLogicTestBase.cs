using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Xunit;
using Clinics.Api;
using Clinics.Api.Services;
using Clinics.Infrastructure;
using Clinics.Tests.Common;
using IntegrationTests.Common;

namespace Clinics.IntegrationTests.Common
{
    /// <summary>
    /// Shared database fixture for integration tests.
    /// Ensures database is seeded ONCE per test collection, not per test class.
    /// Prevents infinite seeding loops and database bloat.
    /// In CI (SQL Server): Uses existing database without deletion/recreation.
    /// Locally (in-memory): Creates and seeds fresh database.
    /// </summary>
    public class DatabaseFixture : IAsyncLifetime
    {
        private readonly CustomWebApplicationFactory<Program> _factory;
        private bool _isInitialized = false;
        private readonly bool _useSqlServer;

        public DatabaseFixture()
        {
            _factory = new CustomWebApplicationFactory<Program>();
            _useSqlServer = !string.IsNullOrEmpty(Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection"));
        }

        public CustomWebApplicationFactory<Program> Factory => _factory;

        public async Task InitializeAsync()
        {
            if (_isInitialized)
                return;

            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var logger = scope.ServiceProvider.GetRequiredService<ILogger<DbSeeder>>();

            if (_useSqlServer)
            {
                // CI environment: Database already exists with migrations applied
                // Just verify we can connect
                await db.Database.CanConnectAsync();
            }
            else
            {
                // Local development: Use in-memory database
                // Clear any existing data to ensure clean state
                await db.Database.EnsureDeletedAsync();
                await db.Database.EnsureCreatedAsync();
            }

            // Seed database ONCE (idempotent - skips if already seeded)
            var seeder = new DbSeeder(db, logger);
            await seeder.SeedAsync();

            _isInitialized = true;
        }

        public async Task DisposeAsync()
        {
            // Only clean up in-memory database (don't touch SQL Server in CI)
            if (!_useSqlServer)
            {
                using var scope = _factory.Services.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                await db.Database.EnsureDeletedAsync();
            }
        }
    }

    /// <summary>
    /// Collection definition for tests sharing database state.
    /// </summary>
    [CollectionDefinition("Database collection")]
    public class DatabaseCollection : ICollectionFixture<DatabaseFixture>
    {
        // This class has no code, and never creates an instance of itself.
        // It's used by xUnit to define and group fixtures.
    }

    /// <summary>
    /// Base class for business logic integration tests.
    /// Provides common test infrastructure: Clock, Builders, Logging, HTTP helpers.
    /// Uses shared DatabaseFixture to avoid repeated seeding.
    /// Automatically injects auth headers for [Authorize] endpoints.
    /// </summary>
    [Collection("Database collection")]
    public abstract class BusinessLogicTestBase
    {
        protected readonly CustomWebApplicationFactory<Program> Factory;
        protected readonly HttpClient Client;
        protected TestClock TestClock { get; set; }
        private static readonly object _tokenLock = new object();
        private static string? _cachedAccessToken;

        // Builders
        protected ClinicDtoBuilder ClinicBuilder => new();
        protected PatientDtoBuilder PatientBuilder => new();
        protected AppointmentDtoBuilder AppointmentBuilder => new();
        protected ConditionDtoBuilder ConditionBuilder => new();
        protected LoginRequestBuilder LoginBuilder => new();

        // Test credentials
        private const string TestUsername = "admin";
        private const string TestPassword = "admin123";

        protected BusinessLogicTestBase(DatabaseFixture databaseFixture)
        {
            Factory = databaseFixture.Factory;
            Client = Factory.CreateClient();
            TestClock = new TestClock();
        }

        /// <summary>
        /// Initialize auth headers for API requests.
        /// Must be called before making requests to [Authorize] endpoints.
        /// </summary>
        protected async Task InitializeAuthAsync()
        {
            lock (_tokenLock)
            {
                if (!string.IsNullOrEmpty(_cachedAccessToken))
                {
                    Client.DefaultRequestHeaders.Authorization = 
                        new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _cachedAccessToken);
                    return;
                }
            }

            // Get fresh token
            var token = await GetAccessTokenAsync(TestUsername, TestPassword);
            
            lock (_tokenLock)
            {
                _cachedAccessToken = token;
            }
            
            Client.DefaultRequestHeaders.Authorization = 
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
        }

        /// <summary>
        /// Retrieve access token via login endpoint.
        /// </summary>
        private async Task<string> GetAccessTokenAsync(string username, string password)
        {
            var loginClient = Factory.CreateClient();
            var loginBody = System.Text.Json.JsonSerializer.Serialize(new { username, password });
            var response = await loginClient.PostAsync("/api/auth/login", 
                new StringContent(loginBody, System.Text.Encoding.UTF8, "application/json"));
            
            if (!response.IsSuccessStatusCode)
                throw new InvalidOperationException($"Login failed with status {response.StatusCode}");
            
            var json = System.Text.Json.JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            var token = json.RootElement
                .GetProperty("data")
                .GetProperty("accessToken")
                .GetString();
            
            return token ?? throw new InvalidOperationException("Access token not found in login response");
        }

        /// <summary>
        /// Get a logger for the current test.
        /// </summary>
        protected ILogger<T> GetLogger<T>()
        {
            var scope = Factory.Services.CreateScope();
            return scope.ServiceProvider.GetRequiredService<ILogger<T>>();
        }

        /// <summary>
        /// Helper: Make an HTTP POST request with JSON body.
        /// </summary>
        protected async Task<HttpResponseMessage> PostAsync(string path, object body)
        {
            var content = new StringContent(
                System.Text.Json.JsonSerializer.Serialize(body),
                System.Text.Encoding.UTF8,
                "application/json"
            );
            return await Client.PostAsync(path, content);
        }

        /// <summary>
        /// Helper: Make an HTTP GET request.
        /// </summary>
        protected async Task<HttpResponseMessage> GetAsync(string path)
        {
            return await Client.GetAsync(path);
        }

        /// <summary>
        /// Helper: Make an HTTP PUT request with JSON body.
        /// </summary>
        protected async Task<HttpResponseMessage> PutAsync(string path, object body)
        {
            var content = new StringContent(
                System.Text.Json.JsonSerializer.Serialize(body),
                System.Text.Encoding.UTF8,
                "application/json"
            );
            return await Client.PutAsync(path, content);
        }

        /// <summary>
        /// Helper: Make an HTTP PATCH request with JSON body.
        /// </summary>
        protected async Task<HttpResponseMessage> PatchAsync(string path, object body)
        {
            var content = new StringContent(
                System.Text.Json.JsonSerializer.Serialize(body),
                System.Text.Encoding.UTF8,
                "application/json"
            );
            var request = new HttpRequestMessage(HttpMethod.Patch, path) { Content = content };
            return await Client.SendAsync(request);
        }

        /// <summary>
        /// Helper: Make an HTTP DELETE request.
        /// </summary>
        protected async Task<HttpResponseMessage> DeleteAsync(string path)
        {
            return await Client.DeleteAsync(path);
        }

        /// <summary>
        /// Helper: Make DELETE request with body (for APIs that support it).
        /// </summary>
        protected async Task<HttpResponseMessage> DeleteAsync(string path, object body)
        {
            var request = new HttpRequestMessage(HttpMethod.Delete, path)
            {
                Content = new StringContent(
                    System.Text.Json.JsonSerializer.Serialize(body),
                    System.Text.Encoding.UTF8,
                    "application/json"
                )
            };
            return await Client.SendAsync(request);
        }

        /// <summary>
        /// Helper: Parse JSON response body.
        /// </summary>
        protected async Task<System.Text.Json.JsonDocument> ParseResponse(HttpResponseMessage response)
        {
            var json = await response.Content.ReadAsStringAsync();
            return System.Text.Json.JsonDocument.Parse(json);
        }

        /// <summary>
        /// Helper: Extract success flag from API response.
        /// </summary>
        protected bool IsSuccessResponse(System.Text.Json.JsonElement root)
        {
            if (root.TryGetProperty("success", out var successProp))
                return successProp.GetBoolean();
            return false;
        }

        /// <summary>
        /// Helper: Extract data object from API response.
        /// </summary>
        protected System.Text.Json.JsonElement? GetDataFromResponse(System.Text.Json.JsonElement root)
        {
            if (root.TryGetProperty("data", out var data))
                return data;
            return null;
        }

        /// <summary>
        /// Helper: Safely get int from JsonElement property.
        /// </summary>
        protected int GetInt(System.Text.Json.JsonElement element, string propertyName, int defaultValue = 0)
        {
            if (element.TryGetProperty(propertyName, out var prop) && prop.TryGetInt32(out var value))
                return value;
            return defaultValue;
        }

        /// <summary>
        /// Helper: Safely get string from JsonElement property.
        /// </summary>
        protected string? GetString(System.Text.Json.JsonElement element, string propertyName)
        {
            if (element.TryGetProperty(propertyName, out var prop))
                return prop.GetString();
            return null;
        }

        /// <summary>
        /// Helper: Safely get bool from JsonElement property.
        /// </summary>
        protected bool GetBool(System.Text.Json.JsonElement element, string propertyName, bool defaultValue = false)
        {
            if (element.TryGetProperty(propertyName, out var prop) && prop.ValueKind == System.Text.Json.JsonValueKind.True)
                return true;
            if (element.TryGetProperty(propertyName, out var prop2) && prop2.ValueKind == System.Text.Json.JsonValueKind.False)
                return false;
            return defaultValue;
        }

        /// <summary>
        /// Helper: Get nested object from JsonElement property.
        /// </summary>
        protected System.Text.Json.JsonElement? GetNestedObject(System.Text.Json.JsonElement element, string propertyName)
        {
            if (element.TryGetProperty(propertyName, out var prop))
                return prop;
            return null;
        }

        /// <summary>
        /// Helper: Get int from nested object property (handles { queue: { id: 123 } } patterns).
        /// </summary>
        protected int GetIntFromNested(System.Text.Json.JsonElement element, string nestedObjectName, string propertyName, int defaultValue = 0)
        {
            if (element.TryGetProperty(nestedObjectName, out var nestedObj))
            {
                if (nestedObj.TryGetProperty(propertyName, out var prop) && prop.TryGetInt32(out var value))
                    return value;
            }
            return defaultValue;
        }

        /// <summary>
        /// Helper: Get string from nested object property.
        /// </summary>
        protected string? GetStringFromNested(System.Text.Json.JsonElement element, string nestedObjectName, string propertyName)
        {
            if (element.TryGetProperty(nestedObjectName, out var nestedObj))
            {
                if (nestedObj.TryGetProperty(propertyName, out var prop))
                    return prop.GetString();
            }
            return null;
        }
    }
}
