namespace Clinics.Api.DTOs;

public class OngoingSessionDto
{
    public Guid SessionId { get; set; }
    public string QueueName { get; set; } = string.Empty;
    public DateTime StartTime { get; set; }
    public int Total { get; set; }
    public int Sent { get; set; }
    public string Status { get; set; } = "active"; // active, paused
    public List<SessionPatientDto> Patients { get; set; } = new();
}

public class SessionPatientDto
{
    public int PatientId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty; // sent, pending, failed
    public bool IsPaused { get; set; } = false;
}
