using System;
using System.Net;
using System.Threading.Tasks;
using Xunit;
using Clinics.Api;
using Clinics.IntegrationTests.Common;
using Clinics.Tests.Common;
using IntegrationTests.Common;

namespace Clinics.IntegrationTests
{
    /// <summary>
    /// Appointment Scheduling Tests (P0 - Business Logic)
    /// 
    /// Verifies:
    /// - Appointments created within operating hours
    /// - Overlapping appointments for same patient rejected (409)
    /// - Cross-patient/resource overlap detection (future P1)
    /// - Appointment time validation
    /// </summary>
    [Collection("Database collection")]
    public class AppointmentSchedulingTests : BusinessLogicTestBase
    {
        public AppointmentSchedulingTests(DatabaseFixture databaseFixture)
            : base(databaseFixture) { }

        #region Gating Tests (must pass)

        [Fact]
        public async Task CreateAppointment_ValidDates_Succeeds()
        {
            // Arrange: Create patient first
            var patient = PatientBuilder
                .WithPhone("+201234567890")
                .WithName("Patient for Appointment")
                .Build();

            var patientResponse = await PostAsync("/api/Patients", patient);
            var patientDoc = await ParseResponse(patientResponse);
            var patientId = patientDoc.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            // Create appointment in future
            var appointment = AppointmentBuilder
                .WithPatientId(patientId)
                .WithClinicId(1)
                .WithTime(DateTime.UtcNow.AddDays(1).Date.AddHours(10))
                .WithDuration(TimeSpan.FromMinutes(30))
                .Build();

            // Act
            var response = await PostAsync("/api/Appointments", appointment);

            // Assert
            Assert.True(
                response.StatusCode == HttpStatusCode.Created ||
                response.StatusCode == HttpStatusCode.OK,
                "Creating valid appointment should succeed"
            );
        }

        [Fact]
        public async Task CreateAppointment_OverlapSameClinicSamePatient_Conflict409()
        {
            // Arrange: Create patient and first appointment
            var patient = PatientBuilder
                .WithPhone("+201234567890")
                .WithName("Patient for Overlap Test")
                .Build();

            var patientResponse = await PostAsync("/api/Patients", patient);
            var patientDoc = await ParseResponse(patientResponse);
            var patientId = patientDoc.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var appointmentTime = DateTime.UtcNow.AddDays(1).Date.AddHours(10);
            var appointment1 = AppointmentBuilder
                .WithPatientId(patientId)
                .WithClinicId(1)
                .WithTime(appointmentTime)
                .WithDuration(TimeSpan.FromMinutes(30))
                .Build();

            await PostAsync("/api/Appointments", appointment1);

            // Act: Create overlapping appointment (same patient, overlapping time window)
            var appointment2 = AppointmentBuilder
                .WithPatientId(patientId)
                .WithClinicId(1)
                .WithTime(appointmentTime.AddMinutes(15))  // Overlaps with first
                .WithDuration(TimeSpan.FromMinutes(30))
                .Build();

            var response = await PostAsync("/api/Appointments", appointment2);

            // Assert
            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        }

        [Fact]
        public async Task CreateAppointment_WithinOperatingHours()
        {
            // Arrange: Patient and appointment
            var patient = PatientBuilder
                .WithPhone("+201234567890")
                .WithName("Patient for Hours Test")
                .Build();

            var patientResponse = await PostAsync("/api/Patients", patient);
            var patientDoc = await ParseResponse(patientResponse);
            var patientId = patientDoc.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            // Standard operating hours: 8 AM - 5 PM
            var validTime = DateTime.UtcNow.AddDays(1).Date.AddHours(10);

            var appointment = AppointmentBuilder
                .WithPatientId(patientId)
                .WithClinicId(1)
                .WithTime(validTime)
                .Build();

            // Act
            var response = await PostAsync("/api/Appointments", appointment);

            // Assert
            Assert.True(
                response.StatusCode == HttpStatusCode.Created ||
                response.StatusCode == HttpStatusCode.OK,
                "Appointment within operating hours should succeed"
            );
        }

