namespace IntegrationTests.Common;

/// <summary>
/// Centralized test trait names for categorization and filtering.
/// Used with xUnit [Trait] attribute to enable selective test runs in CI.
/// 
/// Example:
///   [Trait(TestTraits.ExpectedFail, "true")]
///   public async Task SomeSpec_WhenCondition_ReturnsExpected() { ... }
/// 
/// CI Filters:
///   Gating run (must pass): dotnet test --filter "Category!=ExpectedFail"
///   Spec run (allowed to fail): dotnet test (all tests) or --filter "Category=ExpectedFail"
/// </summary>
public static class TestTraits
{
    /// <summary>
    /// Marks a test as a specification of correct behavior not yet implemented.
    /// Used for tests that document business rules ahead of implementation.
    /// These tests are intentionally failing and should not block CI/CD.
    /// </summary>
    public const string ExpectedFail = "ExpectedToFail";

    /// <summary>
    /// Alternative trait key for easier filtering; mirrors ExpectedFail.
    /// Usage: [Trait("Category", "ExpectedToFail")]
    /// </summary>
    public const string Category = "Category";
    public const string ExpectedFailValue = "ExpectedToFail";

    /// <summary>
    /// Links test to specific business rule or feature area.
    /// Example: [Trait(TestTraits.BusinessRule, "Patient uniqueness per queue")]
    /// </summary>
    public const string BusinessRule = "BusinessRule";

    /// <summary>
    /// Marks test as smoke/fast (< 100ms) vs integration (DB heavy).
    /// Example: [Trait(TestTraits.Performance, "Smoke")]
    /// </summary>
    public const string Performance = "Performance";
    public const string SmokeValue = "Smoke";
    public const string IntegrationValue = "Integration";

    /// <summary>
    /// Marks area of system under test (Auth, Queue, Patient, etc).
    /// Example: [Trait(TestTraits.Area, "Auth")]
    /// </summary>
    public const string Area = "Area";
}
