using System;
using System.Collections.Generic;
using System.Linq;
using Clinics.Domain;
using FluentAssertions;
using Xunit;

namespace Clinics.Api.Tests.Unit.Templates;

/// <summary>
/// Phase 2.1: Unit tests for template condition evaluation.
/// 
/// Tests verify correct evaluation of MessageCondition operators:
/// - EQUAL: field == Value
/// - GREATER: field > Value
/// - LESS: field < Value
/// - RANGE: MinValue <= field <= MaxValue
/// - DEFAULT: fallback template (always matches when no other matches)
/// - UNCONDITIONED: no criteria (always included in candidates)
/// 
/// Edge cases tested include boundary values, null handling, and validation.
/// </summary>
public class ConditionEvaluationTests
{
    #region Test Helpers

    /// <summary>
    /// Simulates condition evaluation logic
    /// </summary>
    private static class ConditionEvaluator
    {
        /// <summary>
        /// Checks if a condition matches the given patient position
        /// </summary>
        public static bool Matches(MessageCondition condition, int patientPosition)
        {
            return condition.Operator switch
            {
                "EQUAL" => condition.Value.HasValue && patientPosition == condition.Value.Value,
                "NOT_EQUALS" => condition.Value.HasValue && patientPosition != condition.Value.Value,
                "GREATER" => condition.Value.HasValue && patientPosition > condition.Value.Value,
                "LESS" => condition.Value.HasValue && patientPosition < condition.Value.Value,
                "RANGE" => condition.MinValue.HasValue && condition.MaxValue.HasValue &&
                           patientPosition >= condition.MinValue.Value &&
                           patientPosition <= condition.MaxValue.Value,
                "DEFAULT" => false, // DEFAULT is a fallback, not a match
                "UNCONDITIONED" => true, // Always matches (no criteria)
                _ => false
            };
        }

        /// <summary>
        /// Selects the best matching template from a list for a given patient position
        /// </summary>
        public static MessageCondition? SelectBestMatch(IEnumerable<MessageCondition> conditions, int patientPosition)
        {
            var candidates = conditions.Where(c => Matches(c, patientPosition)).ToList();

            if (candidates.Any())
            {
                // Return most specific match (EQUAL > RANGE > GREATER/LESS > UNCONDITIONED)
                return candidates
                    .OrderByDescending(c => GetPriority(c.Operator))
                    .ThenBy(c => c.Id)
                    .First();
            }

            // No matches - return DEFAULT if exists
            return conditions.FirstOrDefault(c => c.Operator == "DEFAULT");
        }

        private static int GetPriority(string op) => op switch
        {
            "EQUAL" => 100,
            "RANGE" => 80,
            "GREATER" => 60,
            "LESS" => 60,
            "UNCONDITIONED" => 10,
            _ => 0
        };

        /// <summary>
        /// Validates a condition's field consistency
        /// </summary>
        public static (bool IsValid, string? Error) Validate(MessageCondition condition)
        {
            return condition.Operator switch
            {
                "EQUAL" or "GREATER" or "LESS" when !condition.Value.HasValue =>
                    (false, $"Operator {condition.Operator} requires Value"),
                "EQUAL" or "GREATER" or "LESS" when condition.MinValue.HasValue || condition.MaxValue.HasValue =>
                    (false, $"Operator {condition.Operator} should not have MinValue/MaxValue"),
                "RANGE" when !condition.MinValue.HasValue || !condition.MaxValue.HasValue =>
                    (false, "Operator RANGE requires both MinValue and MaxValue"),
                "RANGE" when condition.MinValue > condition.MaxValue =>
                    (false, "MinValue must be <= MaxValue"),
                "RANGE" when condition.Value.HasValue =>
                    (false, "Operator RANGE should not have Value"),
                "DEFAULT" or "UNCONDITIONED" when condition.Value.HasValue ||
                    condition.MinValue.HasValue || condition.MaxValue.HasValue =>
                    (false, $"Operator {condition.Operator} should not have any values"),
                _ => (true, null)
            };
        }
    }