        [Fact]
        public async Task CreateAppointment_OutsideOperatingHours_BadRequest()
        {
            // Arrange: Patient and appointment outside hours (e.g., 11 PM)
            var patient = PatientBuilder
                .WithPhone("+201234567890")
                .WithName("Patient for After-Hours Test")
                .Build();

            var patientResponse = await PostAsync("/api/Patients", patient);
            var patientDoc = await ParseResponse(patientResponse);
            var patientId = patientDoc.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var afterHoursTime = DateTime.UtcNow.AddDays(1).Date.AddHours(23);

            var appointment = AppointmentBuilder
                .WithPatientId(patientId)
                .WithClinicId(1)
                .WithTime(afterHoursTime)
                .Build();

            // Act
            var response = await PostAsync("/api/Appointments", appointment);

            // Assert
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task CreateAppointment_InPast_BadRequest()
        {
            // Arrange: Patient and appointment in the past
            var patient = PatientBuilder
                .WithPhone("+201234567890")
                .WithName("Patient for Past Test")
                .Build();

            var patientResponse = await PostAsync("/api/Patients", patient);
            var patientDoc = await ParseResponse(patientResponse);
            var patientId = patientDoc.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var pastTime = DateTime.UtcNow.AddHours(-1);

            var appointment = AppointmentBuilder
                .WithPatientId(patientId)
                .WithClinicId(1)
                .WithTime(pastTime)
                .Build();

            // Act
            var response = await PostAsync("/api/Appointments", appointment);

            // Assert
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        #endregion

        #region Spec Tests (Expected to Fail - marked xfail)

        [Fact(Skip = "SPEC-004: Cross-resource appointment overlap not enforced")]
        [Trait("Category", "ExpectedToFail")]
        public async Task CreateAppointment_OverlapDifferentPatientSameResource_Conflict409()
        {
            // This test verifies that two different patients cannot book the same resource/staff
            // at overlapping times (e.g., doctor double-booked).
            // Currently fails because resource-level conflict checking not implemented.
            // Defect: SPEC-004
            // Fix Target: Phase 2.1 Scheduling Sprint
            // Marker: [ExpectedFail("SPEC-004: Cross-resource appointment overlap not enforced")]

            // Arrange: Create two patients and book same resource
            var patient1 = PatientBuilder
                .WithPhone("+201234567890")
                .WithName("Patient One")
                .Build();

            var patient2 = PatientBuilder
                .WithPhone("+201234567891")
                .WithName("Patient Two")
                .Build();

            var p1Response = await PostAsync("/api/Patients", patient1);
            var p1Doc = await ParseResponse(p1Response);
            var patientId1 = p1Doc.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var p2Response = await PostAsync("/api/Patients", patient2);
            var p2Doc = await ParseResponse(p2Response);
            var patientId2 = p2Doc.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var appointmentTime = DateTime.UtcNow.AddDays(1).Date.AddHours(10);
            var resourceId = "DR001";  // Same doctor/resource

            // Book first patient
            var appointment1 = AppointmentBuilder
                .WithPatientId(patientId1)
                .WithClinicId(1)
                .WithTime(appointmentTime)
                .WithResourceId(resourceId)
                .Build();

            await PostAsync("/api/Appointments", appointment1);

            // Act: Try to book same resource for different patient at same time
            var appointment2 = AppointmentBuilder
                .WithPatientId(patientId2)
                .WithClinicId(1)
                .WithTime(appointmentTime)
                .WithResourceId(resourceId)
                .Build();

            var response = await PostAsync("/api/Appointments", appointment2);

            // Assert
            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        }

        [Fact(Skip = "SPEC-012: Appointment modification time window not enforced")]
        [Trait("Category", "ExpectedToFail")]
        public async Task ModifyAppointment_WithinCancellationWindow_Succeeds()
        {
            // This test verifies that appointments can only be modified within a certain
            // time window (e.g., not within 24 hours of appointment time).
            // Currently fails because modification window policy not implemented.
            // Defect: SPEC-012
            // Fix Target: Phase 2.2 Scheduling Sprint
            // Marker: [ExpectedFail("SPEC-012: Appointment modification window not enforced")]

            // Arrange: Create appointment for tomorrow
            var patient = PatientBuilder
                .WithPhone("+201234567890")
                .WithName("Patient for Modify Test")
                .Build();

            var patientResponse = await PostAsync("/api/Patients", patient);
            var patientDoc = await ParseResponse(patientResponse);
            var patientId = patientDoc.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            var appointmentTime = DateTime.UtcNow.AddDays(2).Date.AddHours(10);
            var appointment = AppointmentBuilder
                .WithPatientId(patientId)
                .WithClinicId(1)
                .WithTime(appointmentTime)
                .Build();

            var createResponse = await PostAsync("/api/Appointments", appointment);
            var createDoc = await ParseResponse(createResponse);
            var appointmentId = createDoc.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            // Act: Try to modify appointment (within 48-hour window - should succeed)
            var updateBody = new { notes = "Updated notes" };
            var response = await PutAsync($"/api/Appointments/{appointmentId}", updateBody);

            // Assert
            Assert.True(
                response.StatusCode == HttpStatusCode.OK ||
                response.StatusCode == HttpStatusCode.NoContent,
                "Appointment modification within window should succeed"
            );
        }

        #endregion
    }
}
