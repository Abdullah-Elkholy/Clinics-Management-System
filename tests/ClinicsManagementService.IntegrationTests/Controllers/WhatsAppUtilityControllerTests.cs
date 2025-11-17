using System.Net;
using FluentAssertions;
using Xunit;
using ClinicsManagementService.IntegrationTests.Common;

namespace ClinicsManagementService.IntegrationTests.Controllers
{
    public class WhatsAppUtilityControllerTests : IClassFixture<TestWebApplicationFactory>
    {
        private readonly HttpClient _client;

        public WhatsAppUtilityControllerTests(TestWebApplicationFactory factory)
        {
            _client = factory.CreateClient();
        }

        [Fact]
        public async Task CheckConnectivity_ReturnsOk()
        {
            // Act
            var response = await _client.GetAsync("/api/WhatsAppUtility/check-connectivity");

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.OK);
        }

        [Fact]
        public async Task CheckWhatsApp_WithValidPhoneNumber_ReturnsOk()
        {
            // Arrange
            var phoneNumber = "+201234567890";

            // Act
            var response = await _client.GetAsync($"/api/WhatsAppUtility/check-whatsapp/{phoneNumber}");

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.OK);
            // Note: Actual result depends on browser state, so we just check it doesn't error
        }

        [Fact]
        public async Task CheckAuthentication_ReturnsOk()
        {
            // Act
            var response = await _client.GetAsync("/api/WhatsAppUtility/check-authentication");

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.OK);
        }

        [Fact]
        public async Task Authenticate_ReturnsOk()
        {
            // Act
            var response = await _client.PostAsync("/api/WhatsAppUtility/authenticate", null);

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.OK);
            // Note: Actual authentication requires QR scan, so we just check endpoint exists
        }
    }
}

