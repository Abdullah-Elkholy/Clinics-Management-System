using System;
using System.Threading.Tasks;
using Xunit;
using Microsoft.AspNetCore.Mvc.Testing;
using System.Net;
using System.Text;
using System.Text.Json;
using Clinics.Api;

namespace Clinics.IntegrationTests
{
    /// <summary>
    /// Integration tests for AuthController
    /// Tests all fixed authentication issues:
    /// 1. Include() call removed (no more InvalidOperationException)
    /// 2. Cookie name consistency (refreshToken cookie set and read correctly)
    /// 3. Token validation and refresh flow
    /// </summary>
    public class AuthControllerTests : IClassFixture<WebApplicationFactory<Program>>
    {
        private readonly WebApplicationFactory<Program> _factory;
        private const string ValidUsername = "admin";
        private const string ValidPassword = "admin";

        public AuthControllerTests(WebApplicationFactory<Program> factory)
        {
            _factory = factory;
        }

        #region Login Tests

        [Fact]
        public async Task Login_WithValidCredentials_ReturnsAccessToken()
        {
            // Arrange
            var client = _factory.CreateClient();
            var loginRequest = new { username = ValidUsername, password = ValidPassword };
            var content = new StringContent(
                JsonSerializer.Serialize(loginRequest),
                Encoding.UTF8,
                "application/json"
            );

            // Act
            var response = await client.PostAsync("/api/Auth/login", content);

            // Assert
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            
            Assert.True(root.GetProperty("success").GetBoolean());
            Assert.True(root.GetProperty("data").TryGetProperty("accessToken", out var token));
            Assert.False(string.IsNullOrEmpty(token.GetString()));
        }

        [Fact]
        public async Task Login_WithValidCredentials_SetsCookie()
        {
            // Arrange
            var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
            {
                HandleCookies = true
            });
            var loginRequest = new { username = ValidUsername, password = ValidPassword };
            var content = new StringContent(
                JsonSerializer.Serialize(loginRequest),
                Encoding.UTF8,
                "application/json"
            );

            // Act
            var response = await client.PostAsync("/api/Auth/login", content);

            // Assert
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            
            // Verify refreshToken cookie is set (not X-Refresh-Token)
            var setCookieHeaders = response.Headers.GetValues("Set-Cookie");
            var hasRefreshTokenCookie = false;
            foreach (var header in setCookieHeaders)
            {
                if (header.StartsWith("refreshToken=", StringComparison.OrdinalIgnoreCase))
                {
                    hasRefreshTokenCookie = true;
                    break;
                }
            }
            Assert.True(hasRefreshTokenCookie, "refreshToken cookie should be set (not X-Refresh-Token)");
        }

