using Microsoft.EntityFrameworkCore;
using Clinics.Infrastructure;

namespace Clinics.Api.Tests.Integration;

/// <summary>
/// Base fixture for integration tests that need a database context.
/// Uses EF Core InMemory provider for fast, isolated tests.
/// </summary>
public abstract class IntegrationTestBase : IDisposable
{
    protected readonly ApplicationDbContext DbContext;
    private readonly string _databaseName;

    protected IntegrationTestBase()
    {
        // Use unique database name per test to ensure isolation
        _databaseName = $"TestDb_{Guid.NewGuid()}";
        
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(_databaseName)
            .Options;

        DbContext = new ApplicationDbContext(options);
        DbContext.Database.EnsureCreated();
    }

    /// <summary>
    /// Save changes and detach all entities to simulate a fresh query.
    /// Useful when testing that data was persisted correctly.
    /// </summary>
    protected async Task SaveAndDetachAsync()
    {
        await DbContext.SaveChangesAsync();
        
        // Detach all entities to force fresh load on next query
        foreach (var entry in DbContext.ChangeTracker.Entries().ToList())
        {
            entry.State = EntityState.Detached;
        }
    }

    public void Dispose()
    {
        DbContext.Database.EnsureDeleted();
        DbContext.Dispose();
        GC.SuppressFinalize(this);
    }
}
