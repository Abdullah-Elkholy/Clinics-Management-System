using Microsoft.AspNetCore.Mvc;
using Clinics.Infrastructure;
using Clinics.Domain;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace Clinics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin,moderator")]
    public class TemplatesController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly ILogger<TemplatesController> _logger;

        public TemplatesController(ApplicationDbContext db, ILogger<TemplatesController> logger)
        {
            _db = db;
            _logger = logger;
        }

        [HttpGet]
        public async Task<IActionResult> Get()
        {
            try
            {
                var user = User.FindFirst(ClaimTypes.NameIdentifier);
                var currentUserId = int.Parse(user?.Value ?? "0");
                var currentUser = await _db.Users.FindAsync(currentUserId);

                // Get moderator ID based on user role
                int? moderatorId = null;
                if (currentUser?.Role == "moderator")
                    moderatorId = currentUser.Id;
                else if (currentUser?.Role == "user")
                    moderatorId = currentUser.ModeratorId;
                else if (currentUser?.Role == "primary_admin" || currentUser?.Role == "secondary_admin")
                    moderatorId = null; // Admins can see all

                var query = _db.MessageTemplates.AsQueryable();
                if (moderatorId.HasValue)
                    query = query.Where(t => t.ModeratorId == moderatorId.Value);

                var templates = await query.ToListAsync();
                return Ok(new { success = true, data = templates });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error fetching templates");
                return StatusCode(500, new { success = false, error = "Error fetching templates" });
            }
        }

        [HttpPost]
        public async Task<IActionResult> Create([FromBody] CreateTemplateRequest req)
        {
            try
            {
                if (!ModelState.IsValid)
                    return BadRequest(new { success = false, errors = ModelState.Values.SelectMany(v => v.Errors).Select(e => e.ErrorMessage) });

                var user = User.FindFirst(ClaimTypes.NameIdentifier);
                var currentUserId = int.Parse(user?.Value ?? "0");
                var currentUser = await _db.Users.FindAsync(currentUserId);

                // Get moderator ID
                int moderatorId;
                if (currentUser?.Role == "moderator")
                    moderatorId = currentUser.Id;
                else if (currentUser?.ModeratorId.HasValue == true)
                    moderatorId = currentUser.ModeratorId.Value;
                else if (currentUser?.Role == "primary_admin" || currentUser?.Role == "secondary_admin")
                    moderatorId = 0; // Will need to specify
                else
                    return Forbid();

                if (moderatorId == 0)
                    return BadRequest(new { success = false, error = "Could not determine moderator" });

                var template = new MessageTemplate
                {
                    Title = req.Title,
                    Content = req.Content,
                    IsShared = req.IsShared,
                    IsActive = true,
                    CreatedBy = currentUserId,
                    ModeratorId = moderatorId,
                    CreatedAt = DateTime.UtcNow
                };

                _db.MessageTemplates.Add(template);
                await _db.SaveChangesAsync();
                return Ok(new { success = true, data = template });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating template");
                return StatusCode(500, new { success = false, error = "Error creating template" });
            }
        }

        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, [FromBody] UpdateTemplateRequest req)
        {
            try
            {
                var user = User.FindFirst(ClaimTypes.NameIdentifier);
                var currentUserId = int.Parse(user?.Value ?? "0");
                var currentUser = await _db.Users.FindAsync(currentUserId);

                var existing = await _db.MessageTemplates.FindAsync(id);
                if (existing == null)
                    return NotFound(new { success = false });

                // Verify ownership
                if (currentUser?.Role == "moderator" && existing.ModeratorId != currentUser.Id)
                    return Forbid();
                if (currentUser?.Role == "user" && existing.ModeratorId != currentUser.ModeratorId)
                    return Forbid();

                if (!string.IsNullOrEmpty(req.Title))
                    existing.Title = req.Title;

                if (!string.IsNullOrEmpty(req.Content))
                    existing.Content = req.Content;

                if (req.IsShared.HasValue)
                    existing.IsShared = req.IsShared.Value;

                if (req.IsActive.HasValue)
                    existing.IsActive = req.IsActive.Value;

                await _db.SaveChangesAsync();
                return Ok(new { success = true, data = existing });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error updating template");
                return StatusCode(500, new { success = false, error = "Error updating template" });
            }
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                var user = User.FindFirst(ClaimTypes.NameIdentifier);
                var currentUserId = int.Parse(user?.Value ?? "0");
                var currentUser = await _db.Users.FindAsync(currentUserId);

                var existing = await _db.MessageTemplates.FindAsync(id);
                if (existing == null)
                    return NotFound(new { success = false });

                // Verify ownership
                if (currentUser?.Role == "moderator" && existing.ModeratorId != currentUser.Id)
                    return Forbid();
                if (currentUser?.Role == "user" && existing.ModeratorId != currentUser.ModeratorId)
                    return Forbid();

                _db.MessageTemplates.Remove(existing);
                await _db.SaveChangesAsync();
                return Ok(new { success = true });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error deleting template");
                return StatusCode(500, new { success = false, error = "Error deleting template" });
            }
        }
    }

    public class CreateTemplateRequest
    {
        public string Title { get; set; } = null!;
        public string Content { get; set; } = null!;
        public bool IsShared { get; set; } = true;
    }

    public class UpdateTemplateRequest
    {
        public string? Title { get; set; }
        public string? Content { get; set; }
        public bool? IsShared { get; set; }
        public bool? IsActive { get; set; }
    }
}