        [Fact]
        public async Task Login_WithInvalidCredentials_ReturnsUnauthorized()
        {
            // Arrange
            var client = _factory.CreateClient();
            var loginRequest = new { username = "wronguser", password = "wrongpass" };
            var content = new StringContent(
                JsonSerializer.Serialize(loginRequest),
                Encoding.UTF8,
                "application/json"
            );

            // Act
            var response = await client.PostAsync("/api/Auth/login", content);

            // Assert
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task Login_QueryUserWithoutIncludeCall_DoesNotThrow()
        {
            // Arrange
            var client = _factory.CreateClient();
            var loginRequest = new { username = ValidUsername, password = ValidPassword };
            var content = new StringContent(
                JsonSerializer.Serialize(loginRequest),
                Encoding.UTF8,
                "application/json"
            );

            // Act & Assert
            // This test ensures that the Include(u => u.Role) call was removed
            // If it wasn't, this would throw InvalidOperationException
            var response = await client.PostAsync("/api/Auth/login", content);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }

        #endregion

        #region GetCurrentUser Tests

        [Fact]
        public async Task GetCurrentUser_WithValidToken_ReturnsUserData()
        {
            // Arrange
            var client = _factory.CreateClient();
            
            // First, login to get a token
            var loginRequest = new { username = ValidUsername, password = ValidPassword };
            var loginContent = new StringContent(
                JsonSerializer.Serialize(loginRequest),
                Encoding.UTF8,
                "application/json"
            );
            var loginResponse = await client.PostAsync("/api/Auth/login", loginContent);
            var loginJson = await loginResponse.Content.ReadAsStringAsync();
            using var loginDoc = JsonDocument.Parse(loginJson);
            var token = loginDoc.RootElement.GetProperty("data").GetProperty("accessToken").GetString();

            // Act
            var request = new System.Net.Http.HttpRequestMessage(System.Net.Http.HttpMethod.Get, "/api/Auth/me");
            request.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
            var response = await client.SendAsync(request);

            // Assert
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            
            Assert.True(root.GetProperty("success").GetBoolean());
            Assert.Equal(ValidUsername, root.GetProperty("data").GetProperty("Username").GetString());
        }

        [Fact]
        public async Task GetCurrentUser_WithoutToken_ReturnsUnauthorized()
        {
            // Arrange
            var client = _factory.CreateClient();

            // Act
            var response = await client.GetAsync("/api/Auth/me");

            // Assert
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        #endregion

        #region RefreshToken Tests

        [Fact]
        public async Task RefreshToken_WithValidRefreshToken_ReturnsNewAccessToken()
        {
            // Arrange
            var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
            {
                HandleCookies = true
            });

            // First, login to get a refresh token cookie
            var loginRequest = new { username = ValidUsername, password = ValidPassword };
            var loginContent = new StringContent(
                JsonSerializer.Serialize(loginRequest),
                Encoding.UTF8,
                "application/json"
            );
            var loginResponse = await client.PostAsync("/api/Auth/login", loginContent);
            Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

            // Act
            var refreshResponse = await client.PostAsync("/api/Auth/refresh", null);

            // Assert
            Assert.Equal(HttpStatusCode.OK, refreshResponse.StatusCode);
            var json = await refreshResponse.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            
            Assert.True(root.GetProperty("success").GetBoolean());
            Assert.True(root.GetProperty("data").TryGetProperty("accessToken", out var newToken));
            Assert.False(string.IsNullOrEmpty(newToken.GetString()));
        }

        [Fact]
        public async Task RefreshToken_WithoutCookie_ReturnsUnauthorized()
        {
            // Arrange
            var client = _factory.CreateClient();

            // Act
            var response = await client.PostAsync("/api/Auth/refresh", null);

            // Assert
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        [Fact]
        public async Task RefreshToken_CookieNameConsistency_BetweenLoginAndRefresh()
        {
            // Arrange & Act & Assert
            // This test ensures that the cookie name is consistent:
            // Login sets "refreshToken" cookie (not "X-Refresh-Token")
            // Refresh endpoint reads "refreshToken" cookie
            var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
            {
                HandleCookies = true
            });

            var loginRequest = new { username = ValidUsername, password = ValidPassword };
            var loginContent = new StringContent(
                JsonSerializer.Serialize(loginRequest),
                Encoding.UTF8,
                "application/json"
            );
            var loginResponse = await client.PostAsync("/api/Auth/login", loginContent);
            Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);

            // Verify the cookie was set with correct name
            var setCookieHeaders = loginResponse.Headers.GetValues("Set-Cookie");
            var refreshTokenCookieSet = false;
            foreach (var header in setCookieHeaders)
            {
                if (header.StartsWith("refreshToken=", StringComparison.OrdinalIgnoreCase))
                {
                    refreshTokenCookieSet = true;
                    break;
                }
            }
            Assert.True(refreshTokenCookieSet, "refreshToken cookie must be set in Login");

            // Verify refresh endpoint can read it
            var refreshResponse = await client.PostAsync("/api/Auth/refresh", null);
            Assert.Equal(HttpStatusCode.OK, refreshResponse.StatusCode);
        }

        #endregion

        #region Logout Tests

        [Fact]
        public async Task Logout_DeletesRefreshTokenCookie()
        {
            // Arrange
            var client = _factory.CreateClient(new WebApplicationFactoryClientOptions
            {
                HandleCookies = true
            });

            // First, login
            var loginRequest = new { username = ValidUsername, password = ValidPassword };
            var loginContent = new StringContent(
                JsonSerializer.Serialize(loginRequest),
                Encoding.UTF8,
                "application/json"
            );
            await client.PostAsync("/api/Auth/login", loginContent);

            // Act
            var logoutResponse = await client.PostAsync("/api/Auth/logout", null);

            // Assert
            Assert.Equal(HttpStatusCode.OK, logoutResponse.StatusCode);
            
            // Verify cookie is deleted
            var setCookieHeaders = logoutResponse.Headers.GetValues("Set-Cookie");
            var refreshTokenDeleted = false;
            foreach (var header in setCookieHeaders)
            {
                if (header.StartsWith("refreshToken=", StringComparison.OrdinalIgnoreCase) && 
                    header.Contains("expires=", StringComparison.OrdinalIgnoreCase))
                {
                    refreshTokenDeleted = true;
                    break;
                }
            }
            Assert.True(refreshTokenDeleted, "refreshToken cookie should be deleted");
        }

        #endregion

        #region User Role Tests

        [Fact]
        public async Task Login_ReturnsUserWithCorrectRole()
        {
            // Arrange
            var client = _factory.CreateClient();
            var loginRequest = new { username = ValidUsername, password = ValidPassword };
            var content = new StringContent(
                JsonSerializer.Serialize(loginRequest),
                Encoding.UTF8,
                "application/json"
            );

            // Act
            var response = await client.PostAsync("/api/Auth/login", content);
            var json = await response.Content.ReadAsStringAsync();
            using var doc = JsonDocument.Parse(json);
            var token = doc.RootElement.GetProperty("data").GetProperty("accessToken").GetString();

            // Get user info to verify role
            var meRequest = new System.Net.Http.HttpRequestMessage(System.Net.Http.HttpMethod.Get, "/api/Auth/me");
            meRequest.Headers.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
            var meResponse = await client.SendAsync(meRequest);
            var meJson = await meResponse.Content.ReadAsStringAsync();
            using var meDoc = JsonDocument.Parse(meJson);
            var userRole = meDoc.RootElement.GetProperty("data").GetProperty("Role").GetString();

            // Assert
            Assert.Equal("primary_admin", userRole);
        }

        #endregion
    }
}
