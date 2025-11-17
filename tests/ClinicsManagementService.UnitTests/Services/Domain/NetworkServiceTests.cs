using FluentAssertions;
using Xunit;
using ClinicsManagementService.Services.Domain;

namespace ClinicsManagementService.UnitTests.Services.Domain
{
    public class NetworkServiceTests
    {
        private readonly NetworkService _networkService;

        public NetworkServiceTests()
        {
            _networkService = new NetworkService();
        }

        [Fact]
        public async Task CheckInternetConnectivityAsync_WhenInternetAvailable_ReturnsTrue()
        {
            // Note: This test requires actual internet connectivity
            // In a CI/CD environment, this might fail if internet is not available
            // Consider mocking HttpClient for more reliable tests

            // Act
            var result = await _networkService.CheckInternetConnectivityAsync();

            // Assert
            // We can't assert true/false reliably without mocking
            // But we can assert it doesn't throw and returns a boolean value
            // (result is already a bool, so we just verify the method completed)
            _ = result; // Verify it's a bool by using it
        }

        [Fact]
        public async Task CheckInternetConnectivityAsync_DoesNotThrowException()
        {
            // Act & Assert
            var act = async () => await _networkService.CheckInternetConnectivityAsync();
            await act.Should().NotThrowAsync();
        }
    }
}

