using Testcontainers.MsSql;
using Clinics.Infrastructure;
using Microsoft.EntityFrameworkCore;
using System;
using System.Threading.Tasks;

namespace IntegrationTests.Common;

/// <summary>
/// Manages a Testcontainers SQL Server instance for deterministic integration testing.
/// Usage: 
///   var container = await TestSqlContainer.StartAsync();
///   var contextOptions = TestSqlContainer.GetDbContextOptions(container);
///   using var db = new ApplicationDbContext(contextOptions);
///   // ... tests run
///   await container.StopAsync();
/// </summary>
public class TestSqlContainer
{
    private static MsSqlContainer? _container;

    /// <summary>
    /// Starts a new SQL Server testcontainer (Std edition, SQL 2022).
    /// </summary>
    public static async Task<MsSqlContainer> StartAsync()
    {
        if (_container != null)
        {
            return _container;
        }

        _container = new MsSqlBuilder()
            .WithImage("mcr.microsoft.com/mssql/server:2022-latest")
            .WithEnvironment("ACCEPT_EULA", "Y")
            .WithEnvironment("SA_PASSWORD", "TestPassword123!")
            .WithExposedPort(1433)
            .Build();

        await _container.StartAsync();
        return _container;
    }

    /// <summary>
    /// Gets DbContextOptions pointing to the testcontainer SQL Server.
    /// </summary>
    public static DbContextOptions<ApplicationDbContext> GetDbContextOptions(MsSqlContainer container)
    {
        var connectionString = container.GetConnectionString();
        return new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlServer(connectionString, opt => opt.CommandTimeout(60))
            .Options;
    }

    /// <summary>
    /// Stops the testcontainer and cleans up resources.
    /// </summary>
    public static async Task StopAsync()
    {
        if (_container != null)
        {
            await _container.StopAsync();
            await _container.DisposeAsync();
            _container = null;
        }
    }
}
