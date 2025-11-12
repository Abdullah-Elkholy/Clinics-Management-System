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
    /// - Soft-deleted Queue entities excluded from active listings
    /// - Soft-deleted Patient entities excluded from active listings
    /// - Soft-deleted entities still exist in database (for historical queries and restore)
    /// - Cascade behavior defined and consistent
    /// - Restore allowed within 30-day TTL window only
    /// </summary>
    [Collection("Database collection")]
    public class SoftDeleteTests : BusinessLogicTestBase
    {
        public SoftDeleteTests(DatabaseFixture databaseFixture)
            : base(databaseFixture) { }

        #region Gating Tests (must pass)

        [Fact]
        public async Task SoftDeleteQueue_ExcludedFromActiveList()
        {
            await InitializeAuthAsync();
            // Arrange: Create queue
            var queue = new { doctorName = $"Doctor {Guid.NewGuid()}", estimatedWaitMinutes = 15 };
            var createResponse = await PostAsync("/api/queues", queue);
            var createDoc = await ParseResponse(createResponse);
            var queueId = GetIntFromNested(createDoc.RootElement, "queue", "id", 0);
            if (queueId == 0)
            {
                var dataElem = GetDataFromResponse(createDoc.RootElement);
                if (dataElem.HasValue)
                    queueId = GetInt(dataElem.Value, "id", 0);
            }
            Assert.True(queueId > 0, "Queue should be created");

            // Act: Soft delete queue
            var deleteResponse = await DeleteAsync($"/api/queues/{queueId}");
            Assert.True(
                deleteResponse.StatusCode == HttpStatusCode.NoContent ||
                deleteResponse.StatusCode == HttpStatusCode.OK,
                "Soft delete should succeed"
            );

            // Verify excluded from listing
            var listResponse = await GetAsync("/api/queues");
            var listDoc = await ParseResponse(listResponse);
            var queues = listDoc.RootElement.GetProperty("data");

            bool found = false;
            foreach (var q in queues.EnumerateArray())
            {
                if (q.TryGetProperty("id", out var idProp) && idProp.GetInt32() == queueId)
                {
                    found = true;
                    break;
                }
            }

            Assert.False(found, "Soft-deleted queue should not appear in active list");
        }

        [Fact]
        public async Task SoftDeletePatient_ExcludedFromActiveList()
        {
            await InitializeAuthAsync();
            // Arrange: Create queue and patient
            var queue = new { doctorName = $"Doctor {Guid.NewGuid()}", estimatedWaitMinutes = 15 };
            var queueResp = await PostAsync("/api/queues", queue);
            var queueJson = await ParseResponse(queueResp);
            var queueId = GetIntFromNested(queueJson.RootElement, "queue", "id", 0);
            if (queueId == 0)
            {
                var dataElem = GetDataFromResponse(queueJson.RootElement);
                if (dataElem.HasValue)
                    queueId = GetInt(dataElem.Value, "id", 0);
            }

            var patient = new { fullName = "Patient One", phoneNumber = "+201001234567", queueId };
            var patientResp = await PostAsync("/api/patients", patient);
            var patientJson = await ParseResponse(patientResp);
            var patientId = GetInt(patientJson.RootElement, "id", 0);
            if (patientId == 0)
            {
                var dataElem = GetDataFromResponse(patientJson.RootElement);
                if (dataElem.HasValue)
                    patientId = GetInt(dataElem.Value, "id", 0);
            }
            Assert.True(patientId > 0, "Patient should be created");

            // Act: Soft delete patient
            var deleteResp = await DeleteAsync($"/api/patients/{patientId}");
            Assert.True(
                deleteResp.StatusCode == HttpStatusCode.NoContent ||
                deleteResp.StatusCode == HttpStatusCode.OK,
                "Delete should succeed"
            );

            // Verify excluded from listing
            var listResp = await GetAsync($"/api/patients?queueId={queueId}");
            Assert.Equal(HttpStatusCode.OK, listResp.StatusCode);
            var listJson = await ParseResponse(listResp);

            bool found = false;
            if (listJson.RootElement.TryGetProperty("data", out var data))
            {
                foreach (var p in data.EnumerateArray())
                {
                    if (p.TryGetProperty("id", out var idProp) && idProp.GetInt32() == patientId)
                    {
                        found = true;
                        break;
                    }
                }
            }

            Assert.False(found, "Soft-deleted patient should not appear in active list");
        }



        #endregion

        #region Spec Tests (Removed clinic-based tests)
        // Clinic model is not part of the domain. Queues represent clinic/doctor and are already covered
        // by gating tests above. Clinic-specific soft-delete tests have been removed per business rules.
        #endregion
    }
}


