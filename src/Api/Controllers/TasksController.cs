using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Clinics.Api.DTOs;
using Clinics.Infrastructure;

namespace Clinics.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TasksController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ILogger<TasksController> _logger;

    public TasksController(ApplicationDbContext context, ILogger<TasksController> logger)
    {
        _context = context;
        _logger = logger;
    }

    /// <summary>
    /// Get all failed tasks with detailed information
    /// </summary>
    [HttpGet("failed")]
    public async Task<IActionResult> GetFailedTasks()
    {
        try
        {
            var failedTasks = await _context.FailedTasks
                .Include(ft => ft.Patient)
                .Include(ft => ft.Queue)
                .Include(ft => ft.Message)
                .OrderByDescending(ft => ft.CreatedAt)
                .Select(ft => new FailedTaskDto
                {
                    TaskId = ft.Id,
                    QueueName = ft.Queue != null ? ft.Queue.DoctorName : "غير محدد",
                    PatientName = ft.Patient != null ? ft.Patient.FullName : "غير محدد",
                    Phone = ft.Patient != null ? ft.Patient.PhoneNumber : ft.Message != null ? ft.Message.RecipientPhone : "",
                    Message = ft.Message != null ? ft.Message.Content : "",
                    Error = ft.Reason ?? "خطأ غير معروف",
                    ErrorDetails = ft.ProviderResponse ?? "",
                    RetryCount = ft.RetryCount,
                    FailedAt = ft.CreatedAt,
                    RetryHistory = new List<RetryHistoryItem>() // TODO: Implement retry history tracking
                })
                .ToListAsync();

            return Ok(new { success = true, data = failedTasks });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching failed tasks");
            return StatusCode(500, new { success = false, error = "حدث خطأ أثناء جلب المهام الفاشلة" });
        }
    }

    /// <summary>
    /// Retry multiple failed tasks
    /// </summary>
    [HttpPost("retry")]
    public async Task<IActionResult> RetryTasks([FromBody] RetryTasksRequest request)
    {
        try
        {
            if (request.TaskIds == null || !request.TaskIds.Any())
            {
                return BadRequest(new { success = false, error = "لم يتم تحديد أي مهام لإعادة المحاولة" });
            }

            var failedTasks = await _context.FailedTasks
                .Include(ft => ft.Message)
                .Where(ft => request.TaskIds.Contains(ft.Id))
                .ToListAsync();

            int retriedCount = 0;
            var errors = new List<string>();

            foreach (var failedTask in failedTasks)
            {
                try
                {
                    // Check retry limit
                    if (failedTask.RetryCount >= 3)
                    {
                        errors.Add($"المهمة {failedTask.Id}: تجاوز الحد الأقصى لعدد المحاولات");
                        continue;
                    }

                    // Update the original message status to retry
                    if (failedTask.MessageId.HasValue)
                    {
                        var message = await _context.Messages.FindAsync(failedTask.MessageId.Value);
                        if (message != null)
                        {
                            message.Status = "queued";
                            message.Attempts = 0; // Reset attempts for retry
                        }
                    }

                    // Update failed task record
                    failedTask.RetryCount++;
                    failedTask.LastRetryAt = DateTime.UtcNow;

                    retriedCount++;
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error retrying task {TaskId}", failedTask.Id);
                    errors.Add($"المهمة {failedTask.Id}: {ex.Message}");
                }
            }

            await _context.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                data = new RetryTasksResponse
                {
                    RetriedCount = retriedCount,
                    Errors = errors
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrying tasks");
            return StatusCode(500, new { success = false, error = "حدث خطأ أثناء إعادة محاولة المهام" });
        }
    }

    /// <summary>
    /// Delete multiple failed tasks
    /// </summary>
    [HttpDelete("failed")]
    public async Task<IActionResult> DeleteFailedTasks([FromBody] DeleteTasksRequest request)
    {
        try
        {
            if (request.TaskIds == null || !request.TaskIds.Any())
            {
                return BadRequest(new { success = false, error = "لم يتم تحديد أي مهام للحذف" });
            }

            var failedTasks = await _context.FailedTasks
                .Where(ft => request.TaskIds.Contains(ft.Id))
                .ToListAsync();

            _context.FailedTasks.RemoveRange(failedTasks);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                success = true,
                data = new DeleteTasksResponse
                {
                    DeletedCount = failedTasks.Count
                }
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deleting failed tasks");
            return StatusCode(500, new { success = false, error = "حدث خطأ أثناء حذف المهام" });
        }
    }
}
