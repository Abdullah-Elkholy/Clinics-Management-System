using Microsoft.AspNetCore.Mvc;
using Clinics.Infrastructure;
using Clinics.Domain;
using Microsoft.EntityFrameworkCore;

namespace Clinics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Microsoft.AspNetCore.Authorization.Authorize(Roles = "primary_admin,secondary_admin")]
    public class FailedTasksController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        public FailedTasksController(ApplicationDbContext db) { _db = db; }

        [HttpGet]
        public async Task<IActionResult> GetAll() => Ok(new { success = true, data = await _db.FailedTasks.ToListAsync() });

        [HttpPost("{id}/retry")]
        public async Task<IActionResult> Retry(long id)
        {
            var task = await _db.FailedTasks.FindAsync(id);
            if (task == null) return NotFound(new { success = false });

            // simple retry: requeue message if available
            if (task.MessageId.HasValue)
            {
                var msg = await _db.Messages.FindAsync(task.MessageId.Value);
                if (msg != null)
                {
                    msg.Status = "queued";
                    msg.Attempts = 0;
                    _db.FailedTasks.Remove(task);
                    await _db.SaveChangesAsync();
                    return Ok(new { success = true });
                }
            }

            return BadRequest(new { success = false });
        }
    }
}