    private static MessageCondition CreateCondition(
        string op,
        int? value = null,
        int? minValue = null,
        int? maxValue = null,
        int id = 1,
        int queueId = 1)
    {
        return new MessageCondition
        {
            Id = id,
            QueueId = queueId,
            Operator = op,
            Value = value,
            MinValue = minValue,
            MaxValue = maxValue,
            CreatedAt = DateTime.UtcNow
        };
    }

    #endregion

    #region EQUAL Operator Tests

    [Fact]
    public void EQUAL_ExactMatch_ShouldReturnTrue()
    {
        var condition = CreateCondition("EQUAL", value: 5);
        ConditionEvaluator.Matches(condition, 5).Should().BeTrue();
    }

    [Fact]
    public void EQUAL_NoMatch_ShouldReturnFalse()
    {
        var condition = CreateCondition("EQUAL", value: 5);
        ConditionEvaluator.Matches(condition, 4).Should().BeFalse();
        ConditionEvaluator.Matches(condition, 6).Should().BeFalse();
    }

    [Fact]
    public void EQUAL_ZeroValue_ShouldWork()
    {
        var condition = CreateCondition("EQUAL", value: 0);
        ConditionEvaluator.Matches(condition, 0).Should().BeTrue();
        ConditionEvaluator.Matches(condition, 1).Should().BeFalse();
    }

    [Fact]
    public void EQUAL_NegativeValue_ShouldWork()
    {
        var condition = CreateCondition("EQUAL", value: -1);
        ConditionEvaluator.Matches(condition, -1).Should().BeTrue();
        ConditionEvaluator.Matches(condition, 0).Should().BeFalse();
    }

    [Fact]
    public void EQUAL_NullValue_ShouldReturnFalse()
    {
        var condition = CreateCondition("EQUAL", value: null);
        ConditionEvaluator.Matches(condition, 5).Should().BeFalse();
    }

    #endregion

    #region NOT_EQUALS Operator Tests

    [Fact]
    public void NOT_EQUALS_DifferentValue_ShouldReturnTrue()
    {
        var condition = CreateCondition("NOT_EQUALS", value: 5);
        ConditionEvaluator.Matches(condition, 4).Should().BeTrue();
        ConditionEvaluator.Matches(condition, 6).Should().BeTrue();
    }

    [Fact]
    public void NOT_EQUALS_SameValue_ShouldReturnFalse()
    {
        var condition = CreateCondition("NOT_EQUALS", value: 5);
        ConditionEvaluator.Matches(condition, 5).Should().BeFalse();
    }

    [Fact]
    public void NOT_EQUALS_ZeroValue_ShouldWork()
    {
        var condition = CreateCondition("NOT_EQUALS", value: 0);
        ConditionEvaluator.Matches(condition, 1).Should().BeTrue();
        ConditionEvaluator.Matches(condition, 0).Should().BeFalse();
    }

    [Fact]
    public void NOT_EQUALS_NullValue_ShouldReturnFalse()
    {
        var condition = CreateCondition("NOT_EQUALS", value: null);
        ConditionEvaluator.Matches(condition, 5).Should().BeFalse();
    }

    #endregion

    #region GREATER Operator Tests

    [Fact]
    public void GREATER_PatientAboveThreshold_ShouldReturnTrue()
    {
        var condition = CreateCondition("GREATER", value: 10);
        ConditionEvaluator.Matches(condition, 11).Should().BeTrue();
        ConditionEvaluator.Matches(condition, 100).Should().BeTrue();
    }

    [Fact]
    public void GREATER_PatientAtThreshold_ShouldReturnFalse()
    {
        var condition = CreateCondition("GREATER", value: 10);
        ConditionEvaluator.Matches(condition, 10).Should().BeFalse();
    }

    [Fact]
    public void GREATER_PatientBelowThreshold_ShouldReturnFalse()
    {
        var condition = CreateCondition("GREATER", value: 10);
        ConditionEvaluator.Matches(condition, 9).Should().BeFalse();
    }

