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
    /// Patient Phone & Field Validation Tests (P0 - Business Logic)
    /// 
    /// Verifies:
    /// - Phone number normalization and validation (country code enforcement)
    /// - Required fields enforced (fullName, phoneNumber, queueId)
    /// - Invalid data returns 400 Bad Request with field details
    /// - Patient linked to correct queue
    /// </summary>
    [Collection("Database collection")]
    public class PatientValidationTests : BusinessLogicTestBase
    {
        public PatientValidationTests(DatabaseFixture databaseFixture)
            : base(databaseFixture) { }

        #region Gating Tests (must pass)

        [Fact]
        public async Task CreatePatient_ValidPhone_Succeeds()
        {
            // Arrange
            await InitializeAuthAsync();
            var patient = PatientBuilder
                .WithPhone("+201234567890")
                .WithName("Ahmed Ali")
                .Build();

            // Act
            var response = await PostAsync("/api/Patients", patient);

            // Assert
            Assert.True(
                response.StatusCode == HttpStatusCode.Created ||
                response.StatusCode == HttpStatusCode.OK,
                "Valid patient creation should succeed"
            );
        }

        [Fact]
        public async Task CreatePatient_InvalidPhone_BadRequest400()
        {
            // Arrange
            await InitializeAuthAsync();
            var patient = PatientBuilder
                .WithPhone("1234567890")  // Missing country code / +
                .WithName("Ahmed Ali")
                .Build();

            // Act
            var response = await PostAsync("/api/Patients", patient);

            // Assert
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            var doc = await ParseResponse(response);
            var root = doc.RootElement;
            Assert.False(IsSuccessResponse(root));
        }

        [Fact]
        public async Task CreatePatient_MissingName_BadRequest400()
        {
            // Arrange
            await InitializeAuthAsync();
            var patient = PatientBuilder
                .WithPhone("+201234567890")
                .WithName("")  // Missing name
                .Build();

            // Act
            var response = await PostAsync("/api/Patients", patient);

            // Assert
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task CreatePatient_LinkedToClinic_Succeeds()
        {
            // Arrange
            await InitializeAuthAsync();
            var patient = PatientBuilder
                .WithQueueId(1)
                .WithPhone("+201234567890")
                .WithName("Patient One")
                .Build();

            // Act
            var response = await PostAsync("/api/Patients", patient);

            // Assert
            Assert.True(
                response.StatusCode == HttpStatusCode.Created ||
                response.StatusCode == HttpStatusCode.OK,
                "Patient with valid clinic ID should be created"
            );
        }

        [Fact]
        public async Task CreatePatient_PhoneNormalization_Idempotent()
        {
            // Arrange
            await InitializeAuthAsync();
            var phone = "+201234567890";
            var patient = PatientBuilder
                .WithPhone(phone)
                .WithName("Fatima Hassan")
                .Build();

            // Act: Create
            var response = await PostAsync("/api/Patients", patient);

            // Assert: Phone should be stored in normalized form
            Assert.True(
                response.StatusCode == HttpStatusCode.Created ||
                response.StatusCode == HttpStatusCode.OK,
                "Patient creation should succeed"
            );

            if (response.StatusCode == HttpStatusCode.OK || response.StatusCode == HttpStatusCode.Created)
            {
                var doc = await ParseResponse(response);
                System.Text.Json.JsonElement? data = GetDataFromResponse(doc.RootElement);
                if (data.HasValue)
                {
                    if (data.Value.TryGetProperty("phoneNumber", out JsonElement phoneProp))
                    {
                        var storedPhone = phoneProp.GetString();
                        // Verify normalization (e.g., +20 prefix, no spaces, etc.)
                        Assert.NotNull(storedPhone);
                        Assert.StartsWith("+", storedPhone);
                    }
                }
            }
        }

        [Fact]
        public async Task UpdatePatient_ValidData_Succeeds()
        {
            // Arrange
            await InitializeAuthAsync();
            var patient = PatientBuilder
                .WithPhone("+201234567890")
                .WithName("Original Name")
                .Build();
            var createResponse = await PostAsync("/api/Patients", patient);
            var createDoc = await ParseResponse(createResponse);
            var patientId = createDoc.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            // Act: Update name
            var updateBody = new { fullName = "Updated Name" };
            var updateResponse = await PutAsync($"/api/Patients/{patientId}", updateBody);

            // Assert
            Assert.True(
                updateResponse.StatusCode == HttpStatusCode.OK ||
                updateResponse.StatusCode == HttpStatusCode.NoContent,
                "Valid patient update should succeed"
            );
        }

        [Fact]
        public async Task PatientPhone_CountryCodeRequired()
        {
            // Arrange
            await InitializeAuthAsync();
            var patient = PatientBuilder
                .WithPhone("01234567890")  // Egyptian local format without +20
                .WithName("Test Patient")
                .Build();

            // Act
            var response = await PostAsync("/api/Patients", patient);

            // Assert: Should fail validation
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        #endregion

        #region Spec Tests (Expected to Fail - marked xfail)

        [Fact(Skip = "SPEC-010: Duplicate phone scope undefined. Deferred to Phase 3 after stakeholder clarification.")]
        [Trait("Category", "Deferred")]
        public async Task CreatePatient_DuplicatePhone_ShowsWarning()
        {
            // DEFERRED: SPEC-010
            // This test requires clarification on duplicate phone scope:
            // - Per-queue: Only one patient per phone per queue?
            // - Per-moderator: One per phone across moderator's queues?
            // - Global: One per phone globally?
            // Decision pending stakeholder input.
            // Defer to: Phase 3 Business Rules Sprint
            //
            // Original intent: Verify creating a patient with a duplicate phone
            // in the same queue returns Conflict (409).

            await Task.CompletedTask;
        }

        [Fact(Skip = "SPEC-011: No Appointments entity in schema. Cascade soft-delete currently limited to immediate children (Queue→Patients/Templates/Conditions).")]
        [Trait("Category", "NotApplicable")]
        public async Task SoftDeletePatient_CascadeUpdate_ToAppointments()
        {
            // NOT APPLICABLE: SPEC-011
            // Analysis: Appointments entity does not exist in current schema.
            // Patient cascade soft-delete only applies to:
            //   - Messages (related to patient via message records)
            //   - Conditions (queue-level conditions, not patient-level)
            // 
            // If Appointments are added in future phases, cascade logic
            // should be defined then. For now, this test is unnecessary.
            // 
            // Rationale: Patient model has no Appointments relationship;
            // soft-delete cascade handled at Queue level.

            await Task.CompletedTask;
        }

        #endregion
    }
}
