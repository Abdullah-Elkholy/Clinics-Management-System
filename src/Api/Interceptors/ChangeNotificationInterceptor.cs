using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.AspNetCore.SignalR;
using Clinics.Api.Hubs;
using Clinics.Domain;

namespace Clinics.Api.Interceptors;

/// <summary>
/// EF Core interceptor for detecting entity changes and triggering SignalR notifications
/// Implements application-level CDC as per PERFORMANCE_RESEARCH_AND_CDC_ANALYSIS.md Section 10.2.5
/// </summary>
public class ChangeNotificationInterceptor : SaveChangesInterceptor
{
    private readonly IHubContext<DataUpdateHub> _hubContext;
    private readonly ILogger<ChangeNotificationInterceptor> _logger;

    public ChangeNotificationInterceptor(
        IHubContext<DataUpdateHub> hubContext,
        ILogger<ChangeNotificationInterceptor> logger)
    {
        _hubContext = hubContext;
        _logger = logger;
    }

    public override async ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        if (eventData.Context == null)
        {
            return await base.SavingChangesAsync(eventData, result, cancellationToken);
        }

        // Get all changed entries before SaveChanges is called
        var changedEntries = eventData.Context.ChangeTracker.Entries()
            .Where(e => e.State == EntityState.Added || 
                       e.State == EntityState.Modified || 
                       e.State == EntityState.Deleted)
            .ToList();

        // Store changes for notification after successful save
        var pendingNotifications = new List<Func<Task>>();

        foreach (var entry in changedEntries)
        {
            var entity = entry.Entity;
            var state = entry.State;
            int? moderatorId = null;
            string eventName = "";

            // Determine entity type and extract moderator ID
            switch (entity)
            {
                case Queue queue:
                    moderatorId = queue.ModeratorId;
                    eventName = state == EntityState.Deleted ? "QueueDeleted" : "QueueUpdated";
                    pendingNotifications.Add(async () => await NotifyQueueChange(queue, moderatorId, eventName));
                    break;

                case MessageTemplate template:
                    moderatorId = template.ModeratorId;
                    eventName = state == EntityState.Deleted ? "TemplateDeleted" : "TemplateUpdated";
                    pendingNotifications.Add(async () => await NotifyTemplateChange(template, moderatorId, eventName));
                    break;

                case Patient patient:
                    // Patient doesn't have direct ModeratorId, get it from Queue
                    if (entry.State != EntityState.Deleted)
                    {
                        var queue = await eventData.Context.Set<Queue>()
                            .AsNoTracking()
                            .FirstOrDefaultAsync(q => q.Id == patient.QueueId, cancellationToken);
                        moderatorId = queue?.ModeratorId;
                    }
                    eventName = state == EntityState.Deleted ? "PatientDeleted" : "PatientUpdated";
                    pendingNotifications.Add(async () => await NotifyPatientChange(patient, moderatorId, eventName));
                    break;

                case Message message:
                    moderatorId = message.ModeratorId;
                    eventName = state == EntityState.Deleted ? "MessageDeleted" : "MessageUpdated";
                    pendingNotifications.Add(async () => await NotifyMessageChange(message, moderatorId, eventName));
                    break;

                case MessageSession session:
                    moderatorId = session.ModeratorId;
                    eventName = state == EntityState.Deleted ? "SessionDeleted" : "SessionUpdated";
                    pendingNotifications.Add(async () => await NotifySessionChange(session, moderatorId, eventName));
                    break;

                case MessageCondition condition:
                    // MessageCondition doesn't have direct ModeratorId, get it from Template or Queue
                    if (condition.TemplateId.HasValue)
                    {
                        var template = await eventData.Context.Set<MessageTemplate>()
                            .AsNoTracking()
                            .FirstOrDefaultAsync(t => t.Id == condition.TemplateId.Value, cancellationToken);
                        moderatorId = template?.ModeratorId;
                    }
                    else
                    {
                        var queue = await eventData.Context.Set<Queue>()
                            .AsNoTracking()
                            .FirstOrDefaultAsync(q => q.Id == condition.QueueId, cancellationToken);
                        moderatorId = queue?.ModeratorId;
                    }
                    eventName = state == EntityState.Deleted ? "ConditionDeleted" : "ConditionUpdated";
                    pendingNotifications.Add(async () => await NotifyConditionChange(condition, moderatorId, eventName));
                    break;

                default:
                    // Entity type not tracked for SignalR notifications
                    continue;
            }
        }

        // Continue with normal save operation
        var saveResult = await base.SavingChangesAsync(eventData, result, cancellationToken);

        // After successful save, send all pending notifications
        // This ensures we only notify for successfully persisted changes
        foreach (var notification in pendingNotifications)
        {
            try
            {
                await notification();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error sending SignalR notification after entity change");
                // Don't throw - notification failures shouldn't prevent save operation
            }
        }