    [Fact]
    public void GREATER_ZeroThreshold_ShouldWork()
    {
        var condition = CreateCondition("GREATER", value: 0);
        ConditionEvaluator.Matches(condition, 1).Should().BeTrue();
        ConditionEvaluator.Matches(condition, 0).Should().BeFalse();
        ConditionEvaluator.Matches(condition, -1).Should().BeFalse();
    }

    #endregion

    #region LESS Operator Tests

    [Fact]
    public void LESS_PatientBelowThreshold_ShouldReturnTrue()
    {
        var condition = CreateCondition("LESS", value: 10);
        ConditionEvaluator.Matches(condition, 9).Should().BeTrue();
        ConditionEvaluator.Matches(condition, 1).Should().BeTrue();
    }

    [Fact]
    public void LESS_PatientAtThreshold_ShouldReturnFalse()
    {
        var condition = CreateCondition("LESS", value: 10);
        ConditionEvaluator.Matches(condition, 10).Should().BeFalse();
    }

    [Fact]
    public void LESS_PatientAboveThreshold_ShouldReturnFalse()
    {
        var condition = CreateCondition("LESS", value: 10);
        ConditionEvaluator.Matches(condition, 11).Should().BeFalse();
    }

    [Fact]
    public void LESS_ZeroThreshold_ShouldWork()
    {
        var condition = CreateCondition("LESS", value: 0);
        ConditionEvaluator.Matches(condition, -1).Should().BeTrue();
        ConditionEvaluator.Matches(condition, 0).Should().BeFalse();
    }

    #endregion

    #region RANGE Operator Tests

    [Fact]
    public void RANGE_PatientInRange_ShouldReturnTrue()
    {
        var condition = CreateCondition("RANGE", minValue: 5, maxValue: 10);
        ConditionEvaluator.Matches(condition, 7).Should().BeTrue();
    }

    [Fact]
    public void RANGE_PatientAtMinBoundary_ShouldReturnTrue()
    {
        var condition = CreateCondition("RANGE", minValue: 5, maxValue: 10);
        ConditionEvaluator.Matches(condition, 5).Should().BeTrue();
    }

    [Fact]
    public void RANGE_PatientAtMaxBoundary_ShouldReturnTrue()
    {
        var condition = CreateCondition("RANGE", minValue: 5, maxValue: 10);
        ConditionEvaluator.Matches(condition, 10).Should().BeTrue();
    }

    [Fact]
    public void RANGE_PatientBelowRange_ShouldReturnFalse()
    {
        var condition = CreateCondition("RANGE", minValue: 5, maxValue: 10);
        ConditionEvaluator.Matches(condition, 4).Should().BeFalse();
    }

    [Fact]
    public void RANGE_PatientAboveRange_ShouldReturnFalse()
    {
        var condition = CreateCondition("RANGE", minValue: 5, maxValue: 10);
        ConditionEvaluator.Matches(condition, 11).Should().BeFalse();
    }

    [Fact]
    public void RANGE_SingleValueRange_ShouldWork()
    {
        var condition = CreateCondition("RANGE", minValue: 5, maxValue: 5);
        ConditionEvaluator.Matches(condition, 5).Should().BeTrue();
        ConditionEvaluator.Matches(condition, 4).Should().BeFalse();
        ConditionEvaluator.Matches(condition, 6).Should().BeFalse();
    }

    [Fact]
    public void RANGE_NegativeRange_ShouldWork()
    {
        var condition = CreateCondition("RANGE", minValue: -5, maxValue: -1);
        ConditionEvaluator.Matches(condition, -3).Should().BeTrue();
        ConditionEvaluator.Matches(condition, 0).Should().BeFalse();
    }

    [Fact]
    public void RANGE_SpanningZero_ShouldWork()
    {
        var condition = CreateCondition("RANGE", minValue: -5, maxValue: 5);
        ConditionEvaluator.Matches(condition, 0).Should().BeTrue();
        ConditionEvaluator.Matches(condition, -5).Should().BeTrue();
        ConditionEvaluator.Matches(condition, 5).Should().BeTrue();
    }

    #endregion

    #region DEFAULT Operator Tests

    [Fact]
    public void DEFAULT_NeverDirectlyMatches()
    {
        var condition = CreateCondition("DEFAULT");
        ConditionEvaluator.Matches(condition, 0).Should().BeFalse();
        ConditionEvaluator.Matches(condition, 100).Should().BeFalse();
    }

