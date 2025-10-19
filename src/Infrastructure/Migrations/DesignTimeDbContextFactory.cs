using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;
using System;
using Clinics.Infrastructure;

namespace Clinics.Infrastructure
{
    // This factory is used by EF Core tools at design time to create the DbContext when
    // the startup project or hosting environment isn't available.
    public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
    {
        public ApplicationDbContext CreateDbContext(string[] args)
        {
            var builder = new DbContextOptionsBuilder<ApplicationDbContext>();
            // Try several candidate paths to locate src/Api/appsettings.json. EF design-time execution
            // can have different working directories depending on how dotnet-ef is invoked, so
            // we probe a few likely locations and then fall back to environment variables or a
            // sensible default local SQL Server connection string.
            string? connectionString = null;

            var candidates = new[]
            {
                // If running from compiled startup assembly's base directory
                System.IO.Path.Combine(System.AppContext.BaseDirectory, "..", "..", "..", "..", "src", "Api", "appsettings.json"),
                // Working directory when running dotnet ef from repo root
                System.IO.Path.Combine(System.IO.Directory.GetCurrentDirectory(), "src", "Api", "appsettings.json"),
                // Relative to this file
                System.IO.Path.Combine(System.IO.Directory.GetCurrentDirectory(), "..", "src", "Api", "appsettings.json"),
            };

            foreach (var candidate in candidates)
            {
                try
                {
                    var full = System.IO.Path.GetFullPath(candidate);
                    if (System.IO.File.Exists(full))
                    {
                        var cfg = new ConfigurationBuilder()
                            .AddJsonFile(full, optional: false)
                            .AddEnvironmentVariables()
                            .Build();
                        connectionString = cfg.GetConnectionString("Default");
                        if (!string.IsNullOrEmpty(connectionString)) break;
                    }
                }
                catch
                {
                    // ignore and try next candidate
                }
            }

            // If not found in files, look into environment variables that may be set in CI or developer shells
            if (string.IsNullOrEmpty(connectionString))
            {
                connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__Default")
                                   ?? Environment.GetEnvironmentVariable("DefaultConnection");
            }

            // Final fallback: local SQL server (development convenience). Adjust if your environment
            // uses a different server or uses integrated auth.
            if (string.IsNullOrEmpty(connectionString))
            {
                connectionString = "Server=BODYELKHOLY\\SQL2022;Database=ClinicsDb;User Id=sa;Password=123456;TrustServerCertificate=True;";
            }

            // Ensure a provider is configured so EF design-time tools can create the DbContext.
            builder.UseSqlServer(connectionString);
            return new ApplicationDbContext(builder.Options);
        }
    }
}
