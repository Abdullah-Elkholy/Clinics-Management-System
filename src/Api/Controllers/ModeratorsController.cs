using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;
using Clinics.Infrastructure;
using Clinics.Domain;
using Clinics.Api.DTOs;
using Clinics.Api.Helpers;
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
                    .Where(u => u.Role == "moderator" && !u.IsDeleted)
                    .Select(u => new ModeratorDto
                    {
                        Id = u.Id,
                        Username = u.Username,
                        FirstName = u.FirstName,
                        LastName = u.LastName,
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow
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
                
                var currentUser = await _db.Users
                    .Where(u => u.Id == currentUserId && !u.IsDeleted)
                    .FirstOrDefaultAsync();

                // Moderators can only view their own details, admins can view any
                if (currentUser?.Role != "primary_admin" && currentUser?.Role != "secondary_admin" && currentUserId != id)
                {
                    return Forbid();
                }

                var moderator = await _db.Users
                    .Where(u => u.Id == id && u.Role == "moderator" && !u.IsDeleted)
                    .FirstOrDefaultAsync();

                if (moderator == null)
                    return NotFound(new { success = false, error = "Moderator not found" });

                var managedUsers = await _db.Users
                    .Where(u => u.ModeratorId == id && !u.IsDeleted)
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
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow,
                    TotalManagedUsers = managedUsers,
                    TotalQueues = queues,
                    TotalMessageTemplates = templates,
                    Quota = quota != null ? new QuotaDto
                    {
                        Id = quota.Id,
                        Limit = QuotaHelper.ToApiMessagesQuota(quota.MessagesQuota),
                        Used = (int)quota.ConsumedMessages, // Convert long to int for API
                        QueuesLimit = QuotaHelper.ToApiQueuesQuota(quota.QueuesQuota),
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
                    return BadRequest(new { success = false, error = "اسم المستخدم والاسم الأول مطلوبان", message = "اسم المستخدم والاسم الأول مطلوبان." });

                // Check if username already exists
                var existingUser = await _db.Users
                    .Where(u => u.Username == req.Username)
                    .FirstOrDefaultAsync();

                if (existingUser != null)
                    return BadRequest(new { success = false, error = "اسم المستخدم موجود بالفعل", message = "اسم المستخدم موجود بالفعل. يرجى اختيار اسم مستخدم آخر." });

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
                // Handle spaces in WhatsApp phone number (remove them for consistency)
                var whatsappPhoneCleaned = !string.IsNullOrWhiteSpace(req.WhatsAppPhoneNumber)
                    ? req.WhatsAppPhoneNumber.Replace(" ", "")
                    : req.WhatsAppPhoneNumber;
                
                var settings = new ModeratorSettings
                {
                    ModeratorUserId = moderator.Id,
                    WhatsAppPhoneNumber = whatsappPhoneCleaned,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                _db.ModeratorSettings.Add(settings);

                // Create default quota (unlimited messages and queues: -1 = unlimited)
                var quota = new Quota
                {
                    ModeratorUserId = moderator.Id,
                    MessagesQuota = -1, // -1 = unlimited
                    ConsumedMessages = 0,
                    QueuesQuota = -1, // -1 = unlimited
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
                    WhatsAppPhoneNumber = whatsappPhoneCleaned,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
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
                    {
                        // Handle spaces in WhatsApp phone number (remove them for consistency)
                        settings.WhatsAppPhoneNumber = req.WhatsAppPhoneNumber.Replace(" ", "");
                    }

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
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
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

                // Delete associated quota
                var quota = await _db.Quotas
                    .Where(q => q.ModeratorUserId == id)
                    .FirstOrDefaultAsync();

                if (quota != null)
                    _db.Quotas.Remove(quota);

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
                    .Where(u => u.Id == id && u.Role == "moderator" && !u.IsDeleted)
                    .FirstOrDefaultAsync();

                if (moderator == null)
                    return NotFound(new { success = false, error = "Moderator not found" });

                var users = await _db.Users
                    .Where(u => u.ModeratorId == id && !u.IsDeleted)
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
                        CreatedAt = DateTime.UtcNow
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
                    CreatedAt = DateTime.UtcNow
                };

                return Ok(new { success = true, data = result });
            }
            catch (DbUpdateException dbEx)
            {
                _logger.LogError(dbEx, "Database error adding user to moderator");
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
                    error = "حدث خطأ أثناء إضافة المستخدم",
                    message = "حدث خطأ أثناء إضافة المستخدم. يرجى المحاولة مرة أخرى."
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error adding user to moderator");
                return StatusCode(500, new 
                { 
                    success = false, 
                    error = "حدث خطأ غير متوقع أثناء إضافة المستخدم",
                    message = "حدث خطأ غير متوقع أثناء إضافة المستخدم. يرجى المحاولة مرة أخرى."
                });
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
                
                var currentUser = await _db.Users
                    .Where(u => u.Id == currentUserId && !u.IsDeleted)
                    .FirstOrDefaultAsync();

                // Permission checks:
                // - Admins can view any moderator's session
                // - Moderators can only view their own session
                // - Users can only view their assigned moderator's session
                var isAdmin = currentUser?.Role == "primary_admin" || currentUser?.Role == "secondary_admin";
                
                if (!isAdmin)
                {
                    if (currentUser?.Role == "user" && currentUser.ModeratorId != id)
                        return Forbid();

                    if (currentUser?.Role == "moderator" && currentUserId != id)
                        return Forbid();
                }

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
                    CreatedAt = session.CreatedAt,
                    ProviderSessionId = session.ProviderSessionId,
                    CreatedByUserId = session.CreatedByUserId,
                    LastActivityUserId = session.LastActivityUserId,
                    LastActivityAt = session.LastActivityAt
                };

                return Ok(new { success = true, data = result });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching WhatsApp session");
                return StatusCode(500, new { success = false, error = "Error fetching WhatsApp session" });
            }
        }

        /// <summary>
        /// Pause all tasks for a moderator (sets WhatsAppSession.IsPaused = true)
        /// </summary>
        [HttpPost("{moderatorId}/pause-all")]
        [Authorize(Roles = "primary_admin,secondary_admin,moderator,user")]
        public async Task<IActionResult> PauseAllModeratorTasks(int moderatorId, [FromBody] PauseAllRequest request)
        {
            try
            {
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                    ?? User.FindFirst("sub")?.Value
                    ?? User.FindFirst("userId")?.Value;

                if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
                {
                    return Unauthorized(new { success = false, error = "المستخدم غير مصرح له" });
                }

                // Verify user has permission to pause this moderator's tasks
                var currentUser = await _db.Users.FindAsync(userId);
                if (currentUser == null) 
                    return Unauthorized(new { success = false, error = "المستخدم غير موجود" });

                var isAdmin = currentUser.Role == "primary_admin" || currentUser.Role == "secondary_admin";
                var isModerator = currentUser.Role == "moderator";
                var isUser = currentUser.Role == "user";

                // Users under the moderator can manage everything (pause, resume, send, etc.)
                // Moderators can manage their own tasks
                // Admins can manage any moderator's tasks
                if (!isAdmin)
                {
                    if (isModerator && currentUser.Id != moderatorId)
                    {
                        return Forbid();
                    }

                    if (isUser && currentUser.ModeratorId != moderatorId)
                    {
                        return Forbid();
                    }
                }

                // Get or create WhatsAppSession for moderator
                var whatsappSession = await _db.WhatsAppSessions
                    .FirstOrDefaultAsync(ws => ws.ModeratorUserId == moderatorId);

                if (whatsappSession == null)
                {
                    // Create new WhatsAppSession if doesn't exist
                    whatsappSession = new WhatsAppSession
                    {
                        ModeratorUserId = moderatorId,
                        Status = "connected",
                        CreatedAt = DateTime.UtcNow,
                        CreatedByUserId = userId,
                        IsPaused = false
                    };
                    _db.WhatsAppSessions.Add(whatsappSession);
                }

                // Set global pause ONLY (no cascade to MessageSessions)
                // The priority logic in MessageProcessor will check WhatsAppSession.IsPaused first
                whatsappSession.IsPaused = true;
                whatsappSession.PausedAt = DateTime.UtcNow;
                whatsappSession.PausedBy = userId;
                whatsappSession.PauseReason = request?.Reason ?? "User paused";
                whatsappSession.UpdatedAt = DateTime.UtcNow;
                whatsappSession.UpdatedBy = userId;

                await _db.SaveChangesAsync();

                _logger.LogInformation("Moderator {ModeratorId} tasks paused globally by user {UserId}", moderatorId, userId);

                return Ok(new
                {
                    success = true,
                    message = "تم إيقاف جميع المهام للمشرف"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error pausing moderator tasks");
                return StatusCode(500, new { success = false, error = "فشل إيقاف المهام" });
            }
        }

        /// <summary>
        /// Resume all tasks for a moderator (sets WhatsAppSession.IsPaused = false)
        /// </summary>
        [HttpPost("{moderatorId}/resume-all")]
        [Authorize(Roles = "primary_admin,secondary_admin,moderator,user")]
        public async Task<IActionResult> ResumeAllModeratorTasks(int moderatorId)
        {
            try
            {
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                    ?? User.FindFirst("sub")?.Value
                    ?? User.FindFirst("userId")?.Value;

                if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
                {
                    return Unauthorized(new { success = false, error = "المستخدم غير مصرح له" });
                }

                // Verify permissions (same as pause - users can manage)
                var currentUser = await _db.Users.FindAsync(userId);
                if (currentUser == null) 
                    return Unauthorized(new { success = false, error = "المستخدم غير موجود" });

                var isAdmin = currentUser.Role == "primary_admin" || currentUser.Role == "secondary_admin";
                var isModerator = currentUser.Role == "moderator";
                var isUser = currentUser.Role == "user";

                // Users under the moderator can manage everything
                if (!isAdmin)
                {
                    if (isModerator && currentUser.Id != moderatorId)
                    {
                        return Forbid();
                    }

                    if (isUser && currentUser.ModeratorId != moderatorId)
                    {
                        return Forbid();
                    }
                }

                // Get WhatsAppSession
                var whatsappSession = await _db.WhatsAppSessions
                    .FirstOrDefaultAsync(ws => ws.ModeratorUserId == moderatorId);

                if (whatsappSession == null || !whatsappSession.IsPaused)
                {
                    return Ok(new { success = true, message = "لا توجد مهام موقوفة" });
                }

                // Resume global pause ONLY (no cascade resume needed)
                // Messages will be automatically processable when global pause is removed
                whatsappSession.IsPaused = false;
                whatsappSession.PausedAt = null;
                whatsappSession.PausedBy = null;
                whatsappSession.PauseReason = null;
                whatsappSession.UpdatedAt = DateTime.UtcNow;
                whatsappSession.UpdatedBy = userId;

                await _db.SaveChangesAsync();

                _logger.LogInformation("Moderator {ModeratorId} tasks resumed by user {UserId}", moderatorId, userId);

                return Ok(new
                {
                    success = true,
                    message = "تم استئناف جميع المهام للمشرف"
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error resuming moderator tasks");
                return StatusCode(500, new { success = false, error = "فشل استئناف المهام" });
            }
        }

        /// <summary>
        /// Get global pause state for a moderator
        /// </summary>
        [HttpGet("{moderatorId}/pause-state")]
        [Authorize(Roles = "primary_admin,secondary_admin,moderator,user")]
        public async Task<IActionResult> GetGlobalPauseState(int moderatorId)
        {
            try
            {
                // Verify permissions: users can only access their assigned moderator's pause state
                var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value
                    ?? User.FindFirst("sub")?.Value
                    ?? User.FindFirst("userId")?.Value;

                if (string.IsNullOrEmpty(userIdClaim) || !int.TryParse(userIdClaim, out int userId))
                {
                    return Unauthorized(new { success = false, error = "المستخدم غير مصرح له" });
                }

                var currentUser = await _db.Users.FindAsync(userId);
                if (currentUser == null) 
                    return Unauthorized(new { success = false, error = "المستخدم غير موجود" });

                var isAdmin = currentUser.Role == "primary_admin" || currentUser.Role == "secondary_admin";
                var isModerator = currentUser.Role == "moderator";
                var isUser = currentUser.Role == "user";

                // Verify access: users can only access their assigned moderator's pause state
                if (!isAdmin)
                {
                    if (isModerator && currentUser.Id != moderatorId)
                    {
                        return Forbid();
                    }

                    if (isUser && (!currentUser.ModeratorId.HasValue || currentUser.ModeratorId.Value != moderatorId))
                    {
                        return Forbid();
                    }
                }

                var whatsappSession = await _db.WhatsAppSessions
                    .AsNoTracking()
                    .FirstOrDefaultAsync(ws => ws.ModeratorUserId == moderatorId);

                if (whatsappSession == null)
                {
                    return Ok(new
                    {
                        isPaused = false,
                        pauseReason = (string?)null,
                        pausedAt = (DateTime?)null
                    });
                }

                return Ok(new
                {
                    isPaused = whatsappSession.IsPaused,
                    pauseReason = whatsappSession.PauseReason,
                    pausedAt = whatsappSession.PausedAt
                });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching pause state");
                return StatusCode(500, new { success = false, error = "فشل جلب حالة الإيقاف" });
            }
        }
    }

    public class PauseAllRequest
    {
        public string? Reason { get; set; }
    }
}
