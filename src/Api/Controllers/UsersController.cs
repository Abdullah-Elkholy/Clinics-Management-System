using Microsoft.AspNetCore.Mvc;
using Clinics.Infrastructure;
using Clinics.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Clinics.Api.DTOs;
namespace Clinics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize(Roles = "primary_admin")]
    public class UsersController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        public UsersController(ApplicationDbContext db) { _db = db; }

        [HttpGet]
        public async Task<IActionResult> GetAll() => Ok(new { success = true, data = await _db.Users.ToListAsync() });

        [HttpGet("{id}")]
        public async Task<IActionResult> Get(int id) => Ok(new { success = true, data = await _db.Users.FindAsync(id) });

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateUserRequest req)
        {
            if (string.IsNullOrWhiteSpace(req.Username) || string.IsNullOrWhiteSpace(req.FullName))
                return BadRequest(new { success = false, error = "Username and FullName required" });

            // Determine desired role name (use enum mapping on server side for consistency)
            var desiredRoleName = string.IsNullOrWhiteSpace(req.Role)
                ? Clinics.Domain.UserRole.User.ToRoleName()
                : Clinics.Domain.UserRoleExtensions.FromRoleName(req.Role).ToRoleName();

            // resolve role id in DB for backwards compatibility (Roles table remains)
            var role = await _db.Roles.FirstOrDefaultAsync(r => r.Name == desiredRoleName) ?? await _db.Roles.FirstOrDefaultAsync(r => r.Name == "user");
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

        [HttpPost("{id}/reset-password")]
        public async Task<IActionResult> ResetPassword(int id, [FromBody] ResetPasswordDTO req)
        {
            if (req == null || string.IsNullOrWhiteSpace(req.Password))
                return BadRequest(new { success = false, error = "Password is required" });

            var user = await _db.Users.FindAsync(id);
            if (user == null) return NotFound(new { success = false, error = "User not found" });

            var hasher = new Microsoft.AspNetCore.Identity.PasswordHasher<User>();
            user.PasswordHash = hasher.HashPassword(user, req.Password);
            await _db.SaveChangesAsync();
            return Ok(new { success = true });
        }
    }
}
