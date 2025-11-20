using Clinics.Application.Interfaces;
using Clinics.Domain;
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Clinics.Api.Services
{
    /// <summary>
    /// Message sender that calls the WhatsApp Messaging Service (ClinicsManagementService)
    /// </summary>
    public class WhatsAppServiceSender : IMessageSender
    {
        private readonly HttpClient _httpClient;
        private readonly ILogger<WhatsAppServiceSender> _logger;
        private readonly IConfiguration _configuration;

        public WhatsAppServiceSender(
            HttpClient httpClient,
            ILogger<WhatsAppServiceSender> logger,
            IConfiguration configuration)
        {
            _httpClient = httpClient;
            _logger = logger;
            _configuration = configuration;
        }

        public async Task<(bool success, string? providerId, string? providerResponse)> SendAsync(Message message)
        {
            try
            {
                var baseUrl = _configuration["WhatsAppServiceUrl"] ?? "http://localhost:5185";
                _logger.LogInformation("Calling WhatsApp service at {BaseUrl} for message ID {MessageId} to phone {Phone}", 
                    baseUrl, message.Id, message.RecipientPhone);

                var requestBody = new
                {
                    Phone = message.RecipientPhone,
                    Message = message.Content
                };

                var response = await _httpClient.PostAsJsonAsync(
                    $"{baseUrl}/BulkMessaging/send-single",
                    requestBody
                );

                var responseContent = await response.Content.ReadAsStringAsync();
                _logger.LogDebug("WhatsApp service response: Status={StatusCode}, Body={Body}", 
                    response.StatusCode, responseContent);

                // Success case
                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation("Message {MessageId} sent successfully to {Phone} via WhatsApp service", 
                        message.Id, message.RecipientPhone);
                    return (true, "WhatsAppService", responseContent);
                }

                // Check for PendingQR (authentication required)
                if (response.StatusCode == HttpStatusCode.BadGateway || 
                    response.StatusCode == HttpStatusCode.ServiceUnavailable)
                {
                    // Try to determine if it's PendingQR by checking authentication status
                    try
                    {
                        var authCheckResponse = await _httpClient.GetAsync(
                            $"{baseUrl}/api/WhatsAppUtility/check-authentication"
                        );

                        if (authCheckResponse.IsSuccessStatusCode)
                        {
                            var authCheckContent = await authCheckResponse.Content.ReadAsStringAsync();
                            var authResult = JsonSerializer.Deserialize<OperationResult>(
                                authCheckContent,
                                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
                            );

                            if (authResult?.State == "PendingQR")
                            {
                                _logger.LogWarning("WhatsApp session requires authentication (PendingQR) for message {MessageId}", message.Id);
                                // Throw exception to trigger batch pause (will be caught by MessageProcessor)
                                throw new InvalidOperationException("WhatsApp session requires authentication (PendingQR)");
                            }
                        }
                    }
                    catch (InvalidOperationException)
                    {
                        // Re-throw PendingQR exceptions to trigger batch pause
                        throw;
                    }
                    catch (Exception authEx)
                    {
                        _logger.LogWarning(authEx, "Failed to check authentication status after send failure for message {MessageId}", message.Id);
                    }
                }

                // Generic failure
                _logger.LogError("Failed to send message {MessageId} to {Phone}. Status: {StatusCode}, Response: {Response}", 
                    message.Id, message.RecipientPhone, response.StatusCode, responseContent);
                return (false, "WhatsAppService", $"{response.StatusCode}: {responseContent}");
            }
            catch (InvalidOperationException)
            {
                // Re-throw PendingQR exceptions
                throw;
            }
            catch (HttpRequestException httpEx)
            {
                _logger.LogError(httpEx, "HTTP request error sending message {MessageId} to {Phone}", 
                    message.Id, message.RecipientPhone);
                return (false, "WhatsAppService", $"HTTP Error: {httpEx.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error sending message {MessageId} to {Phone}", 
                    message.Id, message.RecipientPhone);
                return (false, "WhatsAppService", $"Error: {ex.Message}");
            }
        }

        // Helper class to deserialize authentication check response
        private class OperationResult
        {
            public bool? IsSuccess { get; set; }
            public string? State { get; set; }
            public string? ResultMessage { get; set; }
        }
    }
}
