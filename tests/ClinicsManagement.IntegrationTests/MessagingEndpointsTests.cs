using System.Net.Http;
using System.Threading.Tasks;
using Xunit;
using ClinicsManagement.Tests;

namespace ClinicsManagement.IntegrationTests
{
    public class MessagingEndpointsTests
    {
        [Fact]
        public async Task SendMessage_WithInvalidPhoneNumber_ReturnsFailure()
        {
            // Arrange
            var client = new HttpClient(); // Replace with test server client if available
            var request = new HttpRequestMessage(HttpMethod.Post, "http://localhost:5000/api/message/send");
            request.Content = new StringContent($"{{\"phoneNumber\":\"{TestData.InvalidPhoneNumber}\",\"message\":\"{TestData.DummyMessage}\"}}", System.Text.Encoding.UTF8, "application/json");

            // Act
            var response = await client.SendAsync(request);
            var content = await response.Content.ReadAsStringAsync();

            // Assert
            Assert.False(response.IsSuccessStatusCode);
            Assert.Contains("invalid", content.ToLower());
        }

        [Fact]
        public async Task SendMessage_WithValidPhoneNumber_ReturnsSuccess()
        {
            // Arrange
            var client = new HttpClient(); // Replace with test server client if available
            var request = new HttpRequestMessage(HttpMethod.Post, "http://localhost:5000/api/message/send");
            request.Content = new StringContent($"{{\"phoneNumber\":\"{TestData.ValidPhoneNumber}\",\"message\":\"{TestData.DummyMessage}\"}}", System.Text.Encoding.UTF8, "application/json");

            // Act
            var response = await client.SendAsync(request);
            var content = await response.Content.ReadAsStringAsync();

            // Assert
            Assert.True(response.IsSuccessStatusCode);
            Assert.Contains("success", content.ToLower());
        }
    }
}
