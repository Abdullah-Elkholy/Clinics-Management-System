using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Xunit;
using ClinicsManagement.Tests;

namespace ClinicsManagement.IntegrationTests
{
    public class BulkMessagingEndpointsTests
    {
        [Fact]
        public async Task SendSingle_WithValidData_ReturnsSuccess()
        {
            var client = new HttpClient();
            var json = JsonSerializer.Serialize(TestData.ValidSingleMessage);
            var request = new HttpRequestMessage(HttpMethod.Post, "http://localhost:5000/BulkMessaging/send-single")
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };
            var response = await client.SendAsync(request);
            var content = await response.Content.ReadAsStringAsync();
            Assert.True(response.IsSuccessStatusCode);
            Assert.Contains("success", content.ToLower());
        }

        [Fact]
        public async Task SendSingle_WithInvalidPhone_ReturnsFailure()
        {
            var client = new HttpClient();
            var json = JsonSerializer.Serialize(TestData.InvalidSingleMessage);
            var request = new HttpRequestMessage(HttpMethod.Post, "http://localhost:5000/BulkMessaging/send-single")
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };
            var response = await client.SendAsync(request);
            var content = await response.Content.ReadAsStringAsync();
            Assert.False(response.IsSuccessStatusCode);
            Assert.Contains("invalid", content.ToLower());
        }

        [Fact]
        public async Task SendBulk_WithValidData_ReturnsSuccess()
        {
            var client = new HttpClient();
            var json = JsonSerializer.Serialize(TestData.ValidBulkRequest);
            var request = new HttpRequestMessage(HttpMethod.Post, "http://localhost:5000/BulkMessaging/send-bulk")
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };
            var response = await client.SendAsync(request);
            var content = await response.Content.ReadAsStringAsync();
            Assert.True(response.IsSuccessStatusCode);
            Assert.Contains("success", content.ToLower());
        }

        [Fact]
        public async Task SendBulk_WithInvalidData_ReturnsFailure()
        {
            var client = new HttpClient();
            var json = JsonSerializer.Serialize(TestData.InvalidBulkRequest);
            var request = new HttpRequestMessage(HttpMethod.Post, "http://localhost:5000/BulkMessaging/send-bulk")
            {
                Content = new StringContent(json, Encoding.UTF8, "application/json")
            };
            var response = await client.SendAsync(request);
            var content = await response.Content.ReadAsStringAsync();
            Assert.False(response.IsSuccessStatusCode);
            Assert.Contains("invalid", content.ToLower());
        }
    }
}
