using Microsoft.AspNetCore.Mvc;

namespace ClinicsManagementService.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class MessagingController : ControllerBase
    {
        private readonly WhatsAppService _whatsAppService;

        public MessagingController(WhatsAppService whatsAppService)
        {
            _whatsAppService = whatsAppService;
        }

        [HttpPost("send")]
        public async Task<IActionResult> Send([FromQuery] string phone, [FromQuery] string message)
        {
            bool sent;
            try
            {
                sent = await _whatsAppService.SendMessageAsync(phone, message);
            }
            catch (Exception ex)
            {
                // Log the error if needed
                return StatusCode(500, $"Internal error: {ex.Message}");
            }

            if (sent)
            {
                return Ok("Message sent successfully.");
            }
            return StatusCode(502, "Message failed to send (not delivered to WhatsApp).");
        }
    }
}