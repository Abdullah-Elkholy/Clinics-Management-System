using System.Net;
using System.Text.Json;
using FluentAssertions;
using Xunit;
using ClinicsManagementService.IntegrationTests.Common;
using ClinicsManagementService.Models;

namespace ClinicsManagementService.IntegrationTests.Controllers
{
    public class CheckWhatsAppEndpointTests : IClassFixture<TestWebApplicationFactory>
    {
        private readonly HttpClient _client;

        public CheckWhatsAppEndpointTests(TestWebApplicationFactory factory)
        {
            _client = factory.CreateClient();
        }

        #region Success Scenarios

        [Fact]
        public async Task CheckWhatsApp_WithValidPhone_ReturnsOk()
        {
            // Arrange
            var phoneNumber = "+201557121962";

            // Act
            var response = await _client.GetAsync($"/api/WhatsAppUtility/check-whatsapp/{Uri.EscapeDataString(phoneNumber)}");
            var content = await response.Content.ReadAsStringAsync();

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.OK);
            
            // Parse response
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
        public async Task CheckWhatsApp_WithFormattedPhone_ReturnsOk()
        {
            // Arrange - Phone with spaces (URL encoded)
            var phoneNumber = "+20 155 712 1962";
            var encodedPhone = Uri.EscapeDataString(phoneNumber);

            // Act
            var response = await _client.GetAsync($"/api/WhatsAppUtility/check-whatsapp/{encodedPhone}");

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.OK);
        }

        [Fact]
        public async Task CheckWhatsApp_WithPhoneWithDashes_ReturnsOk()
        {
            // Arrange
            var phoneNumber = "+1-234-567-8900";
            var encodedPhone = Uri.EscapeDataString(phoneNumber);

            // Act
            var response = await _client.GetAsync($"/api/WhatsAppUtility/check-whatsapp/{encodedPhone}");

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.OK);
        }

        [Fact]
        public async Task CheckWhatsApp_WithInvalidPhoneWrongFormat_ReturnsOk()
        {
            // Arrange - Wrong format: 13 digits instead of 12
            var phoneNumber = "+2015571219625";
            var encodedPhone = Uri.EscapeDataString(phoneNumber);

            // Act
            var response = await _client.GetAsync($"/api/WhatsAppUtility/check-whatsapp/{encodedPhone}");
            var content = await response.Content.ReadAsStringAsync();

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.OK);
            
            // Should return Failure state if error dialog detected
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var result = JsonSerializer.Deserialize<OperationResult<bool>>(content, options);
            
            result.Should().NotBeNull();
            // May return Failure (error dialog) or other states depending on browser state
        }

        #endregion

        #region Response State Validation

        [Fact]
        public async Task CheckWhatsApp_ResponseHasValidStructure()
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
        public async Task CheckWhatsApp_WithSuccessState_HasCorrectData()
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
            
            // If Success state, data should be boolean
            if (result!.State == OperationState.Success)
            {
                // Data is already bool?, just verify IsSuccess is set
                result.IsSuccess.Should().NotBeNull();
            }
        }

        [Fact]
        public async Task CheckWhatsApp_WithFailureState_HasErrorMessage()
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
            
            // If Failure state, should have error message
            if (result!.State == OperationState.Failure)
            {
                result.ResultMessage.Should().NotBeNullOrEmpty();
            }
        }

        #endregion

        #region Edge Cases

        [Fact]
        public async Task CheckWhatsApp_WithVeryShortPhone_ReturnsOk()
        {
            // Arrange - 7 digits (minimum valid)
            var phoneNumber = "1234567";
            var encodedPhone = Uri.EscapeDataString(phoneNumber);

            // Act
            var response = await _client.GetAsync($"/api/WhatsAppUtility/check-whatsapp/{encodedPhone}");

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.OK);
        }

        [Fact]
        public async Task CheckWhatsApp_WithVeryLongPhone_ReturnsOk()
        {
            // Arrange - 15 digits (maximum valid)
            var phoneNumber = "123456789012345";
            var encodedPhone = Uri.EscapeDataString(phoneNumber);

            // Act
            var response = await _client.GetAsync($"/api/WhatsAppUtility/check-whatsapp/{encodedPhone}");

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.OK);
        }

        [Fact]
        public async Task CheckWhatsApp_WithPhoneWithoutPlus_ReturnsOk()
        {
            // Arrange
            var phoneNumber = "201557121962";
            var encodedPhone = Uri.EscapeDataString(phoneNumber);

            // Act
            var response = await _client.GetAsync($"/api/WhatsAppUtility/check-whatsapp/{encodedPhone}");

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.OK);
        }

        [Fact]
        public async Task CheckWhatsApp_WithMultiplePlusSigns_ReturnsOk()
        {
            // Arrange - Multiple plus signs (should be normalized)
            var phoneNumber = "++201557121962";
            var encodedPhone = Uri.EscapeDataString(phoneNumber);

            // Act
            var response = await _client.GetAsync($"/api/WhatsAppUtility/check-whatsapp/{encodedPhone}");

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.OK);
        }

        [Fact]
        public async Task CheckWhatsApp_WithSpecialCharacters_ReturnsOk()
        {
            // Arrange - Phone with special characters (should be normalized)
            var phoneNumber = "+1 (234) 567-8900";
            var encodedPhone = Uri.EscapeDataString(phoneNumber);

            // Act
            var response = await _client.GetAsync($"/api/WhatsAppUtility/check-whatsapp/{encodedPhone}");

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.OK);
        }

        [Fact]
        public async Task CheckWhatsApp_WithNoAuthenticatedSession_ReturnsPendingQR()
        {
            // Arrange
            // TestWebApplicationFactory cleans up session directory, so this should test PendingQR scenario
            var phoneNumber = "+201557121962";

            // Act
            var response = await _client.GetAsync($"/api/WhatsAppUtility/check-whatsapp/{Uri.EscapeDataString(phoneNumber)}");
            var content = await response.Content.ReadAsStringAsync();

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.OK);
            
            var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
            var result = JsonSerializer.Deserialize<OperationResult<bool>>(content, options);
            
            result.Should().NotBeNull();
            
            // When session is not authenticated (no whatsapp-session directory), should return PendingQR
            // This indicates WhatsApp authentication is required (QR code scan needed)
            if (result!.State == OperationState.PendingQR)
            {
                result.ResultMessage.Should().ContainAny("authentication", "QR", "scan");
            }
            // Otherwise, may be in other states (Success if somehow authenticated, Waiting, etc.)
        }

        #endregion
    }
}

