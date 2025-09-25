using ClinicsManagementService.Models;
using ClinicsManagementService.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace ClinicsManagementService.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class BulkMessagingController : ControllerBase
    {
        private readonly IMessageSender _messageSender;
        private readonly IWhatsAppService _whatsappService;
        private readonly INotifier _notifier; // Default notifier

        public BulkMessagingController(IMessageSender messageSender, IWhatsAppService whatsappService, INotifier notifier)
        {
            _messageSender = messageSender;
            _whatsappService = whatsappService;
            _notifier = notifier;
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
                sent = await _messageSender.SendMessageAsync(request.Phone, request.Message);
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

        /* Send multiple messages to multiple phone numbers (each item is a phone/message pair), 
         with random throttling between sends using a random number between minDelayMs and maxDelayMs in MilliSeconds. */
        [HttpPost("send-bulk")]
        public async Task<IActionResult> SendBulk([FromBody] BulkPhoneMessageRequest request, [FromQuery] int minDelayMs = 1000, [FromQuery] int maxDelayMs = 3000)
        {
            if (request.Items == null || request.Items.Count() == 0)
            {
                return BadRequest("At least one phone/message pair is required.");
            }
            if (minDelayMs < 0 || maxDelayMs < minDelayMs)
            {
                return BadRequest("Invalid delay parameters.");
            }

            // Example usage before sending messages to ensure connectivity
            if (_whatsappService != null)
            {
                if (!await _whatsappService.CheckInternetConnectivityAsync())
                {
                    _notifier.Notify("Internet connectivity to WhatsApp Web failed. Please check your connection and try again.");
                    return StatusCode(503, "Internet connectivity to WhatsApp Web failed. Please check your connection and try again.");
                }
                await Task.Delay(5000);
            }
            // Filter out invalid entries and prepare for sending
            var items = request.Items
                .Where(i => !string.IsNullOrWhiteSpace(i.Phone) && !string.IsNullOrWhiteSpace(i.Message))
                .Select(i => new { i.Phone, i.Message })
                .ToList();
            var rawResults = await _messageSender.SendBulkWithThrottlingAsync(
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