    [Fact]
    public void DEFAULT_UsedAsFallback_WhenNoOtherMatch()
    {
        var conditions = new[]
        {
            CreateCondition("EQUAL", value: 5, id: 1),
            CreateCondition("DEFAULT", id: 2)
        };

        // Position 5 matches EQUAL
        var match5 = ConditionEvaluator.SelectBestMatch(conditions, 5);
        match5!.Operator.Should().Be("EQUAL");

        // Position 10 falls back to DEFAULT
        var match10 = ConditionEvaluator.SelectBestMatch(conditions, 10);
        match10!.Operator.Should().Be("DEFAULT");
    }

    #endregion

    #region UNCONDITIONED Operator Tests

    [Fact]
    public void UNCONDITIONED_AlwaysMatches()
    {
        var condition = CreateCondition("UNCONDITIONED");
        ConditionEvaluator.Matches(condition, 0).Should().BeTrue();
        ConditionEvaluator.Matches(condition, -100).Should().BeTrue();
        ConditionEvaluator.Matches(condition, 100).Should().BeTrue();
    }

    [Fact]
    public void UNCONDITIONED_HasLowerPriorityThanSpecific()
    {
        var conditions = new[]
        {
            CreateCondition("UNCONDITIONED", id: 1),
            CreateCondition("EQUAL", value: 5, id: 2)
        };

        // Position 5 should match EQUAL (more specific)
        var match5 = ConditionEvaluator.SelectBestMatch(conditions, 5);
        match5!.Operator.Should().Be("EQUAL");

        // Position 10 should match UNCONDITIONED (only candidate)
        var match10 = ConditionEvaluator.SelectBestMatch(conditions, 10);
        match10!.Operator.Should().Be("UNCONDITIONED");
    }

    #endregion

    #region Priority and Selection Tests

    [Fact]
    public void SelectBestMatch_EQUAL_TakesPrecedenceOverRANGE()
    {
        var conditions = new[]
        {
            CreateCondition("RANGE", minValue: 5, maxValue: 10, id: 1),
            CreateCondition("EQUAL", value: 7, id: 2)
        };

        var match = ConditionEvaluator.SelectBestMatch(conditions, 7);
        match!.Operator.Should().Be("EQUAL");
    }

    [Fact]
    public void SelectBestMatch_RANGE_TakesPrecedenceOverGREATER()
    {
        var conditions = new[]
        {
            CreateCondition("GREATER", value: 5, id: 1),
            CreateCondition("RANGE", minValue: 10, maxValue: 20, id: 2)
        };

        // Position 15 matches both
        var match = ConditionEvaluator.SelectBestMatch(conditions, 15);
        match!.Operator.Should().Be("RANGE");

        // Position 25 only matches GREATER
        var match25 = ConditionEvaluator.SelectBestMatch(conditions, 25);
        match25!.Operator.Should().Be("GREATER");
    }

    [Fact]
    public void SelectBestMatch_NoConditions_ReturnsNull()
    {
        var conditions = Array.Empty<MessageCondition>();
        var match = ConditionEvaluator.SelectBestMatch(conditions, 5);
        match.Should().BeNull();
    }

    [Fact]
    public void SelectBestMatch_OnlyDEFAULT_ReturnsDefault()
    {
        var conditions = new[] { CreateCondition("DEFAULT") };
        var match = ConditionEvaluator.SelectBestMatch(conditions, 5);
        match!.Operator.Should().Be("DEFAULT");
    }

    #endregion

    #region Validation Tests

    [Fact]
    public void Validate_EQUAL_RequiresValue()
    {
        var condition = CreateCondition("EQUAL", value: null);
        var (isValid, error) = ConditionEvaluator.Validate(condition);
        isValid.Should().BeFalse();
        error.Should().Contain("requires Value");
    }

