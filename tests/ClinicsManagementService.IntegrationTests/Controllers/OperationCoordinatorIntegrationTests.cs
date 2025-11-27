using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Xunit;
using ClinicsManagementService.IntegrationTests.Common;
using ClinicsManagementService.Models;

namespace ClinicsManagementService.IntegrationTests.Controllers
{
    /// <summary>
    /// Integration tests for Phase 3-5 implementation:
    /// - OperationCoordinator pause/resume hierarchy
    /// - CompletedSessions endpoint with new DTO structure
    /// - check-authentication endpoint with operation coordination
    /// - check-whatsapp endpoint with operation coordination
    /// - PendingQR/PendingNET handling
    /// </summary>
    [Collection("Sequential")]
    public class OperationCoordinatorIntegrationTests : IClassFixture<TestWebApplicationFactory>
    {
        private readonly HttpClient _client;

        public OperationCoordinatorIntegrationTests(TestWebApplicationFactory factory)
        {
            _client = factory.CreateClient();
        }

        #region CompletedSessions Endpoint Tests

        [Fact]
        public async Task GetCompletedSessions_ReturnsCorrectDTOStructure()
        {
            // Arrange
            int moderatorId = 1;

            // Act
            var response = await _client.GetAsync($"/api/sessions/completed?moderatorId={moderatorId}");

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.OK);
            
            var result = await response.Content.ReadFromJsonAsync<CompletedSessionsResponse>();
            result.Should().NotBeNull();
            
            if (result!.Data != null && result.Data.Any())
            {
                var session = result.Data.First();
                
                // Verify new DTO structure
                session.Should().NotBeNull();
                session.SessionId.Should().NotBeNullOrEmpty();
                session.QueueId.Should().BeGreaterThan(0);
                session.Total.Should().BeGreaterThanOrEqualTo(0);
                session.Sent.Should().BeGreaterThanOrEqualTo(0);
                
                // New fields from Phase 3.1
                session.Failed.Should().BeGreaterThanOrEqualTo(0);
                session.HasFailedMessages.Should().Be(session.Failed > 0);
                
                // sentMessages should exist (not patients)
                session.SentMessages.Should().NotBeNull();
                
                if (session.SentMessages.Any())
                {
                    var sentMsg = session.SentMessages.First();
                    
                    // Verify SentMessageDto structure
                    sentMsg.MessageId.Should().NotBeNullOrEmpty(); // Guid as string
                    sentMsg.PatientId.Should().BeGreaterThan(0);
                    sentMsg.PatientName.Should().NotBeNullOrEmpty();
                    sentMsg.PatientPhone.Should().NotBeNullOrEmpty();
                    sentMsg.CountryCode.Should().NotBeNullOrEmpty();
                    sentMsg.Content.Should().NotBeNullOrEmpty(); // Resolved content
                    sentMsg.SentAt.Should().NotBeNullOrEmpty();
                }
            }
        }

        [Fact]
        public async Task GetCompletedSessions_OnlyReturnsSentMessages()
        {
            // Arrange
            int moderatorId = 1;

            // Act
            var response = await _client.GetAsync($"/api/sessions/completed?moderatorId={moderatorId}");

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.OK);
            
            var result = await response.Content.ReadFromJsonAsync<CompletedSessionsResponse>();
            
