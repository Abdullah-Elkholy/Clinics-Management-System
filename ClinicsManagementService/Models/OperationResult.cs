using System;

namespace ClinicsManagementService.Models
{
    public enum OperationState
    {
        Success,
        Failure,
        Waiting,
        PendingQR,
        PendingNET,
    }

    public interface IOperationResult
    {
        bool? IsSuccess { get; }
        string? ResultMessage { get; }
        OperationState State { get; }
    }

    public class OperationResult : IOperationResult
    {
        public bool? IsSuccess { get; }
        public string? ResultMessage { get; }
        public OperationState State { get; }

        protected OperationResult(bool? isSuccess, string? resultMessage = null, OperationState state = OperationState.Waiting)
        {
            IsSuccess = isSuccess;
            ResultMessage = resultMessage;
            State = state;
        }

        public static OperationResult CreateSuccess(string message) => 
            new OperationResult(true, message, OperationState.Success);
        public static OperationResult CreateFailure(string error) => 
            new OperationResult(false, error, OperationState.Failure);
        public static OperationResult CreatePendingQR(string message) => 
            new OperationResult(false, message, OperationState.PendingQR);
        public static OperationResult CreatePendingNET(string message) => 
            new OperationResult(false, message, OperationState.PendingNET);
        public static OperationResult CreateWaiting() => 
            new OperationResult(null, null, OperationState.Waiting);
    }

    /// <summary>
    /// Generic unified operation result which carries a payload of type T.
    /// Use this type across services/controllers to return a stable, typed result.
    /// </summary>
    public class OperationResult<T> : OperationResult
    {
        public T? Data { get; }

        protected OperationResult(bool? isSuccess, T? data = default, string? resultMessage = null, OperationState state = OperationState.Waiting)
            : base(isSuccess, resultMessage, state)
        {
            Data = data;
        }

        public static OperationResult<T> Success(T? data) => new OperationResult<T>(true, data, null, OperationState.Success);
        public static OperationResult<T> Failure(string error, T? data = default) => new OperationResult<T>(false, data, error, OperationState.Failure);
        public static OperationResult<T> Waiting(T? data = default) => new OperationResult<T>(null, data, null, OperationState.Waiting);
        public static OperationResult<T> PendingQR(string message = "Please scan the QR code to authenticate.", T? data = default) => new OperationResult<T>(false, data, message, OperationState.PendingQR);
        public static OperationResult<T> PendingNET(string message = "Internet connection unavailable", T? data = default) => new OperationResult<T>(false, data, message, OperationState.PendingNET);
    }

}