        return saveResult;
    }

    #region Notification Methods

    private async Task NotifyQueueChange(Queue queue, int? moderatorId, string eventName)
    {
        if (!moderatorId.HasValue) return;

        try
        {
            var payload = new
            {
                id = queue.Id,
                moderatorId = queue.ModeratorId,
                doctorName = queue.DoctorName,
                currentPosition = queue.CurrentPosition,
                estimatedWaitMinutes = queue.EstimatedWaitMinutes,
                updatedAt = queue.UpdatedAt
            };

            // Send to moderator's group
            await _hubContext.Clients.Group($"moderator-{moderatorId.Value}")
                .SendAsync(eventName, payload);

            // Send to admin group
            await _hubContext.Clients.Group("admin-all")
                .SendAsync(eventName, payload);

            _logger.LogDebug("Sent {EventName} notification for Queue {QueueId} to moderator-{ModeratorId}",
                eventName, queue.Id, moderatorId.Value);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error notifying queue change for Queue {QueueId}", queue.Id);
        }
    }

    private async Task NotifyTemplateChange(MessageTemplate template, int? moderatorId, string eventName)
    {
        if (!moderatorId.HasValue) return;

        try
        {
            var payload = new
            {
                id = template.Id,
                moderatorId = template.ModeratorId,
                title = template.Title,
                content = template.Content,
                updatedAt = template.UpdatedAt
            };

            await _hubContext.Clients.Group($"moderator-{moderatorId.Value}")
                .SendAsync(eventName, payload);

            await _hubContext.Clients.Group("admin-all")
                .SendAsync(eventName, payload);

            _logger.LogDebug("Sent {EventName} notification for Template {TemplateId} to moderator-{ModeratorId}",
                eventName, template.Id, moderatorId.Value);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error notifying template change for Template {TemplateId}", template.Id);
        }
    }

    private async Task NotifyPatientChange(Patient patient, int? moderatorId, string eventName)
    {
        if (!moderatorId.HasValue) return;

        try
        {
            var payload = new
            {
                id = patient.Id,
                queueId = patient.QueueId,
                fullName = patient.FullName,
                phoneNumber = patient.PhoneNumber,
                countryCode = patient.CountryCode,
                position = patient.Position,
                updatedAt = patient.UpdatedAt
            };

            await _hubContext.Clients.Group($"moderator-{moderatorId.Value}")
                .SendAsync(eventName, payload);

            await _hubContext.Clients.Group("admin-all")
                .SendAsync(eventName, payload);

            _logger.LogDebug("Sent {EventName} notification for Patient {PatientId} to moderator-{ModeratorId}",
                eventName, patient.Id, moderatorId.Value);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error notifying patient change for Patient {PatientId}", patient.Id);
        }
    }

    private async Task NotifyMessageChange(Message message, int? moderatorId, string eventName)
    {
        if (!moderatorId.HasValue) return;

        try
        {
            var payload = new
            {
                id = message.Id,
                moderatorId = message.ModeratorId,
                patientId = message.PatientId,
                queueId = message.QueueId,
                status = message.Status,
                errorMessage = message.ErrorMessage,
                content = message.Content,
                sentAt = message.SentAt,
                updatedAt = message.UpdatedAt
            };

            await _hubContext.Clients.Group($"moderator-{moderatorId.Value}")
                .SendAsync(eventName, payload);

            await _hubContext.Clients.Group("admin-all")
                .SendAsync(eventName, payload);

            _logger.LogDebug("Sent {EventName} notification for Message {MessageId} to moderator-{ModeratorId}",
                eventName, message.Id, moderatorId.Value);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error notifying message change for Message {MessageId}", message.Id);
        }
    }

    private async Task NotifySessionChange(MessageSession session, int? moderatorId, string eventName)
    {
        if (!moderatorId.HasValue) return;

        try
        {
            var payload = new
            {
                id = session.Id,
                moderatorId = session.ModeratorId,
                queueId = session.QueueId,
                status = session.Status,
                startTime = session.StartTime,
                endTime = session.EndTime,
                isPaused = session.IsPaused
            };

            await _hubContext.Clients.Group($"moderator-{moderatorId.Value}")
                .SendAsync(eventName, payload);

            await _hubContext.Clients.Group("admin-all")
                .SendAsync(eventName, payload);

            _logger.LogDebug("Sent {EventName} notification for Session {SessionId} to moderator-{ModeratorId}",
                eventName, session.Id, moderatorId.Value);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error notifying session change for Session {SessionId}", session.Id);
        }
    }

    private async Task NotifyConditionChange(MessageCondition condition, int? moderatorId, string eventName)
    {
        if (!moderatorId.HasValue) return;

        try
        {
            var payload = new
            {
                id = condition.Id,
                templateId = condition.TemplateId,
                queueId = condition.QueueId,
                operator_ = condition.Operator,
                value = condition.Value,
                minValue = condition.MinValue,
                maxValue = condition.MaxValue,
                updatedAt = condition.UpdatedAt
            };

            await _hubContext.Clients.Group($"moderator-{moderatorId.Value}")
                .SendAsync(eventName, payload);

            await _hubContext.Clients.Group("admin-all")
                .SendAsync(eventName, payload);

            _logger.LogDebug("Sent {EventName} notification for Condition {ConditionId} to moderator-{ModeratorId}",
                eventName, condition.Id, moderatorId.Value);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error notifying condition change for Condition {ConditionId}", condition.Id);
        }
    }

    #endregion
}
