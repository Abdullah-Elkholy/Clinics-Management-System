using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.Services.Domain;
using Microsoft.AspNetCore.Mvc;

namespace ClinicsManagementService.Controllers
{
    [ApiController]
    [Route("[controller]")]
    public class MessagingController : ControllerBase
    {
        private readonly IMessageSender _messageSender;
        private readonly IValidationService _validationService;

        public MessagingController(IMessageSender messageSender, IValidationService validationService)
        {
            _messageSender = messageSender;
            _validationService = validationService;
        }

        [HttpPost("send")]
        public async Task<IActionResult> Send([FromQuery] string phone, [FromQuery] string message)
        {
            var phoneValidation = _validationService.ValidatePhoneNumber(phone);
            var messageValidation = _validationService.ValidateMessage(message);

            if (!phoneValidation.IsValid)
                return BadRequest(phoneValidation.ErrorMessage);

            if (!messageValidation.IsValid)
                return BadRequest(messageValidation.ErrorMessage);

            bool sent;
            try
            {
                sent = await _messageSender.SendMessageAsync(phone, message);
            }
            catch (Exception ex)
            {
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