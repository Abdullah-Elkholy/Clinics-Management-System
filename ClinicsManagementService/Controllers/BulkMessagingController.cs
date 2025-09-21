using ClinicsManagementService.Models;
using Microsoft.AspNetCore.Mvc;

namespace ClinicsManagementService.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class BulkMessagingController : ControllerBase
    {
        private readonly IMessageSender _whatsAppService;

        public BulkMessagingController(IMessageSender whatsAppService)
        {
            _whatsAppService = whatsAppService;
        }
        // Send a single message to a single phone number.
        [HttpPost("send-single")]
        public async Task<IActionResult> SendSingle([FromBody] PhoneMessageDto request)
        {
            if (string.IsNullOrWhiteSpace(request.Phone) || string.IsNullOrWhiteSpace(request.Message))
            {
                return BadRequest("Phone and message are required.");
            }
            bool sent;
            try
            {
                sent = await _whatsAppService.SendMessageAsync(request.Phone, request.Message);
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Internal error: {ex.Message}");
            }
            if (sent)
            {
                return Ok("Message sent successfully.");
            }
            return StatusCode(502, "Message failed to be sent.");
        }

        // Send multiple messages to multiple phone numbers (each item is a phone/message pair).
        [HttpPost("send-bulk")]
        public async Task<IActionResult> SendBulk([FromBody] BulkPhoneMessageRequest request)
        {
            if (request.Items == null || request.Items.Count == 0)
            {
                return BadRequest("At least one phone/message pair is required.");
            }
            var results = new List<(string Phone, bool Sent, string? Error)>();
            foreach (var item in request.Items)
            {
                if (string.IsNullOrWhiteSpace(item.Phone) || string.IsNullOrWhiteSpace(item.Message))
                {
                    results.Add((item.Phone, false, "Phone number or message missing"));
                    continue;
                }
                try
                {
                    var sent = await _whatsAppService.SendMessageAsync(item.Phone, item.Message);
                    results.Add((item.Phone, sent, sent ? null : "Failed to send"));
                }
                catch (Exception ex)
                {
                    results.Add((item.Phone, false, ex.Message));
                }
            }
            var failed = results.Where(r => !r.Sent).ToList();
            if (failed.Count == 0)
            {
                return Ok("All messages sent successfully.");
            }
            return StatusCode(502, "One or more messages failed to be sent.");
        }
    }
}