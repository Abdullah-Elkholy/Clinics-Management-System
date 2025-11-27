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
    /// <summary>
    /// FailedTask.Id (long) or Message.Id (Guid) depending on source.
    /// For Messages: use MessageId field.
    /// For FailedTasks: use FailedTaskId field converted to Guid.
    /// </summary>
    public Guid Id { get; set; }
    
    /// <summary>
    /// FailedTask entity ID (if source is FailedTask table)
    /// </summary>
    public long? FailedTaskId { get; set; }
    
    /// <summary>
    /// Message entity ID (if source is Message table)
    /// </summary>
    public Guid? MessageId { get; set; }
    public int QueueId { get; set; }
    public string QueueName { get; set; } = string.Empty;
    public int ModeratorId { get; set; }
    public string ModeratorName { get; set; } = string.Empty;
    public string PatientPhone { get; set; } = string.Empty;
    public string MessageContent { get; set; } = string.Empty;
    public int Attempts { get; set; }
    public string? ErrorMessage { get; set; }
    public string Status { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
    public DateTime? LastAttemptAt { get; set; }
}

public class PaginatedFailedTasksResponse
{
    public List<FailedTaskDto> Items { get; set; } = new();
    public int TotalCount { get; set; }
    public int PageNumber { get; set; }
    public int PageSize { get; set; }
    public int TotalPages => (TotalCount + PageSize - 1) / PageSize;
    public bool HasNextPage => PageNumber < TotalPages;
    public bool HasPreviousPage => PageNumber > 1;
}
