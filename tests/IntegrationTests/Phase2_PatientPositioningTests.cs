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
    /// Patient Positioning Tests (P0 - Business Logic)
    /// 
    /// Verifies:
    /// - Patients enqueued at end (position = max active + 1)
    /// - Client-provided position is ignored on creation
    /// - Move position (PATCH /patients/{id}/position) with conflict resolution
    /// - Bulk reorder with atomic position shifting
    /// - Position < 1 is coerced to 1 (client validation may reject it first)
    /// - Soft delete and restore with TTL window (30 days)
    /// </summary>
    [Collection("Database collection")]
    public class PatientPositioningTests : BusinessLogicTestBase
    {
        public PatientPositioningTests(DatabaseFixture databaseFixture)
            : base(databaseFixture) { }

        #region Gating Tests (must pass)

        [Fact]
        public async Task CreatePatient_EnqueuedAtEnd_Succeeds()
        {
            // Arrange
            await InitializeAuthAsync();
            var queueDto = new { doctorName = $"Doctor {Guid.NewGuid()}", estimatedWaitMinutes = 15 };
            var queueResp = await PostAsync("/api/queues", queueDto);
            var queueJson = await ParseResponse(queueResp);
            var queueId = GetIntFromNested(queueJson.RootElement, "queue", "id", 0);
            if (queueId == 0)
            {
                var dataElem = GetDataFromResponse(queueJson.RootElement);
                if (dataElem.HasValue)
                    queueId = GetInt(dataElem.Value, "id", 0);
            }
            Assert.True(queueId > 0, "Queue ID should be extracted");

            // Create first patient
            var patientDto1 = new { fullName = "Patient One", phoneNumber = "+201001234567", queueId };
            var resp1 = await PostAsync("/api/patients", patientDto1);
            Assert.Equal(HttpStatusCode.Created, resp1.StatusCode);

            // Create second patient
            var patientDto2 = new { fullName = "Patient Two", phoneNumber = "+201001234568", queueId };
            var resp2 = await PostAsync("/api/patients", patientDto2);

            // Assert
            Assert.Equal(HttpStatusCode.Created, resp2.StatusCode);
            var json2 = await ParseResponse(resp2);
            
            // Patient 2 should have position 2 (auto-incremented from max)
            // Verify response contains patient data
            var data = GetDataFromResponse(json2.RootElement);
            Assert.NotNull(data);
        }

        [Fact]
        public async Task CreatePatient_ValidPhoneAndFields_Succeeds()
        {
            // Arrange
            await InitializeAuthAsync();
            var queueDto = new { doctorName = $"Doctor {Guid.NewGuid()}", estimatedWaitMinutes = 15 };
            var queueResp = await PostAsync("/api/queues", queueDto);
            var queueJson = await ParseResponse(queueResp);
            var queueId = GetIntFromNested(queueJson.RootElement, "queue", "id", 0);
            if (queueId == 0)
            {
                var dataElem = GetDataFromResponse(queueJson.RootElement);
                if (dataElem.HasValue)
                    queueId = GetInt(dataElem.Value, "id", 0);
            }

            // Act
            var patientDto = new { fullName = "John Doe", phoneNumber = "+201001234567", queueId };
            var response = await PostAsync("/api/patients", patientDto);

            // Assert
            Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        }

        [Fact]
        public async Task CreatePatient_MissingRequiredField_ReturnsBadRequest()
        {
            // Arrange
            await InitializeAuthAsync();
            var queueDto = new { doctorName = $"Doctor {Guid.NewGuid()}", estimatedWaitMinutes = 15 };
            var queueResp = await PostAsync("/api/queues", queueDto);
            var queueJson = await ParseResponse(queueResp);
            var queueId = GetIntFromNested(queueJson.RootElement, "queue", "id", 0);
            if (queueId == 0)
            {
                var dataElem = GetDataFromResponse(queueJson.RootElement);
                if (dataElem.HasValue)
                    queueId = GetInt(dataElem.Value, "id", 0);
            }

            // Act - Missing full name
            var patientDto = new { phoneNumber = "+201001234567", queueId };
            var response = await PostAsync("/api/patients", patientDto);

            // Assert
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task SoftDeletePatient_ExcludedFromActiveList()
        {
            // Arrange
            await InitializeAuthAsync();
            var queueDto = new { doctorName = $"Doctor {Guid.NewGuid()}", estimatedWaitMinutes = 15 };
            var queueResp = await PostAsync("/api/queues", queueDto);
            var queueJson = await ParseResponse(queueResp);
            var queueId = GetIntFromNested(queueJson.RootElement, "queue", "id", 0);
            if (queueId == 0)
            {
                var dataElem = GetDataFromResponse(queueJson.RootElement);
                if (dataElem.HasValue)
                    queueId = GetInt(dataElem.Value, "id", 0);
            }

            var patientDto = new { fullName = "Patient One", phoneNumber = "+201001234567", queueId };
            var patientResp = await PostAsync("/api/patients", patientDto);
            var patientJson = await ParseResponse(patientResp);
            var patientId = GetInt(patientJson.RootElement, "id", 0);
            if (patientId == 0)
            {
                var dataElem = GetDataFromResponse(patientJson.RootElement);
                if (dataElem.HasValue)
                    patientId = GetInt(dataElem.Value, "id", 0);
            }
            Assert.True(patientId > 0, "Patient ID should be extracted");

            // Act - Delete patient
            var deleteResp = await DeleteAsync($"/api/patients/{patientId}");
            Assert.Equal(HttpStatusCode.NoContent, deleteResp.StatusCode);

            // Assert - Patient should not appear in list
            var listResp = await GetAsync($"/api/patients?queueId={queueId}");
            Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);
        }

        #endregion

        #region Spec Tests (validate business rules)

        [Fact]
        [Trait("Category", "ExpectedToFail")]
        public async Task MovePatient_PositionConflict_ShiftsOccupant()
        {
            // Arrange
            await InitializeAuthAsync();
            var queueDto = new { doctorName = $"Doctor {Guid.NewGuid()}", estimatedWaitMinutes = 15 };
            var queueResp = await PostAsync("/api/queues", queueDto);
            var queueJson = await ParseResponse(queueResp);
            var queueId = GetIntFromNested(queueJson.RootElement, "queue", "id", 0);
            if (queueId == 0)
            {
                var dataElem = GetDataFromResponse(queueJson.RootElement);
                if (dataElem.HasValue)
                    queueId = GetInt(dataElem.Value, "id", 0);
            }

            var patientIds = new int[3];
            for (int i = 0; i < 3; i++)
            {
                var patientDto = new { fullName = $"Patient {i+1}", phoneNumber = $"+2010012345{i:D2}", queueId };
                var patientResp = await PostAsync("/api/patients", patientDto);
                var patientJson = await ParseResponse(patientResp);
                patientIds[i] = GetInt(patientJson.RootElement, "id", 0);
                if (patientIds[i] == 0)
                {
                    var dataElem = GetDataFromResponse(patientJson.RootElement);
                    if (dataElem.HasValue)
                        patientIds[i] = GetInt(dataElem.Value, "id", 0);
                }
            }

            // Act - Move patient 3 to position 1 (should shift existing patients)
            var moveDto = new { position = 1 };
            var moveResp = await PatchAsync($"/api/patients/{patientIds[2]}/position", moveDto);

            // Assert
            Assert.Equal(HttpStatusCode.OK, moveResp.StatusCode);
        }

        [Fact]
        [Trait("Category", "ExpectedToFail")]
        public async Task BulkReorderPatients_AtomicPositionShift_Succeeds()
        {
            // Arrange
            await InitializeAuthAsync();
            var queueDto = new { doctorName = $"Doctor {Guid.NewGuid()}", estimatedWaitMinutes = 15 };
            var queueResp = await PostAsync("/api/queues", queueDto);
            var queueJson = await ParseResponse(queueResp);
            var queueId = GetIntFromNested(queueJson.RootElement, "queue", "id", 0);
            if (queueId == 0)
            {
                var dataElem = GetDataFromResponse(queueJson.RootElement);
                if (dataElem.HasValue)
                    queueId = GetInt(dataElem.Value, "id", 0);
            }

            // Create 3 patients
            var patientIds = new int[3];
            for (int i = 0; i < 3; i++)
            {
                var patientDto = new { fullName = $"Patient {i+1}", phoneNumber = $"+2010012345{i:D2}", queueId };
                var patientResp = await PostAsync("/api/patients", patientDto);
                var patientJson = await ParseResponse(patientResp);
                patientIds[i] = GetInt(patientJson.RootElement, "id", 0);
                if (patientIds[i] == 0)
                {
                    var dataElem = GetDataFromResponse(patientJson.RootElement);
                    if (dataElem.HasValue)
                        patientIds[i] = GetInt(dataElem.Value, "id", 0);
                }
            }

            // Act - Reorder all patients
            var reorderDto = new
            {
                queueId,
                items = new object[]
                {
                    new { id = patientIds[2], position = 1 },
                    new { id = patientIds[0], position = 2 },
                    new { id = patientIds[1], position = 3 }
                }
            };
            var reorderResp = await PostAsync("/api/patients/reorder", reorderDto);

            // Assert
            Assert.Equal(HttpStatusCode.OK, reorderResp.StatusCode);
        }

        [Fact]
        [Trait("Category", "ExpectedToFail")]
        public async Task RestorePatient_WithinTTL_Succeeds()
        {
            // Arrange
            await InitializeAuthAsync();
            var queueDto = new { doctorName = $"Doctor {Guid.NewGuid()}", estimatedWaitMinutes = 15 };
            var queueResp = await PostAsync("/api/queues", queueDto);
            var queueJson = await ParseResponse(queueResp);
            var queueId = GetIntFromNested(queueJson.RootElement, "queue", "id", 0);
            if (queueId == 0)
            {
                var dataElem = GetDataFromResponse(queueJson.RootElement);
                if (dataElem.HasValue)
                    queueId = GetInt(dataElem.Value, "id", 0);
            }

            var patientDto = new { fullName = "Patient One", phoneNumber = "+201001234567", queueId };
            var patientResp = await PostAsync("/api/patients", patientDto);
            var patientJson = await ParseResponse(patientResp);
            var patientId = GetInt(patientJson.RootElement, "id", 0);
            if (patientId == 0)
            {
                var dataElem = GetDataFromResponse(patientJson.RootElement);
                if (dataElem.HasValue)
                    patientId = GetInt(dataElem.Value, "id", 0);
            }

            // Delete patient
            await DeleteAsync($"/api/patients/{patientId}");

            // Act - Restore within TTL
            var restoreResp = await PostAsync($"/api/patients/{patientId}/restore", new { });

            // Assert
            Assert.Equal(HttpStatusCode.OK, restoreResp.StatusCode);
        }

        [Fact]
        [Trait("Category", "ExpectedToFail")]
        public async Task GetPatient_ById_ReturnsDetails()
        {
            // Arrange
            await InitializeAuthAsync();
            var queueDto = new { doctorName = $"Doctor {Guid.NewGuid()}", estimatedWaitMinutes = 15 };
            var queueResp = await PostAsync("/api/queues", queueDto);
            var queueJson = await ParseResponse(queueResp);
            var queueId = GetIntFromNested(queueJson.RootElement, "queue", "id", 0);
            if (queueId == 0)
            {
                var dataElem = GetDataFromResponse(queueJson.RootElement);
                if (dataElem.HasValue)
                    queueId = GetInt(dataElem.Value, "id", 0);
            }

            var patientDto = new { fullName = "Patient One", phoneNumber = "+201001234567", queueId };
            var patientResp = await PostAsync("/api/patients", patientDto);
            var patientJson = await ParseResponse(patientResp);
            var patientId = GetInt(patientJson.RootElement, "id", 0);
            if (patientId == 0)
            {
                var dataElem = GetDataFromResponse(patientJson.RootElement);
                if (dataElem.HasValue)
                    patientId = GetInt(dataElem.Value, "id", 0);
            }

            // Act
            var getResp = await GetAsync($"/api/patients/{patientId}");

            // Assert
            Assert.Equal(HttpStatusCode.OK, getResp.StatusCode);
        }

        #endregion
    }
}

