using Clinics.Application.Interfaces;
using Clinics.Domain;
using Clinics.Infrastructure.Services;
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
        private readonly IArabicErrorMessageService _errorMessageService;

        public WhatsAppServiceSender(
            HttpClient httpClient,
            ILogger<WhatsAppServiceSender> logger,
            IConfiguration configuration,
            IArabicErrorMessageService errorMessageService)
        {
            _httpClient = httpClient;
            _logger = logger;
            _configuration = configuration;
            _errorMessageService = errorMessageService;
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
                    var invalidModError = new ArgumentException("Invalid ModeratorId");
                    message.ErrorMessage = _errorMessageService.TranslateException(invalidModError);
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

                // Parse response to detect specific error types (PendingQR, PendingNET, BrowserClosure)
                try
                {
                    var errorResponse = JsonSerializer.Deserialize<ErrorResponse>(
                        responseContent,
                        new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
                    );

                    if (errorResponse != null)
                    {
                        // Check for PendingQR
                        if (errorResponse.Error == "PendingQR" || errorResponse.Code == "AUTHENTICATION_REQUIRED")
                        {
                            _logger.LogWarning("WhatsApp session requires authentication (PendingQR) for message {MessageId}. Response: {Response}", 
                                message.Id, responseContent);
                            // Throw exception to trigger global WhatsAppSession pause (will be caught by MessageProcessor)
                            throw new InvalidOperationException($"PendingQR: {errorResponse.Message ?? "جلسة الواتساب تحتاج إلى المصادقة. يرجى المصادقة أولاً قبل إرسال الرسائل."}");
                        }

                        // Check for PendingNET
                        if (errorResponse.Error == "PendingNET" || errorResponse.Code == "NETWORK_FAILURE")
                        {
                            _logger.LogWarning("Network failure (PendingNET) detected for message {MessageId}. Response: {Response}", 
                                message.Id, responseContent);
                            // Throw exception to trigger global WhatsAppSession pause
                            throw new InvalidOperationException($"PendingNET: {errorResponse.Message ?? "فشل الاتصال بالإنترنت. تم إيقاف جميع المهام الجارية."}");
                        }

                        // Check for BrowserClosure
                        if (errorResponse.Error == "BrowserClosure" || errorResponse.Code == "BROWSER_CLOSED")
                        {
                            _logger.LogWarning("Browser closed (BrowserClosure) detected for message {MessageId}. Response: {Response}", 
                                message.Id, responseContent);
                            // Throw exception to trigger global WhatsAppSession pause
                            throw new InvalidOperationException($"BrowserClosure: {errorResponse.Message ?? "تم إغلاق المتصفح. تم إيقاف جميع المهام الجارية."}");
                        }
                    }
                }
                catch (InvalidOperationException)
                {
                    // Re-throw PendingQR/PendingNET/BrowserClosure exceptions to trigger global pause
                    throw;
                }
                catch (Exception parseEx)
                {
                    _logger.LogDebug(parseEx, "Failed to parse error response for message {MessageId}, treating as generic error", message.Id);
                }

                // Generic failure (not PendingQR/PendingNET/BrowserClosure)
                var errorMessage = $"{response.StatusCode}: {responseContent}";
                _logger.LogError("Failed to send message {MessageId} to {Phone}. Status: {StatusCode}, Response: {Response}", 
                    message.Id, message.PatientPhone, response.StatusCode, responseContent);
                message.ErrorMessage = _errorMessageService.TranslateProviderError(errorMessage); // Set ErrorMessage in Arabic
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
                _logger.LogWarning(taskEx, "Request timeout sending message {MessageId} to {Phone}. The WhatsApp service took longer than 100 seconds to respond.", 
                    message.Id, message.PatientPhone);
                message.ErrorMessage = _errorMessageService.GetNetworkErrorMessage(); // Set ErrorMessage in Arabic
                return (false, "WhatsAppService", "Request timeout");
            }
            catch (TaskCanceledException taskEx)
            {
                // Handle general cancellation
                _logger.LogWarning(taskEx, "Request canceled sending message {MessageId} to {Phone}", 
                    message.Id, message.PatientPhone);
                message.ErrorMessage = _errorMessageService.GetNetworkErrorMessage(); // Set ErrorMessage in Arabic
                return (false, "WhatsAppService", $"Request canceled: {taskEx.Message}");
            }
            catch (TimeoutException timeoutEx)
            {
                // Handle timeout exceptions
                _logger.LogWarning(timeoutEx, "Timeout sending message {MessageId} to {Phone}", 
                    message.Id, message.PatientPhone);
                message.ErrorMessage = _errorMessageService.GetNetworkErrorMessage(); // Set ErrorMessage in Arabic
                return (false, "WhatsAppService", $"Timeout: {timeoutEx.Message}");
            }
            catch (HttpRequestException httpEx)
            {
                _logger.LogError(httpEx, "HTTP request error sending message {MessageId} to {Phone}", 
                    message.Id, message.PatientPhone);
                message.ErrorMessage = _errorMessageService.GetNetworkErrorMessage(); // Set ErrorMessage in Arabic
                return (false, "WhatsAppService", $"HTTP Error: {httpEx.Message}");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error sending message {MessageId} to {Phone}", 
                    message.Id, message.PatientPhone);
                message.ErrorMessage = _errorMessageService.TranslateException(ex); // Set ErrorMessage in Arabic
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

        // Helper class to deserialize error response from send-single endpoint
        private class ErrorResponse
        {
            public bool? Success { get; set; }
            public string? Error { get; set; }
            public string? Code { get; set; }
            public string? Message { get; set; }
            public bool? Warning { get; set; }
        }
    }
}
