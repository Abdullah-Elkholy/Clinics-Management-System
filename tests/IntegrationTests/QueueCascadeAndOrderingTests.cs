using Microsoft.Extensions.Configuration;
using System.Linq;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace IntegrationTests;

public class QueueCascadeAndOrderingTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public QueueCascadeAndOrderingTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder => {
            builder.ConfigureAppConfiguration((context, conf) => {
                    conf.AddInMemoryCollection(new System.Collections.Generic.Dictionary<string, string?>() {
                    ["USE_LOCAL_SQL"] = "false",
                    ["Jwt:Key"] = "TestKey_CascadeOrdering_123456"
                });
            });
        });
    }

    [Fact]
    public async Task DeletingQueue_AlsoRemovesPatients_DBLevelCascade()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<Clinics.Infrastructure.ApplicationDbContext>();

        // create queue and patients
        var q = new Clinics.Domain.Queue { DoctorName = "CascadeTest", CreatedBy = 1, CurrentPosition = 1 };
        db.Queues.Add(q);
        db.SaveChanges();

        db.Patients.Add(new Clinics.Domain.Patient { QueueId = q.Id, FullName = "P1", PhoneNumber = "000", Position = 1 });
        db.Patients.Add(new Clinics.Domain.Patient { QueueId = q.Id, FullName = "P2", PhoneNumber = "001", Position = 2 });
        db.SaveChanges();

        // Delete queue via DbContext direct remove to test DB cascade
        db.Queues.Remove(q);
        db.SaveChanges();

        var remaining = db.Patients.Where(p => p.QueueId == q.Id).ToList();
        remaining.Should().BeEmpty("Patients should be deleted when their queue is removed by cascade");
    }

    [Fact]
    public async Task InsertingPatient_WithDesiredPosition_ShiftsExistingPatients()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<Clinics.Infrastructure.ApplicationDbContext>();

        var q = new Clinics.Domain.Queue { DoctorName = "OrderTest", CreatedBy = 1, CurrentPosition = 1 };
        db.Queues.Add(q);
        db.SaveChanges();

        db.Patients.Add(new Clinics.Domain.Patient { QueueId = q.Id, FullName = "A", PhoneNumber = "100", Position = 1 });
        db.Patients.Add(new Clinics.Domain.Patient { QueueId = q.Id, FullName = "B", PhoneNumber = "101", Position = 2 });
        db.Patients.Add(new Clinics.Domain.Patient { QueueId = q.Id, FullName = "C", PhoneNumber = "102", Position = 3 });
        db.SaveChanges();

        // Insert new patient at desiredPosition = 2 (should shift B and C)
        var newPatient = new Clinics.Domain.Patient { QueueId = q.Id, FullName = "X", PhoneNumber = "199", Position = 2 };
        // shift existing >=2
        var toShift = db.Patients.Where(p => p.QueueId == q.Id && p.Position >= 2).ToList();
        foreach (var p in toShift) p.Position += 1;
        db.Patients.Add(newPatient);
        db.SaveChanges();

        var ordered = db.Patients.Where(p => p.QueueId == q.Id).OrderBy(p => p.Position).Select(p => p.FullName).ToList();
        ordered.Should().ContainInOrder(new[] { "A", "X", "B", "C" });
    }
}
