namespace Clinics.Api.DTOs;

public class OngoingSessionDto
{
    public Guid SessionId { get; set; }
    public int QueueId { get; set; }
    public string QueueName { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public int Total { get; set; }
    public int Sent { get; set; }
    public string Status { get; set; } = "active"; // active, paused
    public List<SessionPatientDto> Patients { get; set; } = new();
    
    /// <summary>
    /// Correlation ID for tracking this session through logs and retry flows
    /// </summary>
    public Guid? CorrelationId { get; set; }
    
    /// <summary>
    /// Detailed pause reason structure
    /// </summary>
    public PauseReasonDetails? PauseDetails { get; set; }
}

public class SessionPatientDto
{
    public int PatientId { get; set; }
    public Guid? MessageId { get; set; } // Message ID for retry operations
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string CountryCode { get; set; } = "+966";
    public string Status { get; set; } = string.Empty; // sent, pending, failed
    public bool IsPaused { get; set; } = false;
    public int Attempts { get; set; } = 0;
    public string? FailedReason { get; set; } // ErrorMessage from Message entity
    
    /// <summary>
    /// Current attempt number for this message (1-based)
    /// </summary>
    public int AttemptNumber { get; set; } = 1;
}

public class FailedSessionDto
{
    public Guid SessionId { get; set; }
    public int QueueId { get; set; }
    public string QueueName { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public int Total { get; set; }
    public int Failed { get; set; }
    public List<SessionPatientDto> Patients { get; set; } = new();
}

public class CompletedSessionDto
{
    public Guid SessionId { get; set; }
    public int QueueId { get; set; }
    public string QueueName { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public DateTime? CompletedAt { get; set; }
    public int Total { get; set; }
    public int Sent { get; set; }
    public int Failed { get; set; } // Number of failed messages
    public bool HasFailedMessages { get; set; } // Indicates if session has any failed messages
    public List<SentMessageDto> SentMessages { get; set; } = new(); // Only successfully sent messages
}

/// <summary>
/// DTO for successfully sent messages in completed sessions
/// </summary>
public class SentMessageDto
{
    public Guid MessageId { get; set; }
    public int PatientId { get; set; }
    public string PatientName { get; set; } = string.Empty;
    public string PatientPhone { get; set; } = string.Empty;
    public string CountryCode { get; set; } = "+966";
    public string Content { get; set; } = string.Empty; // Resolved content (no variables)
    public DateTime SentAt { get; set; }
    public int? CreatedBy { get; set; }
    public int? UpdatedBy { get; set; }
}

/// <summary>
/// Detailed pause reason structure for sessions
/// </summary>
public class PauseReasonDetails
{
    /// <summary>
    /// Pause reason code: USER_INITIATED, AUTO_PAUSED_ON_ERROR, RATE_LIMIT, etc.
    /// </summary>
    public string ReasonCode { get; set; } = string.Empty;
    
    /// <summary>
    /// Human-readable pause reason message
    /// </summary>
    public string Message { get; set; } = string.Empty;
    
    /// <summary>
    /// When the pause occurred
    /// </summary>
    public DateTime PausedAt { get; set; }
    
    /// <summary>
    /// User ID who initiated the pause (if applicable)
    /// </summary>
    public int? PausedBy { get; set; }
    
    /// <summary>
    /// Associated error details if pause was triggered by an error
    /// </summary>
    public string? ErrorDetails { get; set; }
}
