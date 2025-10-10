using System.Net.Http;
using System.Threading.Tasks;
using Xunit;

namespace ClinicsManagement.IntegrationTests
{
    public class WhatsAppUtilityEndpointsTests
    {
        [Fact]
        public async Task CheckConnectivity_ReturnsStatus()
        {
            var client = new HttpClient();
            var response = await client.GetAsync("http://localhost:5000/api/WhatsAppUtility/check-connectivity");
            var content = await response.Content.ReadAsStringAsync();
            Assert.True(response.IsSuccessStatusCode);
            Assert.Contains("connected", content.ToLower());
        }
    }
}
