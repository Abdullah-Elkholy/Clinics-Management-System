using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Clinics.Infrastructure;
using Clinics.Domain;
using Clinics.Api.DTOs;
using System.Security.Claims;

namespace Clinics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class ModeratorsController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly ILogger<ModeratorsController> _logger;

        public ModeratorsController(ApplicationDbContext db, ILogger<ModeratorsController> logger)
        {
            _db = db;
            _logger = logger;
        }

        /// <summary>
        /// Get all moderators (Admin only)
        /// </summary>
        [HttpGet]
        [Authorize(Roles = "primary_admin,secondary_admin")]
        public async Task<IActionResult> GetAll()
        {
            try
            {
                var moderators = await _db.Users
                    .Where(u => u.Role == "moderator")
                    .Select(u => new ModeratorDto
                    {
                        Id = u.Id,
                        Username = u.Username,
                        FirstName = u.FirstName,
                        LastName = u.LastName,
                        IsActive = true,
                        CreatedAt = DateTime.Now,
                        UpdatedAt = DateTime.Now
                    })
                    .ToListAsync();

                return Ok(new { success = true, data = moderators });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching moderators");
                return StatusCode(500, new { success = false, error = "Error fetching moderators" });
            }
        }

        /// <summary>
        /// Get moderator by ID with details
        /// </summary>
        [HttpGet("{id}")]
        public async Task<IActionResult> GetById(int id)
        {
            try
            {
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)
                    ?? User.FindFirst("sub")
                    ?? User.FindFirst("userId");
                
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var currentUserId))
                    return BadRequest(new { success = false, error = "Invalid or missing user ID in token" });
                
                var currentUser = await _db.Users.FindAsync(currentUserId);

                // Moderators can only view their own details, admins can view any
                if (currentUser?.Role != "primary_admin" && currentUser?.Role != "secondary_admin" && currentUserId != id)
                {
                    return Forbid();
                }

                var moderator = await _db.Users
                    .Where(u => u.Id == id && u.Role == "moderator")
                    .FirstOrDefaultAsync();

                if (moderator == null)
                    return NotFound(new { success = false, error = "Moderator not found" });

                var managedUsers = await _db.Users
                    .Where(u => u.ModeratorId == id)
                    .CountAsync();

                var queues = await _db.Queues
                    .Where(q => q.ModeratorId == id)
                    .CountAsync();

                var templates = await _db.MessageTemplates
                    .Where(t => t.ModeratorId == id)
                    .CountAsync();

                var quota = await _db.Quotas
                    .Where(q => q.ModeratorUserId == id)
                    .FirstOrDefaultAsync();

                var result = new ModeratorDetailsDto
                {
                    Id = moderator.Id,
                    Username = moderator.Username,
                    FirstName = moderator.FirstName,
                    LastName = moderator.LastName,
                    IsActive = true,
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now,
                    TotalManagedUsers = managedUsers,
                    TotalQueues = queues,
                    TotalMessageTemplates = templates,
                    Quota = quota != null ? new QuotaDto
                    {
                        Id = quota.Id,
                        Limit = quota.MessagesQuota,
                        Used = quota.ConsumedMessages,
                        QueuesLimit = quota.QueuesQuota,
                        QueuesUsed = quota.ConsumedQueues,
                        UpdatedAt = quota.UpdatedAt
                    } : null
                };

                return Ok(new { success = true, data = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching moderator details");
                return StatusCode(500, new { success = false, error = "Error fetching moderator details" });
            }
        }

        /// <summary>
        /// Create a new moderator (Admin only)
        /// </summary>
        [HttpPost]
        [Authorize(Roles = "primary_admin")]
        public async Task<IActionResult> Create([FromBody] CreateModeratorRequest req)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(req.Username) || string.IsNullOrWhiteSpace(req.FirstName))
                    return BadRequest(new { success = false, error = "Username and FirstName are required" });

                // Check if username already exists
                var existingUser = await _db.Users
                    .Where(u => u.Username == req.Username)
                    .FirstOrDefaultAsync();

                if (existingUser != null)
                    return BadRequest(new { success = false, error = "Username already exists" });

                var moderator = new User
                {
                    Username = req.Username,
                    FirstName = req.FirstName,
                    LastName = req.LastName,
                    Role = "moderator"
                };

                if (!string.IsNullOrEmpty(req.Password))
                {
                    var hasher = new Microsoft.AspNetCore.Identity.PasswordHasher<User>();
                    moderator.PasswordHash = hasher.HashPassword(moderator, req.Password);
                }

                _db.Users.Add(moderator);
                await _db.SaveChangesAsync();

                // Create moderator settings
                var settings = new ModeratorSettings
                {
                    ModeratorUserId = moderator.Id,
                    WhatsAppPhoneNumber = req.WhatsAppPhoneNumber,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _db.ModeratorSettings.Add(settings);

                // Create default quota (if needed)
                var quota = new Quota
                {
                    ModeratorUserId = moderator.Id,
                    MessagesQuota = 1000,
                    ConsumedMessages = 0,
                    QueuesQuota = 10,
                    ConsumedQueues = 0,
                    UpdatedAt = DateTime.UtcNow
                };

                _db.Quotas.Add(quota);
                await _db.SaveChangesAsync();

                var result = new ModeratorDto
                {
                    Id = moderator.Id,
                    Username = moderator.Username,
                    FirstName = moderator.FirstName,
                    LastName = moderator.LastName,
                    WhatsAppPhoneNumber = req.WhatsAppPhoneNumber,
                    IsActive = true,
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now
                };

                return Ok(new { success = true, data = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating moderator");
                return StatusCode(500, new { success = false, error = "Error creating moderator" });
            }
        }

        /// <summary>
        /// Update a moderator
        /// </summary>
        [HttpPut("{id}")]
        [Authorize(Roles = "primary_admin")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateModeratorRequest req)
        {
            try
            {
                var moderator = await _db.Users
                    .Where(u => u.Id == id && u.Role == "moderator")
                    .FirstOrDefaultAsync();

                if (moderator == null)
                    return NotFound(new { success = false, error = "Moderator not found" });

                if (!string.IsNullOrEmpty(req.FirstName))
                    moderator.FirstName = req.FirstName;

                if (!string.IsNullOrEmpty(req.LastName))
                    moderator.LastName = req.LastName;

                // Update moderator settings
                var settings = await _db.ModeratorSettings
                    .Where(m => m.ModeratorUserId == id)
                    .FirstOrDefaultAsync();

                if (settings != null)
                {
                    if (!string.IsNullOrEmpty(req.WhatsAppPhoneNumber))
                        settings.WhatsAppPhoneNumber = req.WhatsAppPhoneNumber;

                    if (req.IsActive.HasValue)
                        settings.IsActive = req.IsActive.Value;

                    settings.UpdatedAt = DateTime.UtcNow;
                }

                await _db.SaveChangesAsync();

                var result = new ModeratorDto
                {
                    Id = moderator.Id,
                    Username = moderator.Username,
                    FirstName = moderator.FirstName,
                    LastName = moderator.LastName,
                    WhatsAppPhoneNumber = settings?.WhatsAppPhoneNumber,
                    IsActive = settings?.IsActive ?? true,
                    CreatedAt = DateTime.Now,
                    UpdatedAt = DateTime.Now
                };

                return Ok(new { success = true, data = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating moderator");
                return StatusCode(500, new { success = false, error = "Error updating moderator" });
            }
        }

        /// <summary>
        /// Delete a moderator (Admin only)
        /// </summary>
        [HttpDelete("{id}")]
        [Authorize(Roles = "primary_admin")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var moderator = await _db.Users
                    .Where(u => u.Id == id && u.Role == "moderator")
                    .FirstOrDefaultAsync();

                if (moderator == null)
                    return NotFound(new { success = false, error = "Moderator not found" });

                // Check if moderator has managed users
                var hasManagedUsers = await _db.Users
                    .Where(u => u.ModeratorId == id)
                    .AnyAsync();

                if (hasManagedUsers)
                    return BadRequest(new { success = false, error = "Cannot delete moderator with managed users" });

                // Delete related data
                var settings = await _db.ModeratorSettings
                    .Where(m => m.ModeratorUserId == id)
                    .FirstOrDefaultAsync();

                if (settings != null)
                    _db.ModeratorSettings.Remove(settings);

                _db.Users.Remove(moderator);
                await _db.SaveChangesAsync();

                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting moderator");
                return StatusCode(500, new { success = false, error = "Error deleting moderator" });
            }
        }

        /// <summary>
        /// Get users managed by a moderator
        /// </summary>
        [HttpGet("{id}/users")]
        [Authorize(Roles = "primary_admin,secondary_admin")]
        public async Task<IActionResult> GetManagedUsers(int id)
        {
            try
            {
                var moderator = await _db.Users
                    .Where(u => u.Id == id && u.Role == "moderator")
                    .FirstOrDefaultAsync();

                if (moderator == null)
                    return NotFound(new { success = false, error = "Moderator not found" });

                var users = await _db.Users
                    .Where(u => u.ModeratorId == id)
                    .Select(u => new UserWithModeratorDto
                    {
                        Id = u.Id,
                        Username = u.Username,
                        FirstName = u.FirstName,
                        LastName = u.LastName,
                        Role = u.Role,
                        ModeratorId = u.ModeratorId,
                        ModeratorName = moderator.FullName,
                        IsActive = true,
                        CreatedAt = DateTime.Now
                    })
                    .ToListAsync();

                return Ok(new
                {
                    success = true,
                    data = new ModeratorUsersListDto
                    {
                        ModeratorId = id,
                        ModeratorName = moderator.FullName,
                        TotalUsers = users.Count,
                        Users = users
                    }
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching managed users");
                return StatusCode(500, new { success = false, error = "Error fetching managed users" });
            }
        }

        /// <summary>
        /// Add a user under a moderator
        /// </summary>
        [HttpPost("{id}/users")]
        [Authorize(Roles = "primary_admin,secondary_admin")]
        public async Task<IActionResult> AddUserToModerator(int id, [FromBody] AddUserToModeratorRequest req)
        {
            try
            {
                var moderator = await _db.Users
                    .Where(u => u.Id == id && u.Role == "moderator")
                    .FirstOrDefaultAsync();

                if (moderator == null)
                    return NotFound(new { success = false, error = "Moderator not found" });

                if (string.IsNullOrWhiteSpace(req.Username) || string.IsNullOrWhiteSpace(req.FirstName))
                    return BadRequest(new { success = false, error = "Username and FirstName are required" });

                // Check if username already exists
                var existingUser = await _db.Users
                    .Where(u => u.Username == req.Username)
                    .FirstOrDefaultAsync();

                if (existingUser != null)
                    return BadRequest(new { success = false, error = "Username already exists" });

                var user = new User
                {
                    Username = req.Username,
                    FirstName = req.FirstName,
                    LastName = req.LastName,
                    Role = "user",
                    ModeratorId = id
                };

                if (!string.IsNullOrEmpty(req.Password))
                {
                    var hasher = new Microsoft.AspNetCore.Identity.PasswordHasher<User>();
                    user.PasswordHash = hasher.HashPassword(user, req.Password);
                }

                _db.Users.Add(user);
                await _db.SaveChangesAsync();

                var result = new UserWithModeratorDto
                {
                    Id = user.Id,
                    Username = user.Username,
                    FirstName = user.FirstName,
                    LastName = user.LastName,
                    Role = user.Role,
                    ModeratorId = user.ModeratorId,
                    ModeratorName = moderator.FullName,
                    IsActive = true,
                    CreatedAt = DateTime.Now
                };

                return Ok(new { success = true, data = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding user to moderator");
                return StatusCode(500, new { success = false, error = "Error adding user to moderator" });
            }
        }

        /// <summary>
        /// Get WhatsApp session for a moderator
        /// </summary>
        [HttpGet("{id}/whatsapp-session")]
        public async Task<IActionResult> GetWhatsAppSession(int id)
        {
            try
            {
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)
                    ?? User.FindFirst("sub")
                    ?? User.FindFirst("userId");
                
                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var currentUserId))
                    return BadRequest(new { success = false, error = "Invalid or missing user ID in token" });
                
                var currentUser = await _db.Users.FindAsync(currentUserId);

                // Users can only view their moderator's session, moderators can view their own
                if (currentUser?.Role == "user" && currentUser.ModeratorId != id)
                    return Forbid();

                if (currentUser?.Role == "moderator" && currentUserId != id)
                    return Forbid();

                var session = await _db.WhatsAppSessions
                    .Where(s => s.ModeratorUserId == id)
                    .FirstOrDefaultAsync();

                if (session == null)
                    return NotFound(new { success = false, error = "WhatsApp session not found" });

                var result = new WhatsAppSessionDto
                {
                    Id = session.Id,
                    ModeratorUserId = session.ModeratorUserId,
                    SessionName = session.SessionName,
                    Status = session.Status,
                    LastSyncAt = session.LastSyncAt,
                    CreatedAt = session.CreatedAt
                };

                return Ok(new { success = true, data = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching WhatsApp session");
                return StatusCode(500, new { success = false, error = "Error fetching WhatsApp session" });
            }
        }
    }
}
