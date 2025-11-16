using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Clinics.Infrastructure;
using Clinics.Api.Services;
using Hangfire;
using Hangfire.MemoryStorage;

namespace IntegrationTests.Common;

/// <summary>
/// Custom WebApplicationFactory for integration tests.
/// Configures the test host to:
/// - Use SQL Server when ConnectionStrings__DefaultConnection env var is set (CI environment)
/// - Use in-memory database for local development (when no connection string is provided)
/// - Use Hangfire in-memory storage (not SQL Server)
/// - Override JWT configuration with test key
/// - Disable real external services
/// </summary>
public class CustomWebApplicationFactory<TProgram> : WebApplicationFactory<TProgram> where TProgram : class
{
    // Create unique database name per factory instance for test isolation
    private readonly string _dbName = $"IntegrationTestDb_{Guid.NewGuid():N}";
    
    // Track if seeding has already happened for this factory instance
    private bool _seeded = false;
    
    // Check if we should use SQL Server (CI environment) or in-memory (local development)
    private readonly string? _connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
    
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.ConfigureServices(services =>
        {
            // Remove the production DB context
            var dbContextDescriptor = services.SingleOrDefault(
                d => d.ServiceType == typeof(DbContextOptions<ApplicationDbContext>));
            
            if (dbContextDescriptor != null)
                services.Remove(dbContextDescriptor);

            // Remove Hangfire SqlServerStorage
            var hangfireDescriptors = services
                .Where(d => d.ServiceType?.FullName?.Contains("Hangfire") ?? false)
                .ToList();
            
            foreach (var descriptor in hangfireDescriptors)
                services.Remove(descriptor);

            // Add test database context 
            // Use SQL Server if connection string is provided (CI), otherwise use in-memory (local dev)
            services.AddDbContext<ApplicationDbContext>((sp, options) =>
            {
                if (!string.IsNullOrEmpty(_connectionString))
                {
                    // CI environment: Use SQL Server with provided connection string
                    options.UseSqlServer(_connectionString, sqlOptions => 
                    {
                        sqlOptions.CommandTimeout(60);
                        sqlOptions.EnableRetryOnFailure(maxRetryCount: 3);
                    });
                }
                else
                {
                    // Local development: Use in-memory database with unique name per factory
                    // Configure to suppress transaction warnings since in-memory DB doesn't support transactions
                    options.UseInMemoryDatabase(_dbName)
                        .ConfigureWarnings(x => x.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning));
                }
            });

            // Add Hangfire with in-memory storage
            // NOTE: We do NOT add AddHangfireServer() because it causes timeout/cleanup issues in tests
            services.AddHangfire(config => config.UseMemoryStorage());

            // Override JWT settings for tests
            services.Configure<JwtSettings>(options =>
            {
                options.Key = "ThisIsATestKeyMakeItAtLeast32BytesLongForHS256Testing";
                options.Issuer = "ClinicsApp";
                options.Audience = "ClinicsAPI";
                options.ExpirationMinutes = 60;
                options.RefreshTokenExpirationDays = 7;
            });
        });

        builder.ConfigureAppConfiguration((context, config) =>
        {
            // Override with test settings
            var settings = new Dictionary<string, string?>
            {
                ["ASPNETCORE_ENVIRONMENT"] = "Test",
                ["Hangfire:StorageType"] = "Memory",
            };
            
            // Pass through connection string if provided
            if (!string.IsNullOrEmpty(_connectionString))
            {
                settings["ConnectionStrings:DefaultConnection"] = _connectionString;
            }
            
            config.AddInMemoryCollection(settings);
        });

        base.ConfigureWebHost(builder);
    }

    /// <summary>
    /// Seed test data into the database.
    /// For in-memory database: Seeds data using DbSeeder.
    /// For SQL Server (CI): Data is already seeded via migrations, so this is a no-op.
    /// This is idempotent - only seeds once per factory instance.
    /// Safe to call multiple times; subsequent calls are no-ops.
    /// </summary>
    public async Task SeedDataAsync()
    {
        // Skip if already seeded for this factory instance
        if (_seeded)
            return;

        using (var scope = Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            
            // Only seed if using in-memory database
            // When using SQL Server in CI, data is already seeded via migrations
            if (string.IsNullOrEmpty(_connectionString))
            {
                var logger = scope.ServiceProvider.GetRequiredService<ILogger<DbSeeder>>();
                
                // Seed test data using DbSeeder
                var seeder = new DbSeeder(db, logger);
                await seeder.SeedAsync();
            }
            
            _seeded = true;
        }
    }
}

public class JwtSettings
{
    public string Key { get; set; } = string.Empty;
    public string Issuer { get; set; } = string.Empty;
    public string Audience { get; set; } = string.Empty;
    public int ExpirationMinutes { get; set; }
    public int RefreshTokenExpirationDays { get; set; }
}
