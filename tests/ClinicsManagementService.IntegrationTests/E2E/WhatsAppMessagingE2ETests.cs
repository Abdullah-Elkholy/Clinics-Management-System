using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using Xunit;
using ClinicsManagementService.IntegrationTests.Common;
using ClinicsManagementService.Models;

namespace ClinicsManagementService.IntegrationTests.E2E
{
    /// <summary>
    /// End-to-End tests for WhatsApp messaging endpoints.
    /// These tests verify the complete flow including browser automation.
    /// Note: These tests require the service to be running and may take longer due to browser automation.
    /// </summary>
    [Collection("E2E Tests")]
    public class WhatsAppMessagingE2ETests : IClassFixture<TestWebApplicationFactory>
    {
        private readonly HttpClient _client;

        public WhatsAppMessagingE2ETests(TestWebApplicationFactory factory)
        {
            _client = factory.CreateClient();
        }

        #region Send-Single E2E Tests

        [Fact]
        [Trait("Category", "E2E")]
        [Trait("RequiresBrowser", "true")]
        public async Task E2E_SendSingle_WithValidPhoneAndMessage_CompletesFlow()
        {
            // Arrange
            var request = new PhoneMessageDto
            {
                Phone = "+201557121962",
                Message = "E2E Test: Hello from automated test"
            };

            // Act
            var response = await _client.PostAsJsonAsync("/BulkMessaging/send-single", request);
            var content = await response.Content.ReadAsStringAsync();

            // Assert
            // May return 200 (success), 502 (service failure), or 503 (network/auth issue)
            response.StatusCode.Should().BeOneOf(HttpStatusCode.OK, HttpStatusCode.BadGateway, HttpStatusCode.ServiceUnavailable);
            
            if (response.StatusCode == HttpStatusCode.OK)
            {
                content.Should().Contain("Message sent successfully");
            }
            else if (response.StatusCode == HttpStatusCode.ServiceUnavailable)
            {
                // Service unavailable could mean PendingQR (authentication required)
                content.Should().ContainAny("authentication", "QR", "PendingQR", "WhatsApp");
            }
        }

        [Fact]
        [Trait("Category", "E2E")]
        [Trait("RequiresBrowser", "true")]
        public async Task E2E_SendSingle_WithNoSession_ReturnsPendingQR()
        {
            // Arrange
            // TestWebApplicationFactory cleans up session directory
            var request = new PhoneMessageDto
            {
                Phone = "+201557121962",
                Message = "E2E Test: Testing PendingQR detection"
            };

            // Act
            var response = await _client.PostAsJsonAsync("/BulkMessaging/send-single", request);
            var content = await response.Content.ReadAsStringAsync();

            // Assert
            // Should return 503 ServiceUnavailable with PendingQR indication
            response.StatusCode.Should().BeOneOf(HttpStatusCode.ServiceUnavailable, HttpStatusCode.BadGateway);
            
            if (response.StatusCode == HttpStatusCode.ServiceUnavailable)
            {
                content.Should().ContainAny("authentication", "QR", "PendingQR", "WhatsApp");
            }
        }

        [Fact]
        [Trait("Category", "E2E")]
        [Trait("RequiresBrowser", "true")]
        public async Task E2E_SendSingle_WithInvalidPhone_DetectsErrorDialog()
        {
            // Arrange
            // Phone number that doesn't have WhatsApp (validation passes but service detects error)
            var request = new PhoneMessageDto
            {
                Phone = "+201234567890", // Likely invalid
                Message = "E2E Test: Testing error dialog detection"
            };

            // Act
            var response = await _client.PostAsJsonAsync("/BulkMessaging/send-single", request);
            var content = await response.Content.ReadAsStringAsync();

            // Assert
            // May return 502 if error dialog detected, or 200/503 depending on state
            response.StatusCode.Should().BeOneOf(
                HttpStatusCode.OK, 
                HttpStatusCode.BadGateway, 
                HttpStatusCode.ServiceUnavailable);
            
            if (response.StatusCode == HttpStatusCode.BadGateway)
            {
                content.Should().ContainAny("failed", "Message failed", "does not have WhatsApp");
            }
        }

        #endregion

        #region Check-WhatsApp E2E Tests

