using System;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using Xunit;
using Clinics.Api;
using Clinics.IntegrationTests.Common;
using Clinics.Tests.Common;
using IntegrationTests.Common;

namespace Clinics.IntegrationTests
{
    /// <summary>
    /// Soft Delete Semantics Tests (P0 - Business Logic)
    /// 
    /// Verifies:
    /// - Soft-deleted entities excluded from active listings
    /// - Soft-deleted entities still exist in database (for historical queries)
    /// - Cascade behavior defined and consistent
    /// - Restore not allowed (soft delete is permanent in listing)
    /// </summary>
    public class SoftDeleteTests : BusinessLogicTestBase
    {
        public SoftDeleteTests(CustomWebApplicationFactory<Program> factory)
            : base(factory) { }

        #region Gating Tests (must pass)

        [Fact]
        public async Task SoftDeleteClinic_ExcludedFromActiveList()
        {
            // Arrange: Create clinic
            var clinic = ClinicBuilder
                .WithName($"Clinic {Guid.NewGuid().ToString().Substring(0, 8)}")
                .Build();

            var createResponse = await PostAsync("/api/Clinics", clinic);
            var createDoc = await ParseResponse(createResponse);
            var clinicId = createDoc.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            // Act: Soft delete clinic
            var deleteResponse = await DeleteAsync($"/api/Clinics/{clinicId}");

            // Assert: Delete succeeds
            Assert.True(
                deleteResponse.StatusCode == HttpStatusCode.NoContent ||
                deleteResponse.StatusCode == HttpStatusCode.OK,
                "Soft delete should succeed"
            );

            // Verify excluded from listing
            var listResponse = await GetAsync("/api/Clinics");
            var listDoc = await ParseResponse(listResponse);
            var clinics = listDoc.RootElement.GetProperty("data");

            bool found = false;
            foreach (var c in clinics.EnumerateArray())
            {
                if (c.TryGetProperty("id", out var idProp) && idProp.GetInt32() == clinicId)
                {
                    found = true;
                    break;
                }
            }

            Assert.False(found, "Soft-deleted clinic should not appear in active list");
        }

        [Fact]
        public async Task SoftDeleteClinic_IncludedInTotalCount()
        {
            // Arrange: Create two clinics
            var clinic1 = ClinicBuilder.WithName($"Clinic {Guid.NewGuid()}").Build();
            var clinic2 = ClinicBuilder.WithName($"Clinic {Guid.NewGuid()}").Build();

            var c1Response = await PostAsync("/api/Clinics", clinic1);
            var c1Doc = await ParseResponse(c1Response);
            var clinicId1 = c1Doc.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            await PostAsync("/api/Clinics", clinic2);

            // Act: Get total count before soft delete
            var beforeResponse = await GetAsync("/api/Clinics?includeSoftDeleted=true");
            var beforeDoc = await ParseResponse(beforeResponse);
            var beforeCount = beforeDoc.RootElement.GetProperty("data").GetArrayLength();

            // Soft delete first clinic
            await DeleteAsync($"/api/Clinics/{clinicId1}");

            // Get total count after soft delete
            var afterResponse = await GetAsync("/api/Clinics?includeSoftDeleted=true");
            var afterDoc = await ParseResponse(afterResponse);
            var afterCount = afterDoc.RootElement.GetProperty("data").GetArrayLength();

            // Assert: Total count should be same (clinic still exists, just marked deleted)
            Assert.Equal(beforeCount, afterCount);
        }

        [Fact]
        public async Task SoftDeletePatient_ExcludedFromActiveList()
        {
            // Arrange: Create patient
            var patient = PatientBuilder
                .WithPhone("+201234567890")
                .WithName("Patient to Delete")
                .Build();

            var createResponse = await PostAsync("/api/Patients", patient);
            var createDoc = await ParseResponse(createResponse);
            var patientId = createDoc.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            // Act: Soft delete patient
            var deleteResponse = await DeleteAsync($"/api/Patients/{patientId}");

            // Assert: Delete succeeds
            Assert.True(
                deleteResponse.StatusCode == HttpStatusCode.NoContent ||
                deleteResponse.StatusCode == HttpStatusCode.OK,
                "Soft delete should succeed"
            );

            // Verify excluded from listing
            var listResponse = await GetAsync("/api/Patients");
            var listDoc = await ParseResponse(listResponse);
            var patients = listDoc.RootElement.GetProperty("data");

            bool found = false;
            foreach (var p in patients.EnumerateArray())
            {
                if (p.TryGetProperty("id", out var idProp) && idProp.GetInt32() == patientId)
                {
                    found = true;
                    break;
                }
            }

            Assert.False(found, "Soft-deleted patient should not appear in active list");
        }

