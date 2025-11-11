using Xunit;
using Clinics.Infrastructure;
using Clinics.Domain;
using Microsoft.EntityFrameworkCore;
using FluentAssertions;
using System.Linq;

namespace UnitTests;

public class UsersControllerTests
{
    private ApplicationDbContext CreateInMemoryDb()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(System.Guid.NewGuid().ToString())
            .Options;
        return new ApplicationDbContext(options);
    }

    [Fact]
    public void CreateAndGetUser_Works()
    {
        using var db = CreateInMemoryDb();
        db.Database.EnsureCreated();
        var user = new User { Username = "u1", FirstName = "User", LastName = "One", Role = "primary_admin" };
        db.Users.Add(user);
        db.SaveChanges();
        
        var u = db.Users.FirstOrDefault(x => x.Username == "u1");
        u.Should().NotBeNull();
        u!.Username.Should().Be("u1");
        u.FullName.Should().Be("User One");
    }
}