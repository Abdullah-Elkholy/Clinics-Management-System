using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using System;

namespace Clinics.Infrastructure
{
    // This factory is used by EF Core tools at design time to create the DbContext when
    // the startup project or hosting environment isn't available.
    public class DesignTimeDbContextFactory : IDesignTimeDbContextFactory<ApplicationDbContext>
    {
        public ApplicationDbContext CreateDbContext(string[] args)
        {
            var builder = new DbContextOptionsBuilder<ApplicationDbContext>();
            // Use Local SQL Server default used in Program.cs when running with USE_LOCAL_SQL
            var conn = Environment.GetEnvironmentVariable("DefaultConnection")
                       ?? Environment.GetEnvironmentVariable("ConnectionStrings__Default")
                       ?? "Server=BODYELKHOLY\\SQL2022;Database=ClinicsDb;User Id=sa;Password=123456;TrustServerCertificate=True;";
            builder.UseSqlServer(conn);
            return new ApplicationDbContext(builder.Options);
        }
    }
}