        [Fact]
        public async Task SoftDeletePatient_NoCascadeUnlessSpecified()
        {
            // Arrange: Create patient and appointment
            var patient = PatientBuilder
                .WithPhone("+201234567890")
                .WithName("Patient with Appointment")
                .Build();

            var patientResponse = await PostAsync("/api/Patients", patient);
            var patientDoc = await ParseResponse(patientResponse);
            var patientId = patientDoc.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var appointment = AppointmentBuilder
                .WithPatientId(patientId)
                .WithClinicId(1)
                .Build();

            var apptResponse = await PostAsync("/api/Appointments", appointment);
            var apptDoc = await ParseResponse(apptResponse);
            var appointmentId = apptDoc.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            // Act: Soft delete patient (without cascade flag)
            await DeleteAsync($"/api/Patients/{patientId}");

            // Assert: Appointment should still be in database (not cascade-deleted)
            // This test verifies the default is NO cascade
            var apptListResponse = await GetAsync("/api/Appointments?includeSoftDeleted=true");
            var apptListDoc = await ParseResponse(apptListResponse);
            var appointments = apptListDoc.RootElement.GetProperty("data");

            bool appointmentFound = false;
            foreach (var apt in appointments.EnumerateArray())
            {
                if (apt.TryGetProperty("id", out var idProp) && idProp.GetInt32() == appointmentId)
                {
                    appointmentFound = true;
                    break;
                }
            }

            Assert.True(appointmentFound, "Appointment should still exist after patient soft delete (no cascade)");
        }

        #endregion

        #region Spec Tests (Expected to Fail - marked xfail)

        [Fact(Skip = "SPEC-005: Soft delete cascade semantics not yet defined")]
        [Trait("Category", "ExpectedToFail")]
        public async Task SoftDeletePatient_CascadeUpdate_ToAppointments()
        {
            // This test verifies that soft-deleting a patient optionally cascades to related
            // appointments (business rule TBD).
            // Currently fails because cascade policy not defined or implemented.
            // Defect: SPEC-005
            // Fix Target: Phase 2.1 Data Model Sprint
            // Marker: [ExpectedFail("SPEC-005: Soft delete cascade semantics undefined")]

            // Arrange: Create patient and appointment
            var patient = PatientBuilder
                .WithPhone("+201234567890")
                .WithName("Patient for Cascade Test")
                .Build();

            var patientResponse = await PostAsync("/api/Patients", patient);
            var patientDoc = await ParseResponse(patientResponse);
            var patientId = patientDoc.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var appointment = AppointmentBuilder
                .WithPatientId(patientId)
                .WithClinicId(1)
                .Build();

            var apptResponse = await PostAsync("/api/Appointments", appointment);
            var apptDoc = await ParseResponse(apptResponse);
            var appointmentId = apptDoc.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            // Act: Soft delete patient with cascade flag
            var deleteBody = new { cascade = true };
            var deleteResponse = await DeleteAsync($"/api/Patients/{patientId}", deleteBody);

            // Assert: Patient deleted successfully
            Assert.True(
                deleteResponse.StatusCode == HttpStatusCode.NoContent ||
                deleteResponse.StatusCode == HttpStatusCode.OK,
                "Cascade soft delete should succeed"
            );

            // Verify appointments also cascaded
            var apptResponse2 = await GetAsync($"/api/Appointments/{appointmentId}");

            // Business rule TBD: Should cascade return 404 or still retrieve with soft-delete flag?
            Assert.True(
                apptResponse2.StatusCode == HttpStatusCode.NotFound ||
                (apptResponse2.StatusCode == HttpStatusCode.OK && 
                 apptResponse2.Content.ReadAsStringAsync().Result.Contains("deleted")),
                "Cascaded appointment should be deleted or marked"
            );
        }

        [Fact(Skip = "SPEC-013: Soft delete restore not allowed (design spec unclear)")]
        [Trait("Category", "ExpectedToFail")]
        public async Task SoftDeleteClinic_CannotRestore()
        {
            // This test verifies that soft-deleted clinics CANNOT be restored
            // (if that's the business rule).
            // Currently fails if restore endpoint exists.
            // Defect: SPEC-013
            // Fix Target: Phase 2.1 Design Sprint
            // Marker: [ExpectedFail("SPEC-013: Restore policy not defined")]

            // Arrange: Create and soft-delete clinic
            var clinic = ClinicBuilder.WithName($"Clinic {Guid.NewGuid()}").Build();
            var createResponse = await PostAsync("/api/Clinics", clinic);
            var createDoc = await ParseResponse(createResponse);
            var clinicId = createDoc.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            await DeleteAsync($"/api/Clinics/{clinicId}");

            // Act: Try to restore (should fail or endpoint not exist)
            var restoreResponse = await PostAsync($"/api/Clinics/{clinicId}/Restore", new { });

            // Assert
            Assert.Equal(HttpStatusCode.NotFound, restoreResponse.StatusCode);
        }

        #endregion

        #region Helpers

        /// <summary>
        /// Helper for DELETE with request body.
        /// </summary>
        private async Task<HttpResponseMessage> DeleteAsync(string path, object body)
        {
            var request = new HttpRequestMessage(HttpMethod.Delete, path)
            {
                Content = new StringContent(
                    System.Text.Json.JsonSerializer.Serialize(body),
                    System.Text.Encoding.UTF8,
                    "application/json"
                )
            };
            return await Client.SendAsync(request);
        }

        #endregion
    }
}
