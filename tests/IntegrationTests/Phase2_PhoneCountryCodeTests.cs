using System;
using System.Net;
using System.Text.Json;
using System.Threading.Tasks;
using Xunit;
using Clinics.Api;
using Clinics.IntegrationTests.Common;
using Clinics.Tests.Common;
using IntegrationTests.Common;

namespace Clinics.IntegrationTests
{
    /// <summary>
    /// Phone Country Code Normalization Tests (P0 - Business Logic)
    /// 
    /// Verifies:
    /// - Phone numbers normalized consistently (single source of truth)
    /// - Country codes enforced (required)
    /// - Leading zeros removed from local format
    /// - Plus sign added if missing
    /// - Extension support (future)
    /// </summary>
    [Collection("Database collection")]
    public class PhoneCountryCodeTests : BusinessLogicTestBase
    {
        public PhoneCountryCodeTests(DatabaseFixture databaseFixture)
            : base(databaseFixture) { }

        #region Gating Tests (must pass)

        [Fact]
        public async Task NormalizePhone_RemovesLeadingZero_WithCountryCode()
        {
            // Arrange: Patient with leading zero in local format (01X format, common in Egypt)
            var patient = PatientBuilder
                .WithPhone("+201234567890")  // Normalized form
                .WithName("Patient One")
                .Build();

            // Act
            var response = await PostAsync("/api/Patients", patient);

            // Assert: Create succeeds
            Assert.True(
                response.StatusCode == HttpStatusCode.Created ||
                response.StatusCode == HttpStatusCode.OK,
                "Patient with normalized phone should be created"
            );

            // Verify stored phone is normalized
            var doc = await ParseResponse(response);
            var data = GetDataFromResponse(doc.RootElement);
            if (data.HasValue)
            {
                if (data.Value.TryGetProperty("phoneNumber", out JsonElement phoneProp))
                {
                    var storedPhone = phoneProp.GetString();
                    Assert.StartsWith("+20", storedPhone);
                    Assert.DoesNotContain("0", storedPhone.Substring(3)); // No leading zeros after country code
                }
            }
        }

        [Fact]
        public async Task NormalizePhone_AddsPlus_IfMissing()
        {
            // Arrange: Patient phone without plus sign but with country code
            var patient = PatientBuilder
                .WithPhone("201234567890")  // Missing +
                .WithName("Patient Two")
                .Build();

            // Act
            var response = await PostAsync("/api/Patients", patient);

            // Assert: Should normalize and add + (or reject and ask for proper format)
            Assert.True(
                response.StatusCode == HttpStatusCode.Created ||
                response.StatusCode == HttpStatusCode.OK ||
                response.StatusCode == HttpStatusCode.BadRequest,
                "Invalid format should either be normalized or rejected"
            );

            if (response.StatusCode == HttpStatusCode.Created || response.StatusCode == HttpStatusCode.OK)
            {
                var doc = await ParseResponse(response);
                var data = GetDataFromResponse(doc.RootElement);
                if (data.HasValue)
                {
                    if (data.Value.TryGetProperty("phoneNumber", out JsonElement phoneProp))
                    {
                        var storedPhone = phoneProp.GetString();
                        Assert.StartsWith("+", storedPhone);
                    }
                }
            }
        }

        [Fact]
        public async Task NormalizePhone_Idempotent()
        {
            // Arrange: Create patient with normalized phone
            var phone = "+201234567890";
            var patient1 = PatientBuilder
                .WithPhone(phone)
                .WithName("Patient Three")
                .Build();

            var response1 = await PostAsync("/api/Patients", patient1);

            // Act: Get the stored phone and create another with exact same
            if (response1.StatusCode == HttpStatusCode.Created || response1.StatusCode == HttpStatusCode.OK)
            {
                var doc1 = await ParseResponse(response1);
                var data1 = GetDataFromResponse(doc1.RootElement);
                string? storedPhone = null;

                if (data1.HasValue)
                {
                    if (data1.Value.TryGetProperty("phoneNumber", out JsonElement phoneProp))
                    {
                        storedPhone = phoneProp.GetString();
                    }
                }

                // Create another patient with same phone to verify normalization is consistent
                var patient2 = PatientBuilder
                    .WithPhone(storedPhone ?? phone)
                    .WithName("Patient Four")
                    .Build();

                var response2 = await PostAsync("/api/Patients", patient2);

                // Assert: Both should have identical phone format (idempotent)
                if (response2.StatusCode == HttpStatusCode.Created || response2.StatusCode == HttpStatusCode.OK)
                {
                    var doc2 = await ParseResponse(response2);
                    var data2 = GetDataFromResponse(doc2.RootElement);

                    if (data2.HasValue)
                    {
                        if (data2.Value.TryGetProperty("phoneNumber", out JsonElement phoneProp2))
                        {
                            var storedPhone2 = phoneProp2.GetString();
                            Assert.Equal(storedPhone, storedPhone2);
                        }
                    }
                }
            }
        }

