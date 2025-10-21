namespace Clinics.Api.DTOs;

public class RetryTasksRequest
{
    public List<long> TaskIds { get; set; } = new();
}

public class DeleteTasksRequest
{
    public List<long> TaskIds { get; set; } = new();
}

public class RetryTasksResponse
{
    public int RetriedCount { get; set; }
    public List<string> Errors { get; set; } = new();
}

public class DeleteTasksResponse
{
    public int DeletedCount { get; set; }
}

public class FailedTaskDto
{
    public long TaskId { get; set; }
    public string QueueName { get; set; } = string.Empty;
    public string PatientName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Error { get; set; } = string.Empty;
    public string ErrorDetails { get; set; } = string.Empty;
    public int RetryCount { get; set; }
    public DateTime FailedAt { get; set; }
    public List<RetryHistoryItem> RetryHistory { get; set; } = new();
}

public class RetryHistoryItem
{
    public DateTime Timestamp { get; set; }
    public string Status { get; set; } = string.Empty;
    public string Error { get; set; } = string.Empty;
}
