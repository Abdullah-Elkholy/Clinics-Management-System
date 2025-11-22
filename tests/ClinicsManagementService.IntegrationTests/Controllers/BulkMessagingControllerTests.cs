using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Xunit;
using ClinicsManagementService.IntegrationTests.Common;
using ClinicsManagementService.Models;

namespace ClinicsManagementService.IntegrationTests.Controllers
{
    public class BulkMessagingControllerTests : IClassFixture<TestWebApplicationFactory>
    {
        private readonly HttpClient _client;

        public BulkMessagingControllerTests(TestWebApplicationFactory factory)
        {
            _client = factory.CreateClient();
        }

        [Fact]
        public async Task SendSingle_WithValidRequest_ReturnsOk()
        {
            // Arrange
            var request = new PhoneMessageDto
            {
                Phone = "+201234567890",
                Message = "Test message"
            };

            // Act
            var response = await _client.PostAsJsonAsync("/BulkMessaging/send-single", request);

            // Assert
            response.StatusCode.Should().BeOneOf(HttpStatusCode.OK, HttpStatusCode.BadGateway, HttpStatusCode.ServiceUnavailable);
        }

        [Fact]
        public async Task SendSingle_WithInvalidPhone_ReturnsBadRequest()
        {
            // Arrange
            var request = new PhoneMessageDto
            {
                Phone = "invalid",
                Message = "Test message"
            };

            // Act
            var response = await _client.PostAsJsonAsync("/BulkMessaging/send-single", request);
            var content = await response.Content.ReadAsStringAsync();

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            content.Should().Contain("Phone number");
        }

        [Fact]
        public async Task SendSingle_WithEmptyMessage_ReturnsBadRequest()
        {
            // Arrange
            var request = new PhoneMessageDto
            {
                Phone = "+201234567890",
                Message = ""
            };

            // Act
            var response = await _client.PostAsJsonAsync("/BulkMessaging/send-single", request);
            var content = await response.Content.ReadAsStringAsync();

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            content.Should().Contain("empty");
        }

        [Fact]
        public async Task SendBulk_WithValidRequest_ReturnsOk()
        {
            // Arrange
            var request = new BulkPhoneMessageRequest
            {
                Items = new[]
                {
                    new PhoneMessageDto { Phone = "+201234567890", Message = "Test message 1" },
                    new PhoneMessageDto { Phone = "+201234567891", Message = "Test message 2" }
                }
            };

            // Act
            var response = await _client.PostAsJsonAsync("/BulkMessaging/send-bulk?minDelayMs=100&maxDelayMs=200", request);

            // Assert
            response.StatusCode.Should().BeOneOf(HttpStatusCode.OK, HttpStatusCode.MultiStatus, HttpStatusCode.ServiceUnavailable);
        }

        [Fact]
        public async Task SendBulk_WithInvalidRequest_ReturnsBadRequest()
        {
            // Arrange
            var request = new BulkPhoneMessageRequest
            {
                Items = new[]
                {
                    new PhoneMessageDto { Phone = "invalid", Message = "Test message" }
                }
            };

            // Act
            var response = await _client.PostAsJsonAsync("/BulkMessaging/send-bulk", request);
            var content = await response.Content.ReadAsStringAsync();

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            content.Should().Contain("Invalid");
        }

        [Fact]
        public async Task SendBulk_WithEmptyItems_ReturnsBadRequest()
        {
            // Arrange
            var request = new BulkPhoneMessageRequest
            {
                Items = Array.Empty<PhoneMessageDto>()
            };

            // Act
            var response = await _client.PostAsJsonAsync("/BulkMessaging/send-bulk", request);
            var content = await response.Content.ReadAsStringAsync();

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            content.Should().Contain("at least one item");
        }

        [Fact]
        public async Task SendBulk_WithInvalidDelayParameters_ReturnsBadRequest()
        {
            // Arrange
            var request = new BulkPhoneMessageRequest
            {
                Items = new[]
                {
                    new PhoneMessageDto { Phone = "+201234567890", Message = "Test message" }
                }
            };

            // Act
            var response = await _client.PostAsJsonAsync("/BulkMessaging/send-bulk?minDelayMs=3000&maxDelayMs=1000", request);
            var content = await response.Content.ReadAsStringAsync();

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            content.Should().Contain("cannot be greater");
        }
    }
}

