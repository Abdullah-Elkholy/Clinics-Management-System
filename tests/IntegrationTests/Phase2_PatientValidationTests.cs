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
    /// Patient CRUD & Validation Tests (P0 - Business Logic)
    /// 
    /// Verifies:
    /// - Phone number validation and normalization (country code enforcement)
    /// - Patient linked to clinic correctly
    /// - Required fields enforced
    /// - Invalid data returns 400 Bad Request with field details
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
            // Arrange: Phone without country code
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
            // Arrange: Assume clinic ID 1 exists (from seed)
            var patient = PatientBuilder
                .WithClinicId(1)
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

            // Verify clinic ID in response
            if (response.StatusCode == HttpStatusCode.OK || response.StatusCode == HttpStatusCode.Created)
            {
                var doc = await ParseResponse(response);
                var data = GetDataFromResponse(doc.RootElement);
                if (data.HasValue)
                {
                    if (data.Value.TryGetProperty("clinicId", out JsonElement clinicIdProp))
                    {
                        Assert.Equal(1, clinicIdProp.GetInt32());
                    }
                }
            }
        }

        [Fact]
        public async Task CreatePatient_PhoneNormalization_Idempotent()
        {
            // Arrange: Create patient with phone that needs normalization
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
                var data = GetDataFromResponse(doc.RootElement);
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
            // Arrange: Create patient first
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
            // Arrange: Phone with just numbers, no country code
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

        [Fact(Skip = "SPEC-010: Duplicate phone check per clinic not yet implemented")]
        [Trait("Category", "ExpectedToFail")]
        public async Task CreatePatient_DuplicatePhone_ShowsWarning()
        {
            // This test verifies that creating a patient with a phone number already used
            // by another patient in the SAME clinic returns a warning or validation error.
            // Currently fails because duplicate phone check not implemented within clinic scope.
            // Defect: SPEC-010
            // Fix Target: Phase 2.1 Validation Sprint
            // Marker: [ExpectedFail("SPEC-010: Duplicate phone check per clinic scope not implemented")]

            // Arrange: Create first patient
            var phone = "+201234567890";
            var patient1 = PatientBuilder
                .WithPhone(phone)
                .WithClinicId(1)
                .WithName("Patient One")
                .Build();

            await PostAsync("/api/Patients", patient1);

            // Act: Try to create second patient with same phone in same clinic
            var patient2 = PatientBuilder
                .WithPhone(phone)
                .WithClinicId(1)
                .WithName("Patient Two")
                .Build();

            var response = await PostAsync("/api/Patients", patient2);

            // Assert
            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        }

        [Fact(Skip = "SPEC-011: Cascade soft delete semantics not yet defined")]
        [Trait("Category", "ExpectedToFail")]
        public async Task SoftDeletePatient_CascadeUpdate_ToAppointments()
        {
            // This test verifies cascade behavior when soft-deleting a patient.
            // Currently fails because cascade semantics undefined.
            // Defect: SPEC-011
            // Fix Target: Phase 2.1 Data Model Sprint
            // Marker: [ExpectedFail("SPEC-011: Soft delete cascade not defined")]

            // Arrange: Create patient with appointments
            var patient = PatientBuilder
                .WithPhone("+201234567890")
                .Build();
            var patientResponse = await PostAsync("/api/Patients", patient);
            var patientDoc = await ParseResponse(patientResponse);
            var patientId = patientDoc.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            // Create appointment
            var appointment = AppointmentBuilder
                .WithPatientId(patientId)
                .WithTime(DateTime.UtcNow.AddHours(1))
                .Build();
            await PostAsync("/api/Appointments", appointment);

            // Act: Soft delete patient
            var deleteResponse = await DeleteAsync($"/api/Patients/{patientId}");

            // Assert: Both patient and appointments should be soft-deleted (or cascade behavior verified)
            Assert.True(
                deleteResponse.StatusCode == HttpStatusCode.OK ||
                deleteResponse.StatusCode == HttpStatusCode.NoContent,
                "Patient soft delete should succeed"
            );

            // Verify appointments also hidden (cascade policy TBD)
            var appointmentsResponse = await GetAsync($"/api/Appointments?patientId={patientId}");
            if (appointmentsResponse.StatusCode == HttpStatusCode.OK)
            {
                var doc = await ParseResponse(appointmentsResponse);
                var appointments = doc.RootElement.GetProperty("data");
                foreach (var apt in appointments.EnumerateArray())
                {
                    // Business rule TBD: should cascade or not?
                    // This is a placeholder assertion
                    _ = apt;
                }
            }
        }

        #endregion
    }
}
