using Microsoft.AspNetCore.Mvc;

namespace Clinics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class HealthController : ControllerBase
    {
        [HttpGet]
        public IActionResult Get() => Ok(new { status = "healthy", time = System.DateTime.UtcNow });
    }
}
