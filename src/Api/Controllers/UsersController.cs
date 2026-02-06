using Microsoft.AspNetCore.Mvc;
using Clinics.Infrastructure;
using Clinics.Domain;
using Clinics.Api.Services;
using Clinics.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Clinics.Api.DTOs;
using System.Security.Claims;
using Hangfire;

namespace Clinics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class UsersController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly ILogger<UsersController> _logger;
        private readonly ISoftDeleteTTLQueries<User> _ttlQueries;
        private readonly IModeratorCascadeService _moderatorCascadeService;
        private readonly IUserContext _userContext;
        private readonly Clinics.Api.Services.IUserCascadeService _userCascadeService;
        private readonly IWebHostEnvironment _env;

        public UsersController(
            ApplicationDbContext db,
            ILogger<UsersController> logger,
            IGenericUnitOfWork unitOfWork,
            IModeratorCascadeService moderatorCascadeService,
            IUserContext userContext,
            Clinics.Api.Services.IUserCascadeService userCascadeService,
            IWebHostEnvironment env)
        {
            _db = db;
            _logger = logger;
            _ttlQueries = unitOfWork.TTLQueries<User>();
            _moderatorCascadeService = moderatorCascadeService;
            _userContext = userContext;
            _userCascadeService = userCascadeService;
            _env = env;
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
                // Extract user ID from JWT claims - try multiple claim types
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)
                    ?? User.FindFirst("sub")
                    ?? User.FindFirst("userId");

                if (userIdClaim == null)
                {
                    _logger.LogError("No user ID claim found in JWT");
                    return Unauthorized(new { error = "User ID not found in token" });
                }

                if (!int.TryParse(userIdClaim.Value, out var currentUserId))
                {
                    _logger.LogError("Invalid user ID format: {UserId}", userIdClaim.Value);
                    return BadRequest(new { error = "تنسيق معرف المستخدم غير صالح", message = "تنسيق معرف المستخدم غير صالح." });
                }

                var currentUser = await _db.Users
                    .Where(u => u.Id == currentUserId && !u.IsDeleted)
                    .FirstOrDefaultAsync();
                if (currentUser == null)
                {
                    _logger.LogWarning("User not found in database: {UserId}", currentUserId);
                    return NotFound(new { error = "Current user not found" });
                }

                IQueryable<User> query = _db.Users.Where(u => !u.IsDeleted);

                // Admins see all users
                if (currentUser.Role == "primary_admin" || currentUser.Role == "secondary_admin")
                {
                    // All users - optionally filter by role if provided
                    if (!string.IsNullOrWhiteSpace(role))
                    {
                        query = query.Where(u => u.Role == role);
                    }
                }
                // Moderators see only their managed users
                else if (currentUser.Role == "moderator")
                {
                    query = query.Where(u => u.ModeratorId == currentUserId);
                }
                else
                {
                    return Forbid();
                }

                var users = await query.ToListAsync();

                // Convert to DTO to avoid circular reference serialization issues
                var userDtos = users.Select(u => new
                {
                    u.Id,
                    u.Username,
                    u.FirstName,
                    u.LastName,
                    u.Role,
                    u.ModeratorId,
                    u.CreatedAt,
                    u.UpdatedAt,
                    u.LastLogin
                }).ToList();

                return Ok(new
                {
                    items = userDtos,
                    totalCount = userDtos.Count,
                    pageNumber = 1,
                    pageSize = userDtos.Count
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching users");
                _logger.LogError(ex, "Exception type: {ExceptionType}", ex.GetType().Name);
                _logger.LogError(ex, "Exception message: {Message}", ex.Message);
                _logger.LogError(ex, "Inner exception: {InnerMessage}", ex.InnerException?.Message);
                _logger.LogError(ex, "Stack trace: {StackTrace}", ex.StackTrace);
                return StatusCode(500, new { success = false, error = "حدث خطأ أثناء جلب المستخدمين", message = "حدث خطأ أثناء جلب قائمة المستخدمين.", details = ex.Message, innerException = ex.InnerException?.Message });
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
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)
                    ?? User.FindFirst("sub")
                    ?? User.FindFirst("userId");

                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var currentUserId))
                    return BadRequest(new { success = false, error = "Invalid or missing user ID in token" });

                var currentUser = await _db.Users
                    .Where(u => u.Id == currentUserId && !u.IsDeleted)
                    .FirstOrDefaultAsync();

                var targetUser = await _db.Users
                    .Where(u => u.Id == id && !u.IsDeleted)
                    .FirstOrDefaultAsync();
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
                return StatusCode(500, new { success = false, error = "حدث خطأ أثناء جلب بيانات المستخدم", message = "حدث خطأ أثناء جلب بيانات المستخدم." });
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
                    return BadRequest(new { success = false, error = "اسم المستخدم موجود بالفعل", message = "اسم المستخدم موجود بالفعل. يرجى اختيار اسم مستخدم آخر." });

                // Get current user to check permissions
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)
                    ?? User.FindFirst("sub")
                    ?? User.FindFirst("userId");

                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var currentUserId))
                    return BadRequest(new { success = false, error = "Invalid or missing user ID in token" });

                var currentUser = await _db.Users
                    .Where(u => u.Id == currentUserId && !u.IsDeleted)
                    .FirstOrDefaultAsync();

                if (currentUser == null)
                    return Unauthorized(new { success = false, error = "Current user not found" });

                // Determine desired role name
                var desiredRoleName = string.IsNullOrWhiteSpace(req.Role)
                    ? Clinics.Domain.UserRole.User.ToRoleName()
                    : Clinics.Domain.UserRoleExtensions.FromRoleName(req.Role).ToRoleName();

                // Only primary_admin can create secondary_admin or primary_admin users
                // Secondary_admin cannot manage secondary_admin (only primary_admin can)
                if (desiredRoleName == "secondary_admin" || desiredRoleName == "primary_admin")
                {
                    if (currentUser.Role != "primary_admin")
                    {
                        return StatusCode(403, new { success = false, error = "Only primary admin can create secondary admin or primary admin users" });
                    }
                }

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

                // Register per-moderator recurring job for new moderators
                if (user.Role == "moderator")
                {
                    RecurringJob.AddOrUpdate<ProcessQueuedMessagesJob>(
                        $"process-messages-mod-{user.Id}",
                        job => job.ExecuteForModeratorAsync(user.Id),
                        "*/60 * * * * *");
                    
                    _logger.LogInformation(
                        "Registered per-moderator job process-messages-mod-{ModeratorId} for new moderator", 
                        user.Id);
                }

                return Ok(user);
            }
            catch (DbUpdateException dbEx)
            {
                _logger.LogError(dbEx, "Database error creating user");
                var innerMessage = dbEx.InnerException?.Message ?? dbEx.Message;

                // Check for unique constraint violation on Username
                if (innerMessage.Contains("IX_Users_Username", StringComparison.OrdinalIgnoreCase) ||
                    innerMessage.Contains("Username", StringComparison.OrdinalIgnoreCase) &&
                    (innerMessage.Contains("UNIQUE", StringComparison.OrdinalIgnoreCase) ||
                     innerMessage.Contains("duplicate", StringComparison.OrdinalIgnoreCase) ||
                     innerMessage.Contains("unique constraint", StringComparison.OrdinalIgnoreCase)))
                {
                    return BadRequest(new
                    {
                        success = false,
                        error = "اسم المستخدم موجود بالفعل",
                        message = $"اسم المستخدم '{req.Username}' موجود بالفعل. يرجى اختيار اسم مستخدم آخر."
                    });
                }

                // Other database constraint violations
                if (innerMessage.Contains("FOREIGN KEY", StringComparison.OrdinalIgnoreCase) ||
                    innerMessage.Contains("constraint", StringComparison.OrdinalIgnoreCase))
                {
                    return BadRequest(new
                    {
                        success = false,
                        error = "تعذر إنشاء المستخدم",
                        message = "تعذر إنشاء المستخدم بسبب بيانات غير صالحة أو انتهاك قيد قاعدة البيانات."
                    });
                }

                // Generic database error
                return StatusCode(500, new
                {
                    success = false,
                    error = "حدث خطأ أثناء إنشاء المستخدم",
                    message = "حدث خطأ أثناء إنشاء المستخدم. يرجى المحاولة مرة أخرى.",
                    details = _env?.IsDevelopment() == true ? innerMessage : null
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating user");
                return StatusCode(500, new
                {
                    success = false,
                    error = "حدث خطأ غير متوقع أثناء إنشاء المستخدم",
                    message = "حدث خطأ غير متوقع أثناء إنشاء المستخدم. يرجى المحاولة مرة أخرى.",
                    details = _env?.IsDevelopment() == true ? ex.Message : null
                });
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
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)
                    ?? User.FindFirst("sub")
                    ?? User.FindFirst("userId");

                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var currentUserId))
                    return BadRequest(new { success = false, error = "Invalid or missing user ID in token" });

                var currentUser = await _db.Users
                    .Where(u => u.Id == currentUserId && !u.IsDeleted)
                    .FirstOrDefaultAsync();

                var targetUser = await _db.Users
                    .Where(u => u.Id == id && !u.IsDeleted)
                    .FirstOrDefaultAsync();

                if (targetUser == null)
                    return NotFound(new { success = false, error = "User not found" });

                if (currentUser == null)
                    return Unauthorized(new { success = false, error = "Current user not found" });

                // Only primary_admin can update primary_admin or secondary_admin users
                // Secondary_admin cannot update secondary_admin (only primary_admin can)
                if (targetUser.Role == "primary_admin" || targetUser.Role == "secondary_admin")
                {
                    if (currentUser.Role != "primary_admin")
                    {
                        return StatusCode(403, new { success = false, error = "Only primary admin can update primary admin or secondary admin users" });
                    }
                }

                // Only admin can update, or moderator can update their managed users
                if (currentUser.Role != "primary_admin" && currentUser.Role != "secondary_admin")
                {
                    if (currentUser.Role != "moderator" || targetUser.ModeratorId != currentUserId)
                        return Forbid();
                }

                // Update firstName if provided
                if (!string.IsNullOrEmpty(req.FirstName))
                    targetUser.FirstName = req.FirstName.Trim();

                // Update lastName if provided
                if (req.LastName != null)
                    targetUser.LastName = req.LastName.Trim();

                // Update username if provided
                if (!string.IsNullOrEmpty(req.Username))
                {
                    var trimmedUsername = req.Username.Trim();

                    // Check if username is already taken (by a different user)
                    var existingUser = await _db.Users.FirstOrDefaultAsync(u => u.Username == trimmedUsername && u.Id != id);
                    if (existingUser != null)
                        return BadRequest(new { success = false, error = "اسم المستخدم موجود بالفعل", message = "اسم المستخدم موجود بالفعل. يرجى اختيار اسم مستخدم آخر." });

                    targetUser.Username = trimmedUsername;
                }

                // Handle password update if provided
                if (!string.IsNullOrEmpty(req.Password))
                {
                    // If CurrentPassword is provided, verify it (for users updating their own password)
                    if (!string.IsNullOrEmpty(req.CurrentPassword))
                    {
                        var hasher = new Microsoft.AspNetCore.Identity.PasswordHasher<User>();
                        if (string.IsNullOrEmpty(targetUser.PasswordHash))
                            return BadRequest(new { success = false, error = "User has no password set" });

                        var verificationResult = hasher.VerifyHashedPassword(targetUser, targetUser.PasswordHash!, req.CurrentPassword);

                        if (verificationResult == Microsoft.AspNetCore.Identity.PasswordVerificationResult.Failed)
                            return BadRequest(new { success = false, error = "Current password is incorrect" });

                        // Validate that new password is different from current password
                        var newPasswordVerificationResult = hasher.VerifyHashedPassword(targetUser, targetUser.PasswordHash!, req.Password);
                        if (newPasswordVerificationResult == Microsoft.AspNetCore.Identity.PasswordVerificationResult.Success)
                            return BadRequest(new { success = false, error = "New password must be different from current password" });
                    }

                    var newHasher = new Microsoft.AspNetCore.Identity.PasswordHasher<User>();
                    targetUser.PasswordHash = newHasher.HashPassword(targetUser, req.Password);
                }

                // Set UpdatedBy and UpdatedAt for audit trail
                targetUser.UpdatedBy = currentUserId;
                targetUser.UpdatedAt = DateTime.UtcNow;

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
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)
                    ?? User.FindFirst("sub")
                    ?? User.FindFirst("userId");

                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var currentUserId))
                    return BadRequest(new { success = false, error = "Invalid or missing user ID in token" });

                var currentUser = await _db.Users
                    .Where(u => u.Id == currentUserId && !u.IsDeleted)
                    .FirstOrDefaultAsync();

                var targetUser = await _db.Users
                    .Where(u => u.Id == id && !u.IsDeleted)
                    .FirstOrDefaultAsync();

                if (targetUser == null)
                    return NotFound(new { success = false, error = "User not found" });

                if (currentUser == null)
                    return Unauthorized(new { success = false, error = "Current user not found" });

                // Only primary_admin can delete primary_admin or secondary_admin users
                // Secondary_admin cannot delete secondary_admin (only primary_admin can)
                if (targetUser.Role == "primary_admin" || targetUser.Role == "secondary_admin")
                {
                    if (currentUser.Role != "primary_admin")
                    {
                        return StatusCode(403, new { success = false, error = "Only primary admin can delete primary admin or secondary admin users" });
                    }
                }

                // Only admin can delete, or moderator can delete their managed users
                if (currentUser.Role != "primary_admin" && currentUser.Role != "secondary_admin")
                {
                    if (currentUser.Role != "moderator" || targetUser.ModeratorId != currentUserId)
                        return Forbid();
                }



                // Soft-delete user
                var (success, errorMessage) = await _userCascadeService.SoftDeleteUserAsync(id, currentUserId);

                if (!success)
                {
                    return BadRequest(new { success = false, error = errorMessage });
                }

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

                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)
                    ?? User.FindFirst("sub")
                    ?? User.FindFirst("userId");

                if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var currentUserId))
                    return BadRequest(new { success = false, error = "Invalid or missing user ID in token" });

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

        /// <summary>
        /// GET /api/users/trash?page=1&amp;pageSize=10
        /// Get soft-deleted users (trash). Admins see all; moderators see managed users.
        /// </summary>
        [HttpGet("trash")]
        [Authorize(Roles = "primary_admin,secondary_admin,moderator")]
        public async Task<IActionResult> GetTrash([FromQuery] int page = 1, [FromQuery] int pageSize = 10)
        {
            try
            {
                var currentUserId = _userContext.GetUserId();
                var moderatorId = _userContext.GetModeratorId();
                var isAdmin = _userContext.IsAdmin();

                var query = _ttlQueries.QueryTrash(30).AsQueryable();

                // Exclude users whose moderator is deleted (cascade delete scenario)
                // Users deleted as part of moderator deletion should not appear in trash
                // We exclude users where their moderator is also deleted (regardless of timestamp)
                // This ensures only the moderator appears in trash, not its managed users
                // Logic:
                // 1. secondary_admin: Always show if deleted.
                // 2. moderator: Always show if deleted.
                // 3. User: Show if deleted, BUT if their moderator is also deleted (cascade), do NOT show (hide cascaded users).
                query = query.Where(u =>
                    u.Role == "secondary_admin" ||
                    u.Role == "moderator" ||
                    (
                        u.Role == "User" &&
                        (
                            u.ModeratorId == null ||
                            !_db.Users.IgnoreQueryFilters().Any(m =>
                                m.Id == u.ModeratorId.Value &&
                                m.Role == "moderator" &&
                                m.IsDeleted
                            )
                        )
                    )
                );

                // Moderators see only their managed users
                if (!isAdmin && moderatorId.HasValue)
                {
                    query = query.Where(u => u.ModeratorId == moderatorId.Value);
                }

                var total = await query.CountAsync();
                var usersList = await query
                    .OrderByDescending(u => u.DeletedAt)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(u => new
                    {
                        u.Id,
                        u.FirstName,
                        u.LastName,
                        u.Username,
                        u.Role,
                        u.ModeratorId,
                        u.DeletedAt,
                        DaysRemainingInTrash = _ttlQueries.GetDaysRemainingInTrash(u, 30),
                        u.DeletedBy
                    })
                    .ToListAsync();

                // Get deleted by usernames separately to avoid subquery issues
                var deletedByUserIds = usersList.Where(u => u.DeletedBy.HasValue).Select(u => u.DeletedBy!.Value).Distinct().ToList();
                var deletedByUsers = await _db.Users
                    .Where(d => deletedByUserIds.Contains(d.Id))
                    .Select(d => new { d.Id, d.Username })
                    .ToListAsync();
                var deletedByUsernameMap = deletedByUsers.ToDictionary(d => d.Id, d => d.Username);

                var users = usersList.Select(u => new
                {
                    u.Id,
                    u.FirstName,
                    u.LastName,
                    u.Username,
                    u.Role,
                    u.ModeratorId,
                    u.DeletedAt,
                    u.DaysRemainingInTrash,
                    u.DeletedBy,
                    DeletedByUsername = u.DeletedBy.HasValue && deletedByUsernameMap.TryGetValue(u.DeletedBy.Value, out var username)
                        ? username
                        : (string?)null
                }).ToList();

                return Ok(new { success = true, data = users, total, page, pageSize });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching trash users");
                return StatusCode(500, new { message = "Error fetching trash users" });
            }
        }

        /// <summary>
        /// GET /api/users/archived?page=1&amp;pageSize=10
        /// Admin-only endpoint to view archived users (soft-deleted 30+ days ago).
        /// </summary>
        [HttpGet("archived")]
        [Authorize(Roles = "primary_admin,secondary_admin")]
        public async Task<IActionResult> GetArchived([FromQuery] int page = 1, [FromQuery] int pageSize = 10)
        {
            try
            {
                var query = _ttlQueries.QueryArchived(30).AsQueryable();

                var total = await query.CountAsync();
                var users = await query
                    .OrderByDescending(u => u.DeletedAt)
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .Select(u => new
                    {
                        u.Id,
                        u.FirstName,
                        u.LastName,
                        u.Username,
                        u.Role,
                        u.ModeratorId,
                        u.DeletedAt,
                        DaysDeleted = u.DeletedAt.HasValue ? (int)(DateTime.UtcNow - u.DeletedAt.Value).TotalDays : 0,
                        u.DeletedBy,
                        Note = "Read-only: Restore window expired"
                    })
                    .ToListAsync();

                return Ok(new { success = true, data = users, total, page, pageSize });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching archived users");
                return StatusCode(500, new { message = "Error fetching archived users" });
            }
        }

        /// <summary>
        /// POST /api/users/{id}/restore
        /// Restore a soft-deleted user from trash.
        /// Moderators cannot restore admins. Only admins can restore.
        /// </summary>
        [HttpPost("{id}/restore")]
        [Authorize(Roles = "primary_admin,secondary_admin")]
        public async Task<IActionResult> Restore(int id)
        {
            try
            {
                var userId = _userContext.GetUserId();

                var user = await _db.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.Id == id);
                if (user == null)
                    return NotFound(new { success = false, error = "User not found", statusCode = 404 });

                // Check if user is not deleted
                if (!user.IsDeleted)
                    return BadRequest(new { success = false, error = "User is not in trash", statusCode = 400 });

                // Attempt restore
                var result = await _moderatorCascadeService.RestoreModeratorAsync(user, userId, ttlDays: 30);

                if (!result.Success)
                {
                    if (result.StatusCode == 409)
                    {
                        return Conflict(new
                        {
                            success = false,
                            error = result.Message,
                            errorCode = result.ErrorCode,
                            statusCode = 409,
                            metadata = result.Metadata
                        });
                    }
                    return StatusCode(result.StatusCode, new { success = false, error = result.Message, statusCode = result.StatusCode });
                }

                return Ok(new { success = true, data = user, statusCode = 200 });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error restoring user {UserId}", id);
                return StatusCode(500, new { message = "Error restoring user" });
            }
        }
    }
}