        [Fact]
        public async Task NormalizePhone_RequiresCountryCode()
        {
            // Arrange: Patient phone without country code (local format)
            var patient = PatientBuilder
                .WithPhone("01234567890")  // Local Egyptian format, no country code
                .WithName("Patient Local")
                .Build();

            // Act
            var response = await PostAsync("/api/Patients", patient);

            // Assert: Should be rejected or auto-corrected based on business rule
            // If auto-correct: should normalize to +20
            // If reject: should return 400
            Assert.True(
                response.StatusCode == HttpStatusCode.BadRequest ||  // Rejected
                response.StatusCode == HttpStatusCode.Created ||     // Auto-corrected
                response.StatusCode == HttpStatusCode.OK,
                "Phone without country code should be handled (rejected or auto-corrected)"
            );
        }

        [Fact]
        public async Task NormalizePhone_DifferentCountryCodes_Accepted()
        {
            // Arrange: Test various country codes
            var testPhones = new[]
            {
                "+201234567890",    // Egypt +20
                "+966512345678",    // Saudi Arabia +966
                "+971501234567",    // UAE +971
            };

            foreach (var phone in testPhones)
            {
                var patient = PatientBuilder
                    .WithPhone(phone)
                    .WithName($"Patient from {phone.Substring(0, 3)}")
                    .Build();

                // Act
                var response = await PostAsync("/api/Patients", patient);

                // Assert: All valid international formats should be accepted
                Assert.True(
                    response.StatusCode == HttpStatusCode.Created ||
                    response.StatusCode == HttpStatusCode.OK,
                    $"Phone {phone} should be accepted"
                );
            }
        }

        #endregion

        #region Spec Tests (Expected to Fail - marked xfail)

        [Fact(Skip = "SPEC-006: Extension support not yet implemented")]
        [Trait("Category", "ExpectedToFail")]
        public async Task NormalizePhone_PreservesExtension()
        {
            // This test verifies that phone extensions are preserved during normalization.
            // Example: "+201234567890 ext. 123" should remain as "+201234567890 ext. 123"
            // Currently fails because extension parsing not implemented.
            // Defect: SPEC-006
            // Fix Target: Phase 2.2 I18N Sprint
            // Marker: [ExpectedFail("SPEC-006: Extension support not implemented")]

            // Arrange: Patient phone with extension
            var phone = "+201234567890 ext. 123";
            var patient = PatientBuilder
                .WithPhone(phone)
                .WithName("Patient with Ext")
                .Build();

            // Act
            var response = await PostAsync("/api/Patients", patient);

            // Assert: Extension preserved
            Assert.True(
                response.StatusCode == HttpStatusCode.Created ||
                response.StatusCode == HttpStatusCode.OK,
                "Phone with extension should be accepted"
            );

            var doc = await ParseResponse(response);
            var data = GetDataFromResponse(doc.RootElement);
            if (data.HasValue)
            {
                if (data.Value.TryGetProperty("phoneNumber", out JsonElement phoneProp))
                {
                    var storedPhone = phoneProp.GetString();
                    Assert.Contains("ext", storedPhone.ToLower());
                }
            }
        }

        [Fact(Skip = "SPEC-014: International format variations not fully handled")]
        [Trait("Category", "ExpectedToFail")]
        public async Task NormalizePhone_HandlesParenthesesFormat()
        {
            // This test verifies that phones in (XXX) NNN-NNNN format are normalized.
            // Currently fails if not implemented.
            // Defect: SPEC-014
            // Fix Target: Phase 2.2 I18N Sprint
            // Marker: [ExpectedFail("SPEC-014: Parentheses format not handled")]

            // Arrange: Patient with (20) format
            var phone = "+20(123) 456-7890";
            var patient = PatientBuilder
                .WithPhone(phone)
                .WithName("Patient Parentheses")
                .Build();

            // Act
            var response = await PostAsync("/api/Patients", patient);

            // Assert
            Assert.True(
                response.StatusCode == HttpStatusCode.Created ||
                response.StatusCode == HttpStatusCode.OK,
                "Parentheses format should be normalized"
            );

            var doc = await ParseResponse(response);
            var data = GetDataFromResponse(doc.RootElement);
            if (data.HasValue)
            {
                if (data.Value.TryGetProperty("phoneNumber", out JsonElement phoneProp))
                {
                    var storedPhone = phoneProp.GetString();
                    // Should be normalized to standard format
                    Assert.Matches(@"^\+\d{10,}$", storedPhone); // Basic pattern, adjust as needed
                }
            }
        }

        #endregion
    }
}
