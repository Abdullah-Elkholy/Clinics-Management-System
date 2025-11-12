using System;
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
    /// Base class for business logic integration tests.
    /// Provides common test infrastructure: Clock, Builders, Logging, Database seeding.
    /// </summary>
    public abstract class BusinessLogicTestBase : IClassFixture<CustomWebApplicationFactory<Program>>, IAsyncLifetime
    {
        protected readonly CustomWebApplicationFactory<Program> Factory;
        protected readonly HttpClient Client;
        protected TestClock TestClock { get; set; }

        // Builders
        protected ClinicDtoBuilder ClinicBuilder => new();
        protected PatientDtoBuilder PatientBuilder => new();
        protected AppointmentDtoBuilder AppointmentBuilder => new();
        protected ConditionDtoBuilder ConditionBuilder => new();
        protected LoginRequestBuilder LoginBuilder => new();

        protected BusinessLogicTestBase(CustomWebApplicationFactory<Program> factory)
        {
            Factory = factory;
            Client = Factory.CreateClient();
            TestClock = new TestClock();
        }

        public virtual async Task InitializeAsync()
        {
            // Seed test data
            await SeedTestData();
        }

        public virtual Task DisposeAsync()
        {
            Client?.Dispose();
            return Task.CompletedTask;
        }

        /// <summary>
        /// Override in subclass to seed test-specific data.
        /// </summary>
        protected virtual async Task SeedTestData()
        {
            using var scope = Factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var logger = scope.ServiceProvider.GetRequiredService<ILogger<DbSeeder>>();
            var seeder = new DbSeeder(db, logger);
            await seeder.SeedAsync();
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
        /// Helper: Make an HTTP DELETE request.
        /// </summary>
        protected async Task<HttpResponseMessage> DeleteAsync(string path)
        {
            return await Client.DeleteAsync(path);
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
            return root.TryGetProperty("success", out var successProp) && successProp.GetBoolean();
        }

        /// <summary>
        /// Helper: Extract data object from API response.
        /// </summary>
        protected System.Text.Json.JsonElement? GetDataFromResponse(System.Text.Json.JsonElement root)
        {
            return root.TryGetProperty("data", out var data) ? data : null;
        }
    }
}
