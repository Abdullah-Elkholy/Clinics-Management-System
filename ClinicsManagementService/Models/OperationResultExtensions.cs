using System;

namespace ClinicsManagementService.Models
{
    public static class OperationResultExtensions
    {
        /// <summary>
        /// Normalize a nullable OperationResult<T> into a concrete, standardized OperationResult<T>.
        /// This centralizes the mapping of State/IsSuccess/ResultMessage into a single place so callers
        /// don't need to repeat the same if/else checks everywhere.
        /// </summary>
        public static OperationResult<T> Normalize<T>(this OperationResult<T>? result, string defaultFailureMessage = "Operation failed")
        {
            if (result is null)
                return OperationResult<T>.Failure(defaultFailureMessage);

            switch (result.State)
            {
                case OperationState.Waiting:
                    return OperationResult<T>.Waiting(result.ResultMessage ?? "Waiting...", result.Data);
                case OperationState.PendingNET:
                    return OperationResult<T>.PendingNET(result.ResultMessage ?? "Internet connection unavailable", result.Data);
                case OperationState.PendingQR:
                    return OperationResult<T>.PendingQR(result.ResultMessage ?? "Authentication required", result.Data);
                default:
                    // For Success/Failure or any other state, fall through to IsSuccess check below
                    break;
            }

            if (result.IsSuccess == true)
                return OperationResult<T>.Success(result.Data);

            // If IsSuccess is null, treat as Waiting (operation not completed yet)
            if (result.IsSuccess == null)
                return OperationResult<T>.Waiting(result.ResultMessage ?? "Waiting...", result.Data);

            // Generic failure (IsSuccess false but no special State)
            return OperationResult<T>.Failure(result.ResultMessage ?? defaultFailureMessage, result.Data);
        }

        /// <summary>
        /// Convenience boolean helpers to inspect states quickly.
        /// </summary>
        public static bool IsWaiting(this IOperationResult? r) => r?.State == OperationState.Waiting;
        public static bool IsPendingNet(this IOperationResult? r) => r?.State == OperationState.PendingNET;
        public static bool IsPendingQr(this IOperationResult? r) => r?.State == OperationState.PendingQR;
    }
}
