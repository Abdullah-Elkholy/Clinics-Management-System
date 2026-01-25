using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace Clinics.Infrastructure
{
    /// <summary>
    /// Design-time DbContext factory for Entity Framework Core migrations.
    /// Used when running 'dotnet ef migrations add' commands.
    /// Supports both SQL Server (default) and PostgreSQL based on environment variable.
    /// </summary>
    public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
    {
        public ApplicationDbContext CreateDbContext(string[] args)
        {
            var optionsBuilder = new DbContextOptionsBuilder<ApplicationDbContext>();

            // Check for DATABASE_PROVIDER environment variable
            var databaseProvider = Environment.GetEnvironmentVariable("DATABASE_PROVIDER") ?? "SqlServer";

            if (databaseProvider.Equals("PostgreSQL", StringComparison.OrdinalIgnoreCase))
            {
                // PostgreSQL connection for production/docker migrations
                var pgConnection = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
                    ?? "Host=localhost;Database=ClinicsDb;Username=clinics_user;Password=clinics_password";
                optionsBuilder.UseNpgsql(pgConnection);
            }
            else
            {
                // SQL Server connection for local development migrations
                var sqlConnection = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection")
                    ?? "Server=BODYELKHOLY\\SQL2022;Database=ClinicsDb;User Id=sa;Password=123456;TrustServerCertificate=True;MultipleActiveResultSets=true;";
                optionsBuilder.UseSqlServer(sqlConnection);
            }

            return new ApplicationDbContext(optionsBuilder.Options);
        }
    }
}