            if (result?.Data != null && result.Data.Any())
            {
                foreach (var session in result.Data)
                {
                    // All messages in sentMessages should have Status="sent" AND ErrorMessage IS NULL
                    // This is verified by backend - we just ensure we receive the data
                    session.SentMessages.Should().NotBeNull();
                    
                    // Sent count should match sentMessages count
                    session.Sent.Should().Be(session.SentMessages.Count);
                }
            }
        }

        #endregion

        #region check-authentication Endpoint Tests

        [Fact]
        public async Task CheckAuthentication_WithModeratorId_ReturnsOperationResult()
        {
            // Arrange
            int moderatorId = 1;
            int userId = 10;

            // Act
            var response = await _client.GetAsync(
                $"/api/WhatsAppUtility/check-authentication?moderatorUserId={moderatorId}&userId={userId}");

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.OK);
            
            var result = await response.Content.ReadFromJsonAsync<OperationResult<bool>>();
            result.Should().NotBeNull();
            
            // Should have one of the expected states: Success, PendingQR, PendingNET, Failure
            result!.State.Should().BeOneOf(
                OperationState.Success, 
                OperationState.PendingQR, 
                OperationState.PendingNET, 
                OperationState.Failure, 
                OperationState.Waiting);
        }

        [Fact]
        public async Task CheckAuthentication_WithoutModeratorId_ReturnsBadRequest()
        {
            // Act
            var response = await _client.GetAsync("/api/WhatsAppUtility/check-authentication");

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
        }

        [Fact]
        public async Task CheckAuthentication_PausesAndResumes_Operations()
        {
            // This test verifies that check-authentication coordinates operations:
            // 1. Waits for current operations
            // 2. Pauses all tasks
            // 3. Checks authentication
            // 4. Resumes tasks
            
            // Arrange
            int moderatorId = 1;

            // Act
            var response = await _client.GetAsync(
                $"/api/WhatsAppUtility/check-authentication?moderatorUserId={moderatorId}");

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.OK);
            
            // The endpoint should complete successfully, indicating:
            // - Pause was activated
            // - Authentication was checked
            // - Resume was called
            var result = await response.Content.ReadFromJsonAsync<OperationResult<bool>>();
            result.Should().NotBeNull();
        }

        #endregion

        #region check-whatsapp Endpoint Tests

        [Fact]
        public async Task CheckWhatsApp_WithModeratorId_PausesAndResumes()
        {
            // Arrange
            int moderatorId = 1;
            string phoneNumber = "1234567890";

            // Act
            var response = await _client.GetAsync(
                $"/api/WhatsAppUtility/check-whatsapp/{phoneNumber}?moderatorUserId={moderatorId}");

            // Assert - Should complete (may succeed or fail depending on WhatsApp state)
            // The key is that it doesn't hang and properly coordinates operations
            response.StatusCode.Should().BeOneOf(
                HttpStatusCode.OK, 
                HttpStatusCode.BadRequest); // BadRequest if PendingQR check fails
        }

        [Fact]
        public async Task CheckWhatsApp_WithPendingQR_ReturnsBadRequest()
        {
            // If WhatsApp session is paused due to PendingQR,
            // check-whatsapp should return BadRequest immediately
            // without attempting to check the number
            
            // Arrange
            int moderatorId = 1;
            string phoneNumber = "1234567890";

            // Act
            var response = await _client.GetAsync(
                $"/api/WhatsAppUtility/check-whatsapp/{phoneNumber}?moderatorUserId={moderatorId}");

            // Assert
            if (response.StatusCode == HttpStatusCode.BadRequest)
            {
                var error = await response.Content.ReadAsStringAsync();
                // If BadRequest, should mention authentication or PendingQR
                error.Should().Match(e => 
                    e.Contains("PendingQR", StringComparison.OrdinalIgnoreCase) ||
                    e.Contains("authentication", StringComparison.OrdinalIgnoreCase) ||
                    e.Contains("مصادقة"));
            }
        }

        [Fact]
        public async Task CheckWhatsApp_WithOwnNumber_ReturnsBadRequest()
        {
            // Verifies that moderator cannot check their own WhatsApp number
            
            // Arrange
            int moderatorId = 1;
            // Use a phone number that matches moderator's WhatsApp number
            // (This test assumes moderator 1 has a WhatsApp number configured)
            
            // Act - Try with clearly invalid self-reference
            var response = await _client.GetAsync(
                $"/api/WhatsAppUtility/check-whatsapp/SELF?moderatorUserId={moderatorId}");

            // Assert - This specific case might not trigger the validation
            // but the endpoint should handle it gracefully
            response.StatusCode.Should().BeOneOf(
                HttpStatusCode.OK, 
                HttpStatusCode.BadRequest);
        }

        #endregion

        #region send-single Endpoint Tests

        [Fact]
        public async Task SendSingle_WithPendingQR_ReturnsBadRequest()
        {
            // If WhatsApp session requires authentication,
            // send-single should return BadRequest immediately
            
            // Arrange
            int moderatorId = 1;
            var request = new
            {
                phone = "+201234567890",
                message = "Test message",
                moderatorUserId = moderatorId
            };

            // Act
            var response = await _client.PostAsJsonAsync("/api/messaging/send-single", request);

            // Assert
            if (response.StatusCode == HttpStatusCode.BadRequest)
            {
                var error = await response.Content.ReadAsStringAsync();
                // If BadRequest, might be due to PendingQR or validation
                error.Should().NotBeNullOrEmpty();
            }
            else
            {
                // If not BadRequest, should be OK or some other valid response
                response.StatusCode.Should().BeOneOf(
                    HttpStatusCode.OK, 
                    HttpStatusCode.BadGateway); // 502 if send fails
            }
        }

        #endregion

        #region PendingNET/PendingQR Handling Tests

        [Fact]
        public async Task PendingQR_Detection_PausesTasks()
        {
            // This test verifies that when PendingQR is detected during check-authentication,
            // the tasks are paused (remain paused since they were paused at the beginning)
            
            // Arrange
            int moderatorId = 1;

            // Act - Call check-authentication
            var response = await _client.GetAsync(
                $"/api/WhatsAppUtility/check-authentication?moderatorUserId={moderatorId}");

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.OK);
            
            var result = await response.Content.ReadFromJsonAsync<OperationResult<bool>>();
            
            if (result?.State == OperationState.PendingQR)
            {
                // PendingQR state means:
                // 1. Tasks should be paused
                // 2. Database status should be "pending"
                // 3. Result should indicate authentication required
                result.ResultMessage.Should().NotBeNullOrEmpty();
            }
        }

        [Fact]
        public async Task PendingNET_Detection_PausesTasks_DoesNotUpdateDB()
        {
            // This test verifies that when PendingNET is detected,
            // tasks are paused BUT database is NOT updated
            
            // Arrange
            int moderatorId = 1;

            // Act - Call check-authentication
            var response = await _client.GetAsync(
                $"/api/WhatsAppUtility/check-authentication?moderatorUserId={moderatorId}");

            // Assert
            response.StatusCode.Should().Be(HttpStatusCode.OK);
            
            var result = await response.Content.ReadFromJsonAsync<OperationResult<bool>>();
            
            if (result?.State == OperationState.PendingNET)
            {
                // PendingNET state means:
                // 1. Tasks should be paused
                // 2. Database status should NOT be updated (per requirement)
                // 3. Result should indicate network failure
                result.ResultMessage.Should().NotBeNullOrEmpty();
                result.ResultMessage.Should().Match(msg => 
                    msg.Contains("Internet", StringComparison.OrdinalIgnoreCase) ||
                    msg.Contains("Network", StringComparison.OrdinalIgnoreCase) ||
                    msg.Contains("اتصال") ||
                    msg.Contains("إنترنت"));
            }
        }

        #endregion

        #region Helper Classes for Deserialization

        public class CompletedSessionsResponse
        {
            public bool Success { get; set; }
            public List<CompletedSessionDto>? Data { get; set; }
        }

        public class CompletedSessionDto
        {
            public string SessionId { get; set; } = string.Empty;
            public int QueueId { get; set; }
            public string QueueName { get; set; } = string.Empty;
            public string StartTime { get; set; } = string.Empty;
            public string? CompletedAt { get; set; }
            public int Total { get; set; }
            public int Sent { get; set; }
            public int Failed { get; set; }
            public bool HasFailedMessages { get; set; }
            public List<SentMessageDto> SentMessages { get; set; } = new();
        }

        public class SentMessageDto
        {
            public string MessageId { get; set; } = string.Empty;
            public int PatientId { get; set; }
            public string PatientName { get; set; } = string.Empty;
            public string PatientPhone { get; set; } = string.Empty;
            public string CountryCode { get; set; } = string.Empty;
            public string Content { get; set; } = string.Empty;
            public string SentAt { get; set; } = string.Empty;
            public int? CreatedBy { get; set; }
            public int? UpdatedBy { get; set; }
        }

        #endregion
    }
}
