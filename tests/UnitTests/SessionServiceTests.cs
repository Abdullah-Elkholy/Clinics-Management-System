using Xunit;
using FluentAssertions;
using Clinics.Api.Services;
using Clinics.Infrastructure;
using Microsoft.EntityFrameworkCore;
using System;

namespace UnitTests;

public class SessionServiceTests
{
    private ApplicationDbContext CreateInMemoryDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    [Fact]
    public void CreateValidateRevokeSession_Works()
    {
        using var db = CreateInMemoryDb();
        var svc = new SessionService(db);
        var token = svc.CreateRefreshToken(123, TimeSpan.FromDays(1));
        Guid.TryParse(token, out var id).Should().BeTrue();
        var valid = svc.ValidateRefreshToken(id, 123);
        valid.Should().BeTrue();
        svc.RevokeSession(id);
        svc.ValidateRefreshToken(id, 123).Should().BeFalse();
    }
}