namespace Clinics.Api.DTOs
{
    /// <summary>
    /// Unified operation result for API responses.
    /// Provides consistent structure for success/failure with optional data payload.
    /// </summary>
    public class OperationResult<T>
    {
        public bool Success { get; set; }
        public string Category { get; set; } = "Success";
        public string? Message { get; set; }
        public T? Data { get; set; }

        public static OperationResult<T> Ok(T data, string? message = null) => new()
        {
            Success = true,
            Category = "Success",
            Data = data,
            Message = message
        };

        public static OperationResult<T> Error(string category, string message) => new()
        {
            Success = false,
            Category = category,
            Message = message
        };
    }
}
