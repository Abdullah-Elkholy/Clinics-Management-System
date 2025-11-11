using Xunit;
using Clinics.Infrastructure;
using Microsoft.EntityFrameworkCore;
using FluentAssertions;
using System;
using System.Linq;
using Clinics.Domain;

namespace UnitTests;

public class ApplicationDbContextMappingTests
{
    [Fact]
    public void CanAddAndQuery_User()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        using var db = new ApplicationDbContext(options);
        var user = new User { Username = "u1", FirstName = "User", LastName = "One", Role = "primary_admin" };
        db.Users.Add(user);
        db.SaveChanges();
        var u = db.Users.FirstOrDefault(x => x.Username == "u1");
        u.Should().NotBeNull();
        u!.Role.Should().Be("primary_admin");
        u.FullName.Should().Be("User One");
    }
}