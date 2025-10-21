namespace Clinics.Application.Common
{
    /// <summary>
    /// Result Pattern - Provides consistent response handling across application
    /// Follows functional programming style for better error handling
    /// Eliminates throwing exceptions for expected failures
    /// </summary>
    public class Result
    {
        public bool IsSuccess { get; protected set; }
        public string Message { get; protected set; }
        public IEnumerable<ErrorDetail>? Errors { get; protected set; }

        protected Result(bool isSuccess, string message, IEnumerable<ErrorDetail>? errors = null)
        {
            IsSuccess = isSuccess;
            Message = message;
            Errors = errors ?? new List<ErrorDetail>();
        }

        public static Result Success(string message = "Operation completed successfully")
            => new Result(true, message);

        public static Result Failure(string message, IEnumerable<ErrorDetail>? errors = null)
            => new Result(false, message, errors);

        public static Result Failure(string message, params ErrorDetail[] errors)
            => new Result(false, message, errors);
    }

    /// <summary>
    /// Generic Result for returning data
    /// </summary>
    public class Result<T> : Result
    {
        public T? Data { get; set; }

        private Result(bool isSuccess, string message, T? data = default, IEnumerable<ErrorDetail>? errors = null)
            : base(isSuccess, message, errors)
        {
            Data = data;
        }

        public static Result<T> Success(T data, string message = "Operation completed successfully")
            => new Result<T>(true, message, data);

        public static new Result<T> Failure(string message, IEnumerable<ErrorDetail>? errors = null)
            => new Result<T>(false, message, default, errors);

        public static new Result<T> Failure(string message, params ErrorDetail[] errors)
            => new Result<T>(false, message, default, errors);
    }

    /// <summary>
    /// Error Detail - Structured error information
    /// </summary>
    public class ErrorDetail
    {
        public string Code { get; set; } = "UnknownError";
        public string Message { get; set; } = string.Empty;

        public ErrorDetail() { }

        public ErrorDetail(string code, string message)
        {
            Code = code;
            Message = message;
        }
    }
}
