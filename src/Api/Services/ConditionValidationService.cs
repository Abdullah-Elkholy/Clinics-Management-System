using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Clinics.Domain;
using Clinics.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Clinics.Api.Services
{
    /// <summary>
    /// Service for validating message conditions.
    /// Supports operator-driven state machine:
    /// - UNCONDITIONED: No criteria (no numeric fields)
    /// - DEFAULT: Queue default (unique per queue, enforced via index)
    /// - EQUAL/GREATER/LESS/RANGE: Active rules with value constraints
    /// 
    /// Handles:
    /// - Operator and value validation matrix
    /// - One-to-one template-condition enforcement
    /// - Overlap detection between active conditions (ignores DEFAULT/UNCONDITIONED)
    /// - DEFAULT uniqueness enforcement per queue
    /// </summary>
    public interface IConditionValidationService
    {
        /// <summary>
        /// Validate a single condition's operator and value combination.
        /// Enforces operator-specific field constraints.
        /// </summary>
        Task<ValidationResult> ValidateSingleConditionAsync(string operatorName, int? value, int? minValue, int? maxValue);

        /// <summary>
        /// Check if a condition overlaps with existing active conditions in the queue.
        /// Ignores DEFAULT and UNCONDITIONED operators (they don't participate in conflicts).
        /// </summary>
        Task<bool> HasOverlapAsync(int queueId, string operatorName, int? value, int? minValue, int? maxValue, int? excludeConditionId = null);

        /// <summary>
        /// Check if a template already has a condition (one-to-one enforcement).
        /// </summary>
        Task<bool> TemplateHasConditionAsync(int templateId);

        /// <summary>
        /// Check if DEFAULT operator is already assigned to another condition in the queue.
        /// Returns true if conflict exists (unless excludeConditionId matches).
        /// </summary>
        Task<bool> IsDefaultAlreadyUsedAsync(int queueId, int? excludeConditionId = null);
    }

    public class ConditionValidationService : IConditionValidationService
    {
        private readonly ApplicationDbContext _context;

        public ConditionValidationService(ApplicationDbContext context)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
        }

        /// <summary>
        /// Validate operator and field combination according to matrix:
        /// UNCONDITIONED: Value, MinValue, MaxValue all null
        /// DEFAULT: Value, MinValue, MaxValue all null
        /// EQUAL: Value required; MinValue, MaxValue null
        /// GREATER: Value required; MinValue, MaxValue null
        /// LESS: Value required; MinValue, MaxValue null
        /// RANGE: MinValue and MaxValue required; Value null
        /// </summary>
        public Task<ValidationResult> ValidateSingleConditionAsync(string operatorName, int? value, int? minValue, int? maxValue)
        {
            // Validate operator
            if (!IsValidOperator(operatorName))
                return Task.FromResult(ValidationResult.Failure(
                    $"Invalid operator: {operatorName}. Must be UNCONDITIONED, DEFAULT, EQUAL, GREATER, LESS, or RANGE."));

            // Operator-specific validation matrix
            var result = operatorName.ToUpper() switch
            {
                "UNCONDITIONED" => ValidateUnconditionedCondition(value, minValue, maxValue),
                "DEFAULT" => ValidateDefaultCondition(value, minValue, maxValue),
                "EQUAL" => ValidateEqualCondition(value, minValue, maxValue),
                "GREATER" => ValidateGreaterCondition(value, minValue, maxValue),
                "LESS" => ValidateLessCondition(value, minValue, maxValue),
                "RANGE" => ValidateRangeCondition(value, minValue, maxValue),
                _ => ValidationResult.Failure($"Unknown operator: {operatorName}")
            };
            return Task.FromResult(result);
        }

        public async Task<bool> HasOverlapAsync(int queueId, string operatorName, int? value, int? minValue, int? maxValue, int? excludeConditionId = null)
        {
            // DEFAULT and UNCONDITIONED don't participate in overlap detection
            if (operatorName?.ToUpper() is "DEFAULT" or "UNCONDITIONED")
                return false;

            // Fetch all active (non-sentinel) conditions for this queue
            var conditions = await _context.Set<MessageCondition>()
                .Where(c => c.QueueId == queueId 
                    && c.Id != (excludeConditionId ?? -1)
                    && c.Operator != "DEFAULT" 
                    && c.Operator != "UNCONDITIONED")
                .ToListAsync();

            foreach (var existingCondition in conditions)
            {
                if (ConditionsOverlap(operatorName ?? "", value, minValue, maxValue, 
                    existingCondition.Operator, existingCondition.Value, existingCondition.MinValue, existingCondition.MaxValue))
                {
                    return true;
                }
            }

            return false;
        }

        public async Task<bool> TemplateHasConditionAsync(int templateId)
        {
            return await _context.Set<MessageCondition>()
                .AnyAsync(c => c.TemplateId == templateId);
        }

        public async Task<bool> IsDefaultAlreadyUsedAsync(int queueId, int? excludeConditionId = null)
        {
            return await _context.Set<MessageCondition>()
                .AnyAsync(c => c.QueueId == queueId 
                    && c.Operator == "DEFAULT" 
                    && c.Id != (excludeConditionId ?? -1));
        }

        #region Helper Methods

        private bool IsValidOperator(string operatorName)
        {
            return operatorName?.ToUpper() switch
            {
                "UNCONDITIONED" or "DEFAULT" or "EQUAL" or "GREATER" or "LESS" or "RANGE" => true,
                _ => false
            };
        }

        /// <summary>
        /// UNCONDITIONED: All numeric fields must be null
        /// </summary>
        private ValidationResult ValidateUnconditionedCondition(int? value, int? minValue, int? maxValue)
        {
            if (value.HasValue || minValue.HasValue || maxValue.HasValue)
                return ValidationResult.Failure(
                    "UNCONDITIONED operator requires all numeric fields (Value, MinValue, MaxValue) to be null");
            return ValidationResult.Success();
        }

        /// <summary>
        /// DEFAULT: All numeric fields must be null
        /// </summary>
        private ValidationResult ValidateDefaultCondition(int? value, int? minValue, int? maxValue)
        {
            if (value.HasValue || minValue.HasValue || maxValue.HasValue)
                return ValidationResult.Failure(
                    "DEFAULT operator requires all numeric fields (Value, MinValue, MaxValue) to be null");
            return ValidationResult.Success();
        }

        /// <summary>
        /// EQUAL: Value required; MinValue and MaxValue must be null
        /// </summary>
        private ValidationResult ValidateEqualCondition(int? value, int? minValue, int? maxValue)
        {
            if (!value.HasValue)
                return ValidationResult.Failure("EQUAL operator requires a Value");
            if (minValue.HasValue || maxValue.HasValue)
                return ValidationResult.Failure("EQUAL operator requires MinValue and MaxValue to be null");
            return ValidationResult.Success();
        }

        /// <summary>
        /// GREATER: Value required; MinValue and MaxValue must be null
        /// </summary>
        private ValidationResult ValidateGreaterCondition(int? value, int? minValue, int? maxValue)
        {
            if (!value.HasValue)
                return ValidationResult.Failure("GREATER operator requires a Value");
            if (minValue.HasValue || maxValue.HasValue)
                return ValidationResult.Failure("GREATER operator requires MinValue and MaxValue to be null");
            return ValidationResult.Success();
        }

        /// <summary>
        /// LESS: Value required; MinValue and MaxValue must be null
        /// </summary>
        private ValidationResult ValidateLessCondition(int? value, int? minValue, int? maxValue)
        {
            if (!value.HasValue)
                return ValidationResult.Failure("LESS operator requires a Value");
            if (minValue.HasValue || maxValue.HasValue)
                return ValidationResult.Failure("LESS operator requires MinValue and MaxValue to be null");
            return ValidationResult.Success();
        }

        /// <summary>
        /// RANGE: MinValue and MaxValue required; Value must be null; MinValue <= MaxValue
        /// </summary>
        private ValidationResult ValidateRangeCondition(int? value, int? minValue, int? maxValue)
        {
            if (!minValue.HasValue || !maxValue.HasValue)
                return ValidationResult.Failure("RANGE operator requires both MinValue and MaxValue");

            if (value.HasValue)
                return ValidationResult.Failure("RANGE operator requires Value to be null");

            if (minValue > maxValue)
                return ValidationResult.Failure($"MinValue ({minValue}) must be less than or equal to MaxValue ({maxValue})");

            return ValidationResult.Success();
        }

        private bool ConditionsOverlap(
            string op1, int? val1, int? minVal1, int? maxVal1,
            string op2, int? val2, int? minVal2, int? maxVal2)
        {
            // Normalize operators to uppercase
            op1 = op1?.ToUpper() ?? "";
            op2 = op2?.ToUpper() ?? "";

            // EQUAL vs EQUAL: exact match
            if (op1 == "EQUAL" && op2 == "EQUAL" && val1 == val2)
                return true;

            // EQUAL vs GREATER: overlap if val1 > val2
            if (op1 == "EQUAL" && op2 == "GREATER" && val1 > val2)
                return true;
            if (op1 == "GREATER" && op2 == "EQUAL" && val2 > val1)
                return true;

            // EQUAL vs LESS: overlap if val1 < val2
            if (op1 == "EQUAL" && op2 == "LESS" && val1 < val2)
                return true;
            if (op1 == "LESS" && op2 == "EQUAL" && val2 < val1)
                return true;

            // EQUAL vs RANGE: overlap if minVal2 <= val1 <= maxVal2
            if (op1 == "EQUAL" && op2 == "RANGE" && val1 >= minVal2 && val1 <= maxVal2)
                return true;
            if (op1 == "RANGE" && op2 == "EQUAL" && val2 >= minVal1 && val2 <= maxVal1)
                return true;

            // GREATER vs GREATER: always overlap (unbounded)
            if (op1 == "GREATER" && op2 == "GREATER")
                return true;

            // GREATER vs LESS: overlap if val1 < val2
            if (op1 == "GREATER" && op2 == "LESS" && val1 < val2)
                return true;
            if (op1 == "LESS" && op2 == "GREATER" && val2 < val1)
                return true;

            // GREATER vs RANGE: overlap if minVal2 > val1
            if (op1 == "GREATER" && op2 == "RANGE" && minVal2 > val1)
                return true;
            if (op1 == "RANGE" && op2 == "GREATER" && minVal1 > val2)
                return true;

            // LESS vs LESS: always overlap
            if (op1 == "LESS" && op2 == "LESS")
                return true;

            // LESS vs RANGE: overlap if maxVal2 < val1
            if (op1 == "LESS" && op2 == "RANGE" && maxVal2 < val1)
                return true;
            if (op1 == "RANGE" && op2 == "LESS" && maxVal1 < val2)
                return true;

            // RANGE vs RANGE: overlap if ranges intersect
            if (op1 == "RANGE" && op2 == "RANGE")
            {
                return !(maxVal1 < minVal2 || maxVal2 < minVal1); // No overlap if one range is entirely before the other
            }

            return false;
        }

        #endregion
    }

    /// <summary>
    /// Result of a validation operation.
    /// </summary>
    public class ValidationResult
    {
        public bool IsValid { get; set; }

        public string? ErrorMessage { get; set; }

        public static ValidationResult Success() => new() { IsValid = true };

        public static ValidationResult Failure(string message) => new() { IsValid = false, ErrorMessage = message };
    }
}
