using Microsoft.AspNetCore.Mvc;
using Clinics.Infrastructure;
using Clinics.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Clinics.Api.DTOs;
using System.Security.Claims;

namespace Clinics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class UsersController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly ILogger<UsersController> _logger;

        public UsersController(ApplicationDbContext db, ILogger<UsersController> logger)
        {
            _db = db;
            _logger = logger;
        }

        /// <summary>
        /// Get all users - Admins see all, Moderators see their managed users
        /// </summary>
        [HttpGet]
        [Authorize(Roles = "primary_admin,secondary_admin,moderator")]
        public async Task<IActionResult> GetAll([FromQuery] string? role = null)
        {
            try
            {
                var user = User.FindFirst(ClaimTypes.NameIdentifier);
                var currentUserId = int.Parse(user?.Value ?? "0");
                var currentUser = await _db.Users.FindAsync(currentUserId);

                IQueryable<User> query = _db.Users;

                // Admins see all users
                if (currentUser?.Role == "primary_admin" || currentUser?.Role == "secondary_admin")
                {
                    // All users - optionally filter by role if provided
                    if (!string.IsNullOrWhiteSpace(role))
                    {
                        query = query.Where(u => u.Role == role);
                    }
                }
                // Moderators see only their managed users
                else if (currentUser?.Role == "moderator")
                {
                    query = query.Where(u => u.ModeratorId == currentUserId);
                }
                else
                {
                    return Forbid();
                }

                var users = await query.ToListAsync();
                return Ok(new { 
                    items = users,
                    totalCount = users.Count,
                    pageNumber = 1,
                    pageSize = users.Count
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching users");
                return StatusCode(500, new { success = false, error = "Error fetching users" });
            }
        }

        /// <summary>
        /// Get specific user
        /// </summary>
        [HttpGet("{id}")]
        public async Task<IActionResult> Get(int id)
        {
            try
            {
                var user = User.FindFirst(ClaimTypes.NameIdentifier);
                var currentUserId = int.Parse(user?.Value ?? "0");
                var currentUser = await _db.Users.FindAsync(currentUserId);

                var targetUser = await _db.Users.FindAsync(id);
                if (targetUser == null)
                    return NotFound(new { success = false, error = "User not found" });

                // User can view themselves
                if (currentUserId == id)
                {
                    return Ok(new { success = true, data = targetUser });
                }

                // Admin can view anyone
                if (currentUser?.Role == "primary_admin" || currentUser?.Role == "secondary_admin")
                {
                    return Ok(new { success = true, data = targetUser });
                }

                // Moderator can view their managed users
                if (currentUser?.Role == "moderator" && targetUser.ModeratorId == currentUserId)
                {
                    return Ok(new { success = true, data = targetUser });
                }

                return Forbid();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching user");
                return StatusCode(500, new { success = false, error = "Error fetching user" });
            }
        }

        /// <summary>
        /// Create a new user (must specify moderator for regular users)
        /// </summary>
        [HttpPost]
        [Authorize(Roles = "primary_admin,secondary_admin")]
        public async Task<IActionResult> Create([FromBody] CreateUserRequest req)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(req.Username))
                    return BadRequest(new { success = false, error = "Username is required" });

                // FirstName is required
                if (string.IsNullOrWhiteSpace(req.FirstName))
                    return BadRequest(new { success = false, error = "FirstName is required" });

                // Check if username exists
                var existingUser = await _db.Users
                    .Where(u => u.Username == req.Username)
                    .FirstOrDefaultAsync();

                if (existingUser != null)
                    return BadRequest(new { success = false, error = "Username already exists" });

                // Determine desired role name
                var desiredRoleName = string.IsNullOrWhiteSpace(req.Role)
                    ? Clinics.Domain.UserRole.User.ToRoleName()
                    : Clinics.Domain.UserRoleExtensions.FromRoleName(req.Role).ToRoleName();

                // If creating a regular user, moderator must be specified
                if (desiredRoleName == "user" && !req.ModeratorId.HasValue)
                    return BadRequest(new { success = false, error = "ModeratorId required for user role" });

                // Validate moderator exists if specified
                if (req.ModeratorId.HasValue)
                {
                    var moderator = await _db.Users
                        .Where(u => u.Id == req.ModeratorId.Value && u.Role == "moderator")
                        .FirstOrDefaultAsync();

                    if (moderator == null)
                        return BadRequest(new { success = false, error = "Invalid moderator" });
                }

                var user = new User
                {
                    Username = req.Username,
                    FirstName = req.FirstName.Trim(),
                    LastName = req.LastName?.Trim(),
                    Role = desiredRoleName,
                    ModeratorId = req.ModeratorId
                };

                if (!string.IsNullOrEmpty(req.Password))
                {
                    var hasher = new Microsoft.AspNetCore.Identity.PasswordHasher<User>();
                    user.PasswordHash = hasher.HashPassword(user, req.Password);
                }

                _db.Users.Add(user);
                await _db.SaveChangesAsync();

                return Ok(user);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating user");
                return StatusCode(500, new { success = false, error = "Error creating user" });
            }
        }

        /// <summary>
        /// Update a user
        /// </summary>
        [HttpPut("{id}")]
        [Authorize(Roles = "primary_admin,secondary_admin,moderator")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateUserRequest req)
        {
            try
            {
                var user = User.FindFirst(ClaimTypes.NameIdentifier);
                var currentUserId = int.Parse(user?.Value ?? "0");
                var currentUser = await _db.Users.FindAsync(currentUserId);

                var targetUser = await _db.Users.FindAsync(id);
                if (targetUser == null)
                    return NotFound(new { success = false, error = "User not found" });

                // Only admin can update, or moderator can update their managed users
                if (currentUser?.Role != "primary_admin" && currentUser?.Role != "secondary_admin")
                {
                    if (currentUser?.Role != "moderator" || targetUser.ModeratorId != currentUserId)
                        return Forbid();
                }

                // Update firstName if provided
                if (!string.IsNullOrEmpty(req.FirstName))
                    targetUser.FirstName = req.FirstName.Trim();

                // Update lastName if provided
                if (req.LastName != null)
                    targetUser.LastName = req.LastName.Trim();

                // Handle password update if provided
                if (!string.IsNullOrEmpty(req.Password))
                {
                    var hasher = new Microsoft.AspNetCore.Identity.PasswordHasher<User>();
                    targetUser.PasswordHash = hasher.HashPassword(targetUser, req.Password);
                }

                await _db.SaveChangesAsync();
                return Ok(targetUser);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating user");
                return StatusCode(500, new { success = false, error = "Error updating user" });
            }
        }

        /// <summary>
        /// Delete a user
        /// </summary>
        [HttpDelete("{id}")]
        [Authorize(Roles = "primary_admin,secondary_admin,moderator")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var user = User.FindFirst(ClaimTypes.NameIdentifier);
                var currentUserId = int.Parse(user?.Value ?? "0");
                var currentUser = await _db.Users.FindAsync(currentUserId);

                var targetUser = await _db.Users.FindAsync(id);
                if (targetUser == null)
                    return NotFound(new { success = false, error = "User not found" });

                // Only admin can delete, or moderator can delete their managed users
                if (currentUser?.Role != "primary_admin" && currentUser?.Role != "secondary_admin")
                {
                    if (currentUser?.Role != "moderator" || targetUser.ModeratorId != currentUserId)
                        return Forbid();
                }

                // Cannot delete if user has sub-users
                var hasManagedUsers = await _db.Users
                    .Where(u => u.ModeratorId == id)
                    .AnyAsync();

                if (hasManagedUsers)
                    return BadRequest(new { success = false, error = "Cannot delete user with managed users" });

                _db.Users.Remove(targetUser);
                await _db.SaveChangesAsync();

                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting user");
                return StatusCode(500, new { success = false, error = "Error deleting user" });
            }
        }

        /// <summary>
        /// Reset user password
        /// </summary>
        [HttpPost("{id}/reset-password")]
        [Authorize(Roles = "primary_admin,secondary_admin,moderator")]
        public async Task<IActionResult> ResetPassword(int id, [FromBody] ResetPasswordDTO req)
        {
            try
            {
                if (req == null || string.IsNullOrWhiteSpace(req.Password))
                    return BadRequest(new { success = false, error = "Password is required" });

                var user = User.FindFirst(ClaimTypes.NameIdentifier);
                var currentUserId = int.Parse(user?.Value ?? "0");
                var currentUser = await _db.Users.FindAsync(currentUserId);

                var targetUser = await _db.Users.FindAsync(id);
                if (targetUser == null)
                    return NotFound(new { success = false, error = "User not found" });

                // Only admin can reset, or moderator can reset their managed users
                if (currentUser?.Role != "primary_admin" && currentUser?.Role != "secondary_admin")
                {
                    if (currentUser?.Role != "moderator" || targetUser.ModeratorId != currentUserId)
                        return Forbid();
                }

                var hasher = new Microsoft.AspNetCore.Identity.PasswordHasher<User>();
                targetUser.PasswordHash = hasher.HashPassword(targetUser, req.Password);
                await _db.SaveChangesAsync();

                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resetting password");
                return StatusCode(500, new { success = false, error = "Error resetting password" });
            }
        }
    }
}
