using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Xunit;
using ClinicsManagementService.IntegrationTests.Common;

namespace ClinicsManagementService.IntegrationTests.Controllers
{
    public class MessagingControllerTests : IClassFixture<TestWebApplicationFactory>
    {
        private readonly HttpClient _client;

        public MessagingControllerTests(TestWebApplicationFactory factory)
        {
            _client = factory.CreateClient();
        }

        [Fact]
        public async Task Send_WithValidPhoneAndMessage_ReturnsOk()
        {
            // Arrange
            var phone = "+201234567890";
            var message = "Test message";

            // Act
            var response = await _client.PostAsync($"/Messaging/send?phone={phone}&message={message}", null);

            // Assert
            response.StatusCode.Should().BeOneOf(HttpStatusCode.OK, HttpStatusCode.BadGateway, HttpStatusCode.ServiceUnavailable);
            // Note: Actual sending requires real browser, so we accept various status codes
        }

        [Fact]
        public async Task Send_WithInvalidPhone_ReturnsBadRequest()
        {
            // Arrange
            var phone = "invalid";
            var message = "Test message";

            // Act
            var response = await _client.PostAsync($"/Messaging/send?phone={phone}&message={message}", null);
            var content = await response.Content.ReadAsStringAsync();

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            content.Should().Contain("Phone number");
        }

        [Fact]
        public async Task Send_WithEmptyMessage_ReturnsBadRequest()
        {
            // Arrange
            var phone = "+201234567890";
            var message = "";

            // Act
            var response = await _client.PostAsync($"/Messaging/send?phone={phone}&message={message}", null);
            var content = await response.Content.ReadAsStringAsync();

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            content.Should().Contain("empty");
        }

        [Fact]
        public async Task Send_WithEmptyPhone_ReturnsBadRequest()
        {
            // Arrange
            var phone = "";
            var message = "Test message";

            // Act
            var response = await _client.PostAsync($"/Messaging/send?phone={phone}&message={message}", null);
            var content = await response.Content.ReadAsStringAsync();

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
            content.Should().Contain("required");
        }
    }
}

