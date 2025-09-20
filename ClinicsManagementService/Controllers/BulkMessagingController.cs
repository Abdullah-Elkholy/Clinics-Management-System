using Microsoft.AspNetCore.Mvc;

namespace ClinicsManagementService.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class BulkMessagingController : ControllerBase
    {
        private readonly WhatsAppService _whatsAppService;

        public BulkMessagingController(WhatsAppService whatsAppService)
        {
            _whatsAppService = whatsAppService;
        }

        public class BulkMessageRequest
        {
            public string Phone { get; set; } = "1234567890";
            public List<string> Messages { get; set; } = ["Hello", "How are you?", "This is a bulk test"];
        }

        [HttpPost("send")]
        public async Task<IActionResult> Send([FromBody] BulkMessageRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.Phone) || request.Messages == null || request.Messages.Count == 0)
            {
                return BadRequest("Phone and messages are required.");
            }

            bool allSent;
            try
            {
                allSent = await _whatsAppService.SendMessagesAsync(request.Phone, request.Messages);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal error: {ex.Message}");
            }

            if (allSent)
            {
                return Ok("All messages sent successfully.");
            }
            return StatusCode(502, "One or more messages failed to send.");
        }
    }
}