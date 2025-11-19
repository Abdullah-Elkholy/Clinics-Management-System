using ClinicsManagementService.Models;
using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.Services.Domain;
using Microsoft.AspNetCore.Mvc;
using System.Threading;

namespace ClinicsManagementService.Controllers
{
    // Helper for robust async execution in controllers
    public static class ControllerAsyncHelper
    {
        public static async Task<IActionResult> TryExecuteAsync(Func<Task<IActionResult>> operation, ControllerBase controller, INotifier notifier, string operationName)
        {
            try
            {
                return await operation();
            }
            catch (OperationCanceledException)
            {
                notifier?.Notify($"⚠️ Operation cancelled in {operationName}");
                return controller.StatusCode(499, "Request was cancelled");
            }
            catch (Exception ex)
            {
                notifier?.Notify($"❌ Error in {operationName}: {ex.Message}");
                return controller.StatusCode(500, $"Internal error: {ex.Message}");
            }
        }
    }
    [ApiController]
    [Route("[controller]")]
    public class BulkMessagingController : ControllerBase
    {
        private readonly IMessageSender _messageSender;
        private readonly IWhatsAppService _whatsappService;
        private readonly INotifier _notifier;
        private readonly IValidationService _validationService;

        public BulkMessagingController(
            IMessageSender messageSender, 
            IWhatsAppService whatsappService, 
            INotifier notifier,
            IValidationService validationService)
        {
            _messageSender = messageSender;
            _whatsappService = whatsappService;
            _notifier = notifier;
            _validationService = validationService;
        }
        // Send a single message to a single phone number.
        [HttpPost("send-single")]
        public async Task<IActionResult> SendSingle(
            [FromBody] PhoneMessageDto request,
            CancellationToken cancellationToken = default)
        {
            return await ControllerAsyncHelper.TryExecuteAsync(async () =>
            {
                // Check if request was already cancelled
                cancellationToken.ThrowIfCancellationRequested();

                var phoneValidation = _validationService.ValidatePhoneNumber(request.Phone);
                var messageValidation = _validationService.ValidateMessage(request.Message);

                if (!phoneValidation.IsValid)
                    return BadRequest(phoneValidation.ErrorMessage);

                if (!messageValidation.IsValid)
                    return BadRequest(messageValidation.ErrorMessage);

                // Check cancellation before sending
                cancellationToken.ThrowIfCancellationRequested();

                var sent = await _messageSender.SendMessageAsync(request.Phone, request.Message, cancellationToken);
                
                if (sent)
                    return Ok("Message sent successfully.");
                return StatusCode(502, "Message failed to be sent.");
            }, this, _notifier, nameof(SendSingle));
        }

        /* Send multiple messages to multiple phone numbers (each item is a phone/message pair), 
         with random throttling between sends using a random number between minDelayMs and maxDelayMs in MilliSeconds. */
    [HttpPost("send-bulk")]
    public async Task<IActionResult> SendBulk([FromBody] BulkPhoneMessageRequest request, [FromQuery] int minDelayMs = 1000, [FromQuery] int maxDelayMs = 3000)
        {
            var bulkValidation = _validationService.ValidateBulkRequest(request);
            if (!bulkValidation.IsValid)
                return BadRequest(bulkValidation.ErrorMessage);

            var delayValidation = _validationService.ValidateDelayParameters(minDelayMs, maxDelayMs);
            if (!delayValidation.IsValid)
                return BadRequest(delayValidation.ErrorMessage);

            // Check internet connectivity before sending
            if (!await _whatsappService.CheckInternetConnectivityAsync())
            {
                _notifier.Notify("Internet connectivity to WhatsApp Web failed. Please check your connection and try again.");
                return StatusCode(503, "Internet connectivity to WhatsApp Web failed. Please check your connection and try again.");
            }

            await Task.Delay(5000); // Brief delay after connectivity check

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
                IconType = result.IconType,
                Status = DetermineStatus(result.Sent, result.Error)
            }).ToList();

            var failed = results.Where(r => !r.Sent).ToList();
            if (failed.Count == 0)
            {
                return Ok(new { message = "All messages sent successfully.", results });
            }
            return StatusCode(207, new { message = "Some messages failed", results });
        }

        /// <summary>
        /// Determines the status based on sent status and error message
        /// </summary>
        private MessageOperationStatus DetermineStatus(bool sent, string? error)
        {
            if (sent)
            {
                return MessageOperationStatus.Success;
            }

            if (error?.Contains("PendingQR:") == true || error?.Contains("WhatsApp authentication required") == true)
            {
                return MessageOperationStatus.PendingQR;
            }

            if (error?.Contains("PendingNET:") == true || error?.Contains("Internet connection unavailable") == true)
            {
                return MessageOperationStatus.PendingNET;
            }

            if (error?.Contains("Waiting:") == true)
            {
                return MessageOperationStatus.Waiting;
            }

            return MessageOperationStatus.Failure;
        }
    }
}