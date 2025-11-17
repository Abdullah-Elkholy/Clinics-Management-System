using System.IO;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using ClinicsManagementService;
using ClinicsManagementService.Configuration;

namespace ClinicsManagementService.IntegrationTests.Common
{
    public class TestWebApplicationFactory : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");
            
            // Clean up session directory before tests to ensure PendingQR behavior
            // when session is not authenticated
            var sessionDir = WhatsAppConfiguration.SessionDirectory;
            if (Directory.Exists(sessionDir))
            {
                try
                {
                    Directory.Delete(sessionDir, recursive: true);
                }
                catch
                {
                    // Ignore cleanup errors - tests will handle missing session
                }
            }
        }
    }
}