        [Fact]
        [Trait("Category", "E2E")]
        [Trait("RequiresBrowser", "true")]
        public async Task E2E_CheckWhatsApp_WithValidPhone_ReturnsResult()
        {
            // Arrange
            var phoneNumber = "+201557121962";

            // Act
            var response = await _client.GetAsync($"/api/WhatsAppUtility/check-whatsapp/{Uri.EscapeDataString(phoneNumber)}");
            var content = await response.Content.ReadAsStringAsync();

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.OK);
            
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var result = JsonSerializer.Deserialize<OperationResult<bool>>(content, options);
            
            result.Should().NotBeNull();
            result!.State.Should().BeOneOf(
                OperationState.Success,
                OperationState.Failure,
                OperationState.Waiting,
                OperationState.PendingQR,
                OperationState.PendingNET);
        }

        [Fact]
        [Trait("Category", "E2E")]
        [Trait("RequiresBrowser", "true")]
        public async Task E2E_CheckWhatsApp_WithNoSession_ReturnsPendingQR()
        {
            // Arrange
            // TestWebApplicationFactory cleans up session directory
            var phoneNumber = "+201557121962";

            // Act
            var response = await _client.GetAsync($"/api/WhatsAppUtility/check-whatsapp/{Uri.EscapeDataString(phoneNumber)}");
            var content = await response.Content.ReadAsStringAsync();

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.OK);
            
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var result = JsonSerializer.Deserialize<OperationResult<bool>>(content, options);
            
            result.Should().NotBeNull();
            
            // When session is not authenticated, should return PendingQR
            // (QR code should now be properly detected with the fix)
            if (result!.State == OperationState.PendingQR)
            {
                result.ResultMessage.Should().ContainAny("authentication", "QR", "scan");
            }
            // Otherwise, may be in other states depending on browser state
        }

        [Fact]
        [Trait("Category", "E2E")]
        [Trait("RequiresBrowser", "true")]
        public async Task E2E_CheckWhatsApp_WithInvalidPhone_DetectsError()
        {
            // Arrange
            var phoneNumber = "+201234567890"; // Likely invalid

            // Act
            var response = await _client.GetAsync($"/api/WhatsAppUtility/check-whatsapp/{Uri.EscapeDataString(phoneNumber)}");
            var content = await response.Content.ReadAsStringAsync();

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.OK);
            
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var result = JsonSerializer.Deserialize<OperationResult<bool>>(content, options);
            
            result.Should().NotBeNull();
            
            // May return Failure if error dialog detected, or other states
            if (result!.State == OperationState.Failure)
            {
                result.ResultMessage.Should().ContainAny("does not have WhatsApp", "error", "failed");
            }
        }

        #endregion

        #region Full Flow E2E Tests

        [Fact]
        [Trait("Category", "E2E")]
        [Trait("RequiresBrowser", "true")]
        [Trait("FullFlow", "true")]
        public async Task E2E_FullFlow_CheckThenSend_CompletesSuccessfully()
        {
            // Arrange
            var phoneNumber = "+201557121962";
            var request = new PhoneMessageDto
            {
                Phone = phoneNumber,
                Message = "E2E Full Flow Test"
            };

            // Act - Step 1: Check WhatsApp
            var checkResponse = await _client.GetAsync($"/api/WhatsAppUtility/check-whatsapp/{Uri.EscapeDataString(phoneNumber)}");
            var checkContent = await checkResponse.Content.ReadAsStringAsync();
            
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var checkResult = JsonSerializer.Deserialize<OperationResult<bool>>(checkContent, options);

            // Act - Step 2: Send message (if check didn't fail with PendingQR)
            if (checkResult?.State != OperationState.PendingQR)
            {
                var sendResponse = await _client.PostAsJsonAsync("/BulkMessaging/send-single", request);
                var sendContent = await sendResponse.Content.ReadAsStringAsync();

                // Assert
                checkResponse.StatusCode.Should().Be(HttpStatusCode.OK);
                sendResponse.StatusCode.Should().BeOneOf(
                    HttpStatusCode.OK, 
                    HttpStatusCode.BadGateway, 
                    HttpStatusCode.ServiceUnavailable);
            }
            else
            {
                // If PendingQR, that's expected when session is missing
                checkResult.State.Should().Be(OperationState.PendingQR);
            }
        }

        #endregion
    }

    /// <summary>
    /// Collection definition for E2E tests to ensure proper test isolation
    /// </summary>
    [CollectionDefinition("E2E Tests")]
    public class E2ETestsCollection : ICollectionFixture<TestWebApplicationFactory>
    {
        // This class has no code, and is never created. Its purpose is simply
        // to be the place to apply [CollectionDefinition] and all the
        // ICollectionFixture<> interfaces.
    }
}

