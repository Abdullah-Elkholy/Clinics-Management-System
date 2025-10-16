using Xunit;
using Clinics.Api.Controllers;
using Clinics.Infrastructure;
using Clinics.Domain;
using Microsoft.EntityFrameworkCore;
using FluentAssertions;
using System.Threading.Tasks;

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
    public async Task CreateAndGetUser_Works()
    {
        using var db = CreateInMemoryDb();
        var controller = new UsersController(db);
    var req = new Clinics.Api.DTOs.CreateUserRequest { Username = "u1", FullName = "U One" };
    var createResult = await controller.Create(req) as Microsoft.AspNetCore.Mvc.OkObjectResult;
        createResult.Should().NotBeNull();
        var getAll = await controller.GetAll() as Microsoft.AspNetCore.Mvc.OkObjectResult;
        getAll.Should().NotBeNull();
    var data = ((dynamic)getAll.Value).data as System.Collections.Generic.List<Clinics.Domain.User>;
        data.Should().ContainSingle(u => u.Username == "u1");
    }
}