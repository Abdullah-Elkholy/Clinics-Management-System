using Xunit;
using Clinics.Infrastructure;
using Microsoft.EntityFrameworkCore;
using FluentAssertions;
using System;
using Clinics.Domain;

namespace UnitTests;

public class ApplicationDbContextMappingTests
{
    [Fact]
    public void CanAddAndQuery_UserAndRole()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        using var db = new ApplicationDbContext(options);
        var role = new Role { Name = "r1", DisplayName = "R1" };
        db.Roles.Add(role);
        db.SaveChanges();
        var user = new User { Username = "u1", FullName = "U One", RoleId = role.Id };
        db.Users.Add(user);
        db.SaveChanges();
        var u = db.Users.Include(x => x.Role).FirstOrDefaultAsync(x => x.Username == "u1").Result;
        u.Should().NotBeNull();
        u.Role.Should().NotBeNull();
        u.Role.Name.Should().Be("r1");
    }
}