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
        /// Send multiple messages to multiple phone numbers (each item is a phone/message pair), with random throttling between sends.
        /// <param name="minDelayMs">Minimum delay in ms between sends (default 1000)</param>
        /// <param name="maxDelayMs">Maximum delay in ms between sends (default 3000)</param>
        [HttpPost("send-bulk")]
        public async Task<IActionResult> SendBulk([FromBody] BulkPhoneMessageRequest request, [FromQuery] int minDelayMs = 1000, [FromQuery] int maxDelayMs = 3000)
        {
            if (request.Items == null || request.Items.Count == 0)
            {
                return BadRequest("At least one phone/message pair is required.");
            }
            if (minDelayMs < 0 || maxDelayMs < minDelayMs)
            {
                return BadRequest("Invalid delay parameters.");
            }
            var items = request.Items
                .Where(i => !string.IsNullOrWhiteSpace(i.Phone) && !string.IsNullOrWhiteSpace(i.Message))
                .Select(i => new { i.Phone, i.Message })
                .ToList();
            var rawResults = await _whatsAppService.SendBulkWithThrottlingAsync(
                items.Select(i => (i.Phone, i.Message)), minDelayMs, maxDelayMs);
            var results = items.Zip(rawResults, (input, result) => new MessageSendResult
            {
                Phone = result.Phone,
                Message = input.Message,
                Sent = result.Sent,
                Error = result.Error,
                IconType = result.IconType
            }).ToList();
            var failed = results.Where(r => !r.Sent).ToList();
            if (failed.Count == 0)
            {
                return Ok(new { message = "All messages sent successfully.", results });
            }
            return StatusCode(207, new { message = "Some messages failed", results });
        }
    }
}