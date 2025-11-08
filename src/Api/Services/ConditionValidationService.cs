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
    /// Handles:
    /// - Operator and value validation
    /// - One-to-one template-condition enforcement
    /// - Overlap detection between conditions
    /// </summary>
    public interface IConditionValidationService
    {
        /// <summary>
        /// Validate a single condition's operator and value combination.
        /// </summary>
        Task<ValidationResult> ValidateSingleConditionAsync(string operatorName, int? value, int? minValue, int? maxValue);

        /// <summary>
        /// Check if a condition overlaps with existing conditions in the queue.
        /// Overlaps are conditions that match the same criteria.
        /// </summary>
        Task<bool> HasOverlapAsync(int queueId, string operatorName, int? value, int? minValue, int? maxValue, int? excludeConditionId = null);

        /// <summary>
        /// Check if a template already has a condition (one-to-one enforcement).
        /// </summary>
        Task<bool> TemplateHasConditionAsync(int templateId);
    }

    public class ConditionValidationService : IConditionValidationService
    {
        private readonly ApplicationDbContext _context;

        public ConditionValidationService(ApplicationDbContext context)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
        }

        public Task<ValidationResult> ValidateSingleConditionAsync(string operatorName, int? value, int? minValue, int? maxValue)
        {
            // Validate operator
            if (!IsValidOperator(operatorName))
                return Task.FromResult(ValidationResult.Failure($"Invalid operator: {operatorName}. Must be EQUAL, GREATER, LESS, or RANGE."));

            // Operator-specific validation
            var result = operatorName.ToUpper() switch
            {
                "EQUAL" => ValidateEqualCondition(value),
                "GREATER" => ValidateGreaterCondition(value),
                "LESS" => ValidateLessCondition(value),
                "RANGE" => ValidateRangeCondition(minValue, maxValue),
                _ => ValidationResult.Failure($"Unknown operator: {operatorName}")
            };
            return Task.FromResult(result);
        }

        public async Task<bool> HasOverlapAsync(int queueId, string operatorName, int? value, int? minValue, int? maxValue, int? excludeConditionId = null)
        {
            // Fetch all conditions for this queue
            var conditions = await _context.Set<MessageCondition>()
                .Where(c => c.QueueId == queueId && c.Id != (excludeConditionId ?? -1))
                .ToListAsync();

            foreach (var existingCondition in conditions)
            {
                if (ConditionsOverlap(operatorName, value, minValue, maxValue, 
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

        #region Helper Methods

        private bool IsValidOperator(string operatorName)
        {
            return operatorName?.ToUpper() switch
            {
                "EQUAL" or "GREATER" or "LESS" or "RANGE" => true,
                _ => false
            };
        }

        private ValidationResult ValidateEqualCondition(int? value)
        {
            if (!value.HasValue)
                return ValidationResult.Failure("EQUAL operator requires a Value");
            return ValidationResult.Success();
        }

        private ValidationResult ValidateGreaterCondition(int? value)
        {
            if (!value.HasValue)
                return ValidationResult.Failure("GREATER operator requires a Value");
            return ValidationResult.Success();
        }

        private ValidationResult ValidateLessCondition(int? value)
        {
            if (!value.HasValue)
                return ValidationResult.Failure("LESS operator requires a Value");
            return ValidationResult.Success();
        }

        private ValidationResult ValidateRangeCondition(int? minValue, int? maxValue)
        {
            if (!minValue.HasValue || !maxValue.HasValue)
                return ValidationResult.Failure("RANGE operator requires both MinValue and MaxValue");

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
