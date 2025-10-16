using Microsoft.AspNetCore.Mvc;
using Clinics.Infrastructure;
using Clinics.Domain;
using Microsoft.EntityFrameworkCore;

namespace Clinics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin")]
    public class UsersController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        public UsersController(ApplicationDbContext db) { _db = db; }

        [HttpGet]
        public async Task<IActionResult> GetAll() => Ok(new { success = true, data = await _db.Users.ToListAsync() });

        [HttpGet("{id}")]
        public async Task<IActionResult> Get(int id) => Ok(new { success = true, data = await _db.Users.FindAsync(id) });

        public class CreateUserRequest
        {
            public string Username { get; set; } = null!;
            public string FullName { get; set; } = null!;
            public string Role { get; set; } = "user";
            public string? Password { get; set; }
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateUserRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Username) || string.IsNullOrWhiteSpace(req.FullName))
                return BadRequest(new { success = false, error = "Username and FullName required" });

            // resolve role id if provided
            var role = await _db.Roles.FirstOrDefaultAsync(r => r.Name == req.Role) ?? await _db.Roles.FirstOrDefaultAsync(r => r.Name == "user");
            var user = new User { Username = req.Username, FullName = req.FullName, RoleId = role?.Id ?? 0 };

            if (!string.IsNullOrEmpty(req.Password))
            {
                var hasher = new Microsoft.AspNetCore.Identity.PasswordHasher<User>();
                user.PasswordHash = hasher.HashPassword(user, req.Password);
            }

            _db.Users.Add(user);
            await _db.SaveChangesAsync();
            return Ok(new { success = true, data = user });
        }
    }
}
