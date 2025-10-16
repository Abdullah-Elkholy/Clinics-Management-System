using Microsoft.AspNetCore.Mvc;
using Clinics.Domain;

namespace Clinics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class QueuesController : ControllerBase
    {
        [HttpGet]
        public IActionResult GetSample()
        {
            var queues = new[] {
                new Queue { Id = 1, DoctorName = "د. أحمد محمد", Description = "عيادة الصباح", CreatedBy = 1, CurrentPosition = 3, EstimatedWaitMinutes = 15 },
                new Queue { Id = 2, DoctorName = "د. فاطمة علي", Description = "عيادة الأطفال", CreatedBy = 2, CurrentPosition = 1, EstimatedWaitMinutes = 20 }
            };
            return Ok(new { success = true, data = queues });
        }
    }
}
