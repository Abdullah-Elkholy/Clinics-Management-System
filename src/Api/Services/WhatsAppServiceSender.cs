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
                
                // CRITICAL: Validate ModeratorId is present and valid
                if (!message.ModeratorId.HasValue || message.ModeratorId.Value <= 0)
                {
                    _logger.LogError("Message {MessageId} has invalid ModeratorId: {ModeratorId}. Cannot send message.", 
                        message.Id, message.ModeratorId);
                    message.ErrorMessage = "Invalid ModeratorId: Cannot determine WhatsApp session";
                    return (false, "WhatsAppService", "Invalid ModeratorId");
                }
                
                var moderatorUserId = message.ModeratorId.Value;
                _logger.LogInformation("Calling WhatsApp service at {BaseUrl} for message ID {MessageId} to phone {Phone} with moderatorUserId {ModeratorId}", 
                    baseUrl, message.Id, message.PatientPhone, moderatorUserId);

                var requestBody = new
                {
                    Phone = message.PatientPhone,
                    CountryCode = message.CountryCode,
                    Message = message.Content
                };

                // CRITICAL: Include moderatorUserId as query parameter to ensure correct session is used
                // This ensures the session name is whatsapp-session-{moderatorId} instead of defaulting to whatsapp-session-0
                var url = $"{baseUrl}/BulkMessaging/send-single?moderatorUserId={moderatorUserId}";
                if (message.PatientId.HasValue)
                {
                    url += $"&patientId={message.PatientId.Value}";
                }
                if (message.SenderUserId.HasValue)
                {
                    url += $"&userId={message.SenderUserId.Value}";
                }
                
                _logger.LogInformation("Sending message {MessageId} to WhatsApp service with URL: {Url}", message.Id, url);
                
                var response = await _httpClient.PostAsJsonAsync(url, requestBody);

                var responseContent = await response.Content.ReadAsStringAsync();
                _logger.LogDebug("WhatsApp service response: Status={StatusCode}, Body={Body}", 
                    response.StatusCode, responseContent);

                // Success case
                if (response.IsSuccessStatusCode)
                {
                    _logger.LogInformation("Message {MessageId} sent successfully to {Phone} via WhatsApp service", 
                        message.Id, message.PatientPhone);
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
                var errorMessage = $"{response.StatusCode}: {responseContent}";
                _logger.LogError("Failed to send message {MessageId} to {Phone}. Status: {StatusCode}, Response: {Response}", 
                    message.Id, message.PatientPhone, response.StatusCode, responseContent);
                message.ErrorMessage = errorMessage; // Set ErrorMessage on failure
                return (false, "WhatsAppService", errorMessage);
            }
            catch (InvalidOperationException)
            {
                // Re-throw PendingQR exceptions
                throw;
            }
            catch (TaskCanceledException taskEx) when (taskEx.InnerException is TimeoutException)
            {
                // Handle HttpClient timeout (default is 100 seconds)
                var errorMessage = "The request was canceled due to the configured HttpClient.Timeout of 100 seconds elapsing.";
                _logger.LogWarning(taskEx, "Request timeout sending message {MessageId} to {Phone}. The WhatsApp service took longer than 100 seconds to respond.", 
                    message.Id, message.PatientPhone);
                message.ErrorMessage = errorMessage; // Set ErrorMessage on failure
                return (false, "WhatsAppService", errorMessage);
            }
            catch (TaskCanceledException taskEx)
            {
                // Handle general cancellation
                var errorMessage = $"Request was canceled: {taskEx.Message}";
                _logger.LogWarning(taskEx, "Request canceled sending message {MessageId} to {Phone}", 
                    message.Id, message.PatientPhone);
                message.ErrorMessage = errorMessage; // Set ErrorMessage on failure
                return (false, "WhatsAppService", errorMessage);
            }
            catch (TimeoutException timeoutEx)
            {
                // Handle timeout exceptions
                var errorMessage = $"Request timeout: {timeoutEx.Message}";
                _logger.LogWarning(timeoutEx, "Timeout sending message {MessageId} to {Phone}", 
                    message.Id, message.PatientPhone);
                message.ErrorMessage = errorMessage; // Set ErrorMessage on failure
                return (false, "WhatsAppService", errorMessage);
            }
            catch (HttpRequestException httpEx)
            {
                var errorMessage = $"HTTP Error: {httpEx.Message}";
                _logger.LogError(httpEx, "HTTP request error sending message {MessageId} to {Phone}", 
                    message.Id, message.PatientPhone);
                message.ErrorMessage = errorMessage; // Set ErrorMessage on failure
                return (false, "WhatsAppService", errorMessage);
            }
            catch (Exception ex)
            {
                var errorMessage = $"Error: {ex.Message}";
                _logger.LogError(ex, "Unexpected error sending message {MessageId} to {Phone}", 
                    message.Id, message.PatientPhone);
                message.ErrorMessage = errorMessage; // Set ErrorMessage on failure
                return (false, "WhatsAppService", errorMessage);
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
