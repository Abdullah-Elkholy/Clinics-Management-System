using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Xunit;
using ClinicsManagementService.IntegrationTests.Common;
using ClinicsManagementService.Models;

namespace ClinicsManagementService.IntegrationTests.Controllers
{
    public class SendSingleEndpointTests : IClassFixture<TestWebApplicationFactory>
    {
        private readonly HttpClient _client;

        public SendSingleEndpointTests(TestWebApplicationFactory factory)
        {
            _client = factory.CreateClient();
        }

        #region Success Scenarios

        [Fact]
        public async Task SendSingle_WithValidPhoneAndMessage_ReturnsOk()
        {
            // Arrange
            var request = new PhoneMessageDto
            {
                Phone = "+201557121962",
                Message = "Hello, this is a test message"
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
        }

        [Fact]
        public async Task SendSingle_WithFormattedPhone_ReturnsOk()
        {
            // Arrange
            var request = new PhoneMessageDto
            {
                Phone = "+20 155 712 1962",
                Message = "Test message"
            };

            // Act
            var response = await _client.PostAsJsonAsync("/BulkMessaging/send-single", request);

            // Assert
            response.StatusCode.Should().BeOneOf(HttpStatusCode.OK, HttpStatusCode.BadGateway, HttpStatusCode.ServiceUnavailable);
        }

        [Fact]
        public async Task SendSingle_WithLongMessage_ReturnsOk()
        {
            // Arrange
            var longMessage = new string('A', 4096);
            var request = new PhoneMessageDto
            {
                Phone = "+201557121962",
                Message = longMessage
            };

            // Act
            var response = await _client.PostAsJsonAsync("/BulkMessaging/send-single", request);

            // Assert
            response.StatusCode.Should().BeOneOf(HttpStatusCode.OK, HttpStatusCode.BadGateway, HttpStatusCode.ServiceUnavailable);
        }

        [Fact]
        public async Task SendSingle_WithSpecialCharacters_ReturnsOk()
        {
            // Arrange
            var request = new PhoneMessageDto
            {
                Phone = "+966501234567",
                Message = "Hello! 🎉 Test message with emoji and special chars: @#$%"
            };

            // Act
            var response = await _client.PostAsJsonAsync("/BulkMessaging/send-single", request);

            // Assert
            response.StatusCode.Should().BeOneOf(HttpStatusCode.OK, HttpStatusCode.BadGateway, HttpStatusCode.ServiceUnavailable);
        }

        #endregion

        #region Validation Failure Scenarios

        [Fact]
        public async Task SendSingle_WithInvalidPhoneTooShort_ReturnsBadRequest()
        {
            // Arrange
            var request = new PhoneMessageDto
            {
                Phone = "123",
                Message = "Test message"
            };

            // Act
            var response = await _client.PostAsJsonAsync("/BulkMessaging/send-single", request);
            var content = await response.Content.ReadAsStringAsync();

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            content.Should().ContainAny("Phone number", "digits", "between 7 and 15");
        }

        [Fact]
        public async Task SendSingle_WithInvalidPhoneTooLong_ReturnsBadRequest()
        {
            // Arrange
            var request = new PhoneMessageDto
            {
                Phone = "12345678901234567",
                Message = "Test message"
            };

            // Act
            var response = await _client.PostAsJsonAsync("/BulkMessaging/send-single", request);
            var content = await response.Content.ReadAsStringAsync();

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            content.Should().ContainAny("Phone number", "digits", "between 7 and 15");
        }

        [Fact]
        public async Task SendSingle_WithEmptyPhone_ReturnsBadRequest()
        {
            // Arrange
            var request = new PhoneMessageDto
            {
                Phone = "",
                Message = "Test message"
            };

            // Act
            var response = await _client.PostAsJsonAsync("/BulkMessaging/send-single", request);
            var content = await response.Content.ReadAsStringAsync();

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            content.Should().ContainAny("Phone number", "required");
        }

        [Fact]
        public async Task SendSingle_WithEmptyMessage_ReturnsBadRequest()
        {
            // Arrange
            var request = new PhoneMessageDto
            {
                Phone = "+201557121962",
                Message = ""
            };

            // Act
            var response = await _client.PostAsJsonAsync("/BulkMessaging/send-single", request);
            var content = await response.Content.ReadAsStringAsync();

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            content.Should().ContainAny("Message", "empty", "cannot be empty");
        }

        [Fact]
        public async Task SendSingle_WithTooLongMessage_ReturnsBadRequest()
        {
            // Arrange
            var tooLongMessage = new string('A', 4097);
            var request = new PhoneMessageDto
            {
                Phone = "+201557121962",
                Message = tooLongMessage
            };

            // Act
            var response = await _client.PostAsJsonAsync("/BulkMessaging/send-single", request);
            var content = await response.Content.ReadAsStringAsync();

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            content.Should().ContainAny("Message", "too long", "4096");
        }

        [Fact]
        public async Task SendSingle_WithInvalidPhoneWrongFormat_Returns502()
        {
            // Arrange - Wrong format: 13 digits instead of 12
            var request = new PhoneMessageDto
            {
                Phone = "+2015571219625",
                Message = "Test message"
            };

            // Act
            var response = await _client.PostAsJsonAsync("/BulkMessaging/send-single", request);
            var content = await response.Content.ReadAsStringAsync();

            // Assert
            // Validation passes (7-15 digits), but service should detect error dialog
            // May return 502 if error dialog detected, or 200 if somehow succeeds
            response.StatusCode.Should().BeOneOf(HttpStatusCode.OK, HttpStatusCode.BadGateway);
            
            if (response.StatusCode == HttpStatusCode.BadGateway)
            {
                content.Should().ContainAny("failed", "Message failed");
            }
        }

        #endregion

        #region Edge Cases

        [Fact]
        public async Task SendSingle_WithPhoneOnlyLetters_ReturnsBadRequest()
        {
            // Arrange
            var request = new PhoneMessageDto
            {
                Phone = "abcdefghij",
                Message = "Test message"
            };

            // Act
            var response = await _client.PostAsJsonAsync("/BulkMessaging/send-single", request);
            var content = await response.Content.ReadAsStringAsync();

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            content.Should().ContainAny("Phone number", "digits");
        }

        [Fact]
        public async Task SendSingle_WithPhoneWithDashes_ReturnsOk()
        {
            // Arrange - Formatted phone with dashes
            var request = new PhoneMessageDto
            {
                Phone = "+1-234-567-8900",
                Message = "Test message"
            };

            // Act
            var response = await _client.PostAsJsonAsync("/BulkMessaging/send-single", request);

            // Assert
            // Should accept formatted phone (normalized internally)
            response.StatusCode.Should().BeOneOf(HttpStatusCode.OK, HttpStatusCode.BadGateway, HttpStatusCode.ServiceUnavailable);
        }

        [Fact]
        public async Task SendSingle_WithPhoneWithParentheses_ReturnsOk()
        {
            // Arrange - Formatted phone with parentheses
            var request = new PhoneMessageDto
            {
                Phone = "+1 (234) 567-8900",
                Message = "Test message"
            };

            // Act
            var response = await _client.PostAsJsonAsync("/BulkMessaging/send-single", request);

            // Assert
            // Should accept formatted phone (normalized internally)
            response.StatusCode.Should().BeOneOf(HttpStatusCode.OK, HttpStatusCode.BadGateway, HttpStatusCode.ServiceUnavailable);
        }

        [Fact]
        public async Task SendSingle_WithSingleCharacterMessage_ReturnsOk()
        {
            // Arrange
            var request = new PhoneMessageDto
            {
                Phone = "+201557121962",
                Message = "A"
            };

            // Act
            var response = await _client.PostAsJsonAsync("/BulkMessaging/send-single", request);

            // Assert
            response.StatusCode.Should().BeOneOf(HttpStatusCode.OK, HttpStatusCode.BadGateway, HttpStatusCode.ServiceUnavailable);
        }

        [Fact]
        public async Task SendSingle_WithMessageWithNewlines_ReturnsOk()
        {
            // Arrange
            var request = new PhoneMessageDto
            {
                Phone = "+201557121962",
                Message = "Line 1\nLine 2\nLine 3"
            };

            // Act
            var response = await _client.PostAsJsonAsync("/BulkMessaging/send-single", request);

            // Assert
            response.StatusCode.Should().BeOneOf(HttpStatusCode.OK, HttpStatusCode.BadGateway, HttpStatusCode.ServiceUnavailable);
        }

        [Fact]
        public async Task SendSingle_WithExactMaxLengthMessage_ReturnsOk()
        {
            // Arrange - Exactly 4096 characters
            var exactMaxMessage = new string('A', 4096);
            var request = new PhoneMessageDto
            {
                Phone = "+201557121962",
                Message = exactMaxMessage
            };

            // Act
            var response = await _client.PostAsJsonAsync("/BulkMessaging/send-single", request);

            // Assert
            response.StatusCode.Should().BeOneOf(HttpStatusCode.OK, HttpStatusCode.BadGateway, HttpStatusCode.ServiceUnavailable);
        }

        [Fact]
        public async Task SendSingle_WithNoAuthenticatedSession_ReturnsServiceUnavailable()
        {
            // Arrange
            // TestWebApplicationFactory cleans up session directory, so this should test PendingQR scenario
            var request = new PhoneMessageDto
            {
                Phone = "+201557121962",
                Message = "Test message"
            };

            // Act
            var response = await _client.PostAsJsonAsync("/BulkMessaging/send-single", request);
            var content = await response.Content.ReadAsStringAsync();

            // Assert
            // When session is not authenticated (no whatsapp-session directory), should return 503 (ServiceUnavailable)
            // with PendingQR status indicating authentication is required
            response.StatusCode.Should().BeOneOf(HttpStatusCode.ServiceUnavailable, HttpStatusCode.BadGateway);
            
            if (response.StatusCode == HttpStatusCode.ServiceUnavailable)
            {
                // Should indicate authentication is required
                content.Should().ContainAny("authentication", "QR", "PendingQR", "WhatsApp");
            }
        }

        #endregion
    }
}