    [Fact]
    public void Validate_EQUAL_RejectsMinMaxValue()
    {
        var condition = CreateCondition("EQUAL", value: 5, minValue: 1, maxValue: 10);
        var (isValid, _) = ConditionEvaluator.Validate(condition);
        isValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_RANGE_RequiresBothBounds()
    {
        var conditionNoMin = CreateCondition("RANGE", maxValue: 10);
        var conditionNoMax = CreateCondition("RANGE", minValue: 5);

        ConditionEvaluator.Validate(conditionNoMin).IsValid.Should().BeFalse();
        ConditionEvaluator.Validate(conditionNoMax).IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_RANGE_MinMustBeLessOrEqualMax()
    {
        var condition = CreateCondition("RANGE", minValue: 10, maxValue: 5);
        var (isValid, error) = ConditionEvaluator.Validate(condition);
        isValid.Should().BeFalse();
        error.Should().Contain("MinValue must be <= MaxValue");
    }

    [Fact]
    public void Validate_RANGE_RejectsValue()
    {
        var condition = CreateCondition("RANGE", value: 7, minValue: 5, maxValue: 10);
        var (isValid, _) = ConditionEvaluator.Validate(condition);
        isValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_DEFAULT_RejectsAllValues()
    {
        var conditionWithValue = CreateCondition("DEFAULT", value: 5);
        var conditionWithRange = CreateCondition("DEFAULT", minValue: 1, maxValue: 10);

        ConditionEvaluator.Validate(conditionWithValue).IsValid.Should().BeFalse();
        ConditionEvaluator.Validate(conditionWithRange).IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_UNCONDITIONED_RejectsAllValues()
    {
        var condition = CreateCondition("UNCONDITIONED", value: 5);
        var (isValid, _) = ConditionEvaluator.Validate(condition);
        isValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_ValidConditions_Pass()
    {
        ConditionEvaluator.Validate(CreateCondition("EQUAL", value: 5)).IsValid.Should().BeTrue();
        ConditionEvaluator.Validate(CreateCondition("GREATER", value: 10)).IsValid.Should().BeTrue();
        ConditionEvaluator.Validate(CreateCondition("LESS", value: 10)).IsValid.Should().BeTrue();
        ConditionEvaluator.Validate(CreateCondition("RANGE", minValue: 5, maxValue: 10)).IsValid.Should().BeTrue();
        ConditionEvaluator.Validate(CreateCondition("DEFAULT")).IsValid.Should().BeTrue();
        ConditionEvaluator.Validate(CreateCondition("UNCONDITIONED")).IsValid.Should().BeTrue();
    }

    #endregion

    #region Edge Cases

    [Fact]
    public void EdgeCase_UnknownOperator_ReturnsFalse()
    {
        var condition = CreateCondition("INVALID_OP", value: 5);
        ConditionEvaluator.Matches(condition, 5).Should().BeFalse();
    }

    [Fact]
    public void EdgeCase_MaxIntValue_ShouldWork()
    {
        var condition = CreateCondition("EQUAL", value: int.MaxValue);
        ConditionEvaluator.Matches(condition, int.MaxValue).Should().BeTrue();
    }

    [Fact]
    public void EdgeCase_MinIntValue_ShouldWork()
    {
        var condition = CreateCondition("EQUAL", value: int.MinValue);
        ConditionEvaluator.Matches(condition, int.MinValue).Should().BeTrue();
    }

    [Fact]
    public void EdgeCase_LargeRange_ShouldWork()
    {
        var condition = CreateCondition("RANGE", minValue: 0, maxValue: 1000000);
        ConditionEvaluator.Matches(condition, 500000).Should().BeTrue();
    }

    [Fact]
    public void EdgeCase_MultipleOverlappingConditions_PriorityWins()
    {
        var conditions = new[]
        {
            CreateCondition("UNCONDITIONED", id: 1),
            CreateCondition("GREATER", value: 0, id: 2),
            CreateCondition("RANGE", minValue: 5, maxValue: 15, id: 3),
            CreateCondition("EQUAL", value: 10, id: 4)
        };

        // Position 10 matches all - EQUAL wins
        var match = ConditionEvaluator.SelectBestMatch(conditions, 10);
        match!.Operator.Should().Be("EQUAL");
    }

    #endregion
}
