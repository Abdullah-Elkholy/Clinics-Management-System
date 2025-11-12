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
    /// Condition Rule Engine Tests (P0 - Business Logic)
    /// 
    /// Verifies:
    /// - Conflicting conditions cannot be added simultaneously (409 Conflict)
    /// - At least one condition must be present (min-1 rule)
    /// - Complex intersection rules enforced
    /// - Conflict matrix correctly evaluated
    /// </summary>
    [Collection("Database collection")]
    public class ConditionRuleEngineTests : BusinessLogicTestBase
    {
        public ConditionRuleEngineTests(DatabaseFixture databaseFixture)
            : base(databaseFixture) { }

        #region Gating Tests (must pass)

        [Fact]
        public async Task AddCondition_ValidNonConflicting_Succeeds()
        {
            // Arrange: Patient with no conditions
            var patient = PatientBuilder
                .WithPhone("+201234567890")
                .WithName("Patient for Conditions")
                .Build();

            var patientResponse = await PostAsync("/api/Patients", patient);
            var patientDoc = await ParseResponse(patientResponse);
            var patientId = patientDoc.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            // Act: Add a valid condition (assuming "DIABETES" exists in seed)
            var addConditionBody = new { patientId, conditionCode = "DIABETES" };
            var response = await PostAsync("/api/Patients/Conditions", addConditionBody);

            // Assert
            Assert.True(
                response.StatusCode == HttpStatusCode.OK ||
                response.StatusCode == HttpStatusCode.Created,
                "Adding valid non-conflicting condition should succeed"
            );
        }

        [Fact]
        public async Task AddCondition_ConflictingExisting_Conflict409()
        {
            // Arrange: Patient with a condition already assigned
            var patient = PatientBuilder
                .WithPhone("+201234567890")
                .WithName("Patient with Diabetes")
                .Build();

            var patientResponse = await PostAsync("/api/Patients", patient);
            var patientDoc = await ParseResponse(patientResponse);
            var patientId = patientDoc.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            // Add first condition
            var addCondition1 = new { patientId, conditionCode = "DIABETES" };
            await PostAsync("/api/Patients/Conditions", addCondition1);

            // Act: Try to add conflicting condition (e.g., HYPERGLYCEMIA conflicts with DIABETES)
            var addCondition2 = new { patientId, conditionCode = "HYPERGLYCEMIA" };
            var response = await PostAsync("/api/Patients/Conditions", addCondition2);

            // Assert
            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
            var doc = await ParseResponse(response);
            Assert.False(IsSuccessResponse(doc.RootElement));
        }

        [Fact]
        public async Task RemoveCondition_LastOne_BadRequest400()
        {
            // Arrange: Patient with exactly one condition
            var patient = PatientBuilder
                .WithPhone("+201234567890")
                .WithName("Patient with One Condition")
                .Build();

            var patientResponse = await PostAsync("/api/Patients", patient);
            var patientDoc = await ParseResponse(patientResponse);
            var patientId = patientDoc.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            // Add one condition
            var addCondition = new { patientId, conditionCode = "DIABETES" };
            await PostAsync("/api/Patients/Conditions", addCondition);

            // Act: Try to remove the last (only) condition
            var removeBody = new { patientId, conditionCode = "DIABETES" };
            var response = await DeleteAsync("/api/Patients/Conditions", removeBody);

            // Helper for DELETE with body (fallback: POST with delete marker)
            // If framework doesn't support DELETE with body, use appropriate method
            if (response.StatusCode == System.Net.HttpStatusCode.MethodNotAllowed)
            {
                // Retry with POST marker if needed
                response = await PostAsync("/api/Patients/Conditions/Remove", removeBody);
            }

            // Assert
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }

        [Fact]
        public async Task ConditionList_EnforcesMinimumOne()
        {
            // Arrange: Patient with two conditions
            var patient = PatientBuilder
                .WithPhone("+201234567890")
                .WithName("Patient with Two Conditions")
                .Build();

            var patientResponse = await PostAsync("/api/Patients", patient);
            var patientDoc = await ParseResponse(patientResponse);
            var patientId = patientDoc.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            // Add two conditions
            await PostAsync("/api/Patients/Conditions", new { patientId, conditionCode = "DIABETES" });
            await PostAsync("/api/Patients/Conditions", new { patientId, conditionCode = "HYPERTENSION" });

            // Act: Try to remove one (should succeed, leaving one)
            var removeBody = new { patientId, conditionCode = "DIABETES" };
            var removeResponse = await PostAsync("/api/Patients/Conditions/Remove", removeBody);

            // Assert: First removal succeeds
            Assert.True(
                removeResponse.StatusCode == HttpStatusCode.OK ||
                removeResponse.StatusCode == HttpStatusCode.NoContent,
                "Removing a condition when >1 remains should succeed"
            );

            // Act: Remove the last remaining condition
            var removeLastBody = new { patientId, conditionCode = "HYPERTENSION" };
            var removeLastResponse = await PostAsync("/api/Patients/Conditions/Remove", removeLastBody);

            // Assert: Should fail (min-1 rule)
            Assert.Equal(HttpStatusCode.BadRequest, removeLastResponse.StatusCode);
        }

        [Fact]
        public async Task AddCondition_SameConditionTwice_Idempotent()
        {
            // Arrange: Patient with one condition
            var patient = PatientBuilder
                .WithPhone("+201234567890")
                .WithName("Patient for Idempotent Test")
                .Build();

            var patientResponse = await PostAsync("/api/Patients", patient);
            var patientDoc = await ParseResponse(patientResponse);
            var patientId = patientDoc.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            // Add condition first time
            var addCondition = new { patientId, conditionCode = "DIABETES" };
            var response1 = await PostAsync("/api/Patients/Conditions", addCondition);

            // Act: Add same condition again
            var response2 = await PostAsync("/api/Patients/Conditions", addCondition);

            // Assert: Either succeeds (idempotent) or returns 409 (duplicate), but not 500
            Assert.True(
                response2.StatusCode == HttpStatusCode.OK ||
                response2.StatusCode == HttpStatusCode.Created ||
                response2.StatusCode == HttpStatusCode.Conflict,
                "Adding same condition twice should be idempotent or return 409 (not 500)"
            );
        }

        #endregion

        #region Spec Tests (Expected to Fail - marked xfail)

        [Fact(Skip = "SPEC-002: Complex intersection rules not yet implemented")]
        [Trait("Category", "ExpectedToFail")]
        public async Task AddCondition_ComplexIntersection_Conflict409()
        {
            // This test verifies that complex intersection rules are enforced.
            // Example: If patient has A, they cannot also have B AND C simultaneously.
            // Currently fails because only direct conflicts checked.
            // Defect: SPEC-002
            // Fix Target: Phase 2.1 Rule Engine Sprint
            // Marker: [ExpectedFail("SPEC-002: Complex intersection rules not yet implemented")]

            // Arrange: Patient with condition A
            var patient = PatientBuilder
                .WithPhone("+201234567890")
                .WithName("Patient for Complex Rules")
                .Build();

            var patientResponse = await PostAsync("/api/Patients", patient);
            var patientDoc = await ParseResponse(patientResponse);
            var patientId = patientDoc.RootElement.GetProperty("data").GetProperty("id").GetInt32();

            await PostAsync("/api/Patients/Conditions", new { patientId, conditionCode = "CONDITION_A" });
            await PostAsync("/api/Patients/Conditions", new { patientId, conditionCode = "CONDITION_B" });

            // Act: Try to add CONDITION_C (which is forbidden when both A and B present)
            var addCondition = new { patientId, conditionCode = "CONDITION_C" };
            var response = await PostAsync("/api/Patients/Conditions", addCondition);

            // Assert
            Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        }

        [Fact(Skip = "SPEC-003: Data-driven intersection matrix not yet implemented")]
        [Trait("Category", "ExpectedToFail")]
        public async Task ConditionConflict_Matrix_AllCombinations()
        {
            // This test verifies that all defined conflict combinations in the matrix are enforced.
            // Uses parameterized approach to test all conflict pairs.
            // Currently fails because matrix not fully implemented or incomplete.
            // Defect: SPEC-003
            // Fix Target: Phase 2.1 Rule Engine Sprint
            // Marker: [ExpectedFail("SPEC-003: Conflict matrix not complete")]

            // Example conflict pairs to test:
            var conflictPairs = new[]
            {
                ("DIABETES", "HYPERGLYCEMIA"),
                ("HYPERTENSION", "HYPOTENSION"),
                ("CONDITION_A", "CONDITION_B")
            };

            foreach (var (cond1, cond2) in conflictPairs)
            {
                // Arrange: Create patient with first condition
                var patient = PatientBuilder
                    .WithPhone($"+2012345{Guid.NewGuid().ToString().Substring(0, 4)}")
                    .WithName($"Patient for {cond1}")
                    .Build();

                var patientResponse = await PostAsync("/api/Patients", patient);
                var patientDoc = await ParseResponse(patientResponse);
                var patientId = patientDoc.RootElement.GetProperty("data").GetProperty("id").GetInt32();

                await PostAsync("/api/Patients/Conditions", new { patientId, conditionCode = cond1 });

                // Act: Try to add second conflicting condition
                var response = await PostAsync("/api/Patients/Conditions", new { patientId, conditionCode = cond2 });

                // Assert
                Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
            }
        }

        #endregion
    }
}
