using Clinics.Infrastructure;
using Clinics.Domain;
using Microsoft.EntityFrameworkCore;
using ClinicsManagementService.Services.Interfaces;

namespace ClinicsManagementService.Services.Infrastructure;

/// <summary>
/// Coordinates long-running operations to prevent conflicts with authentication checks
/// and other critical operations. Uses 3-tier pause hierarchy:
/// 1. WhatsAppSession.IsPaused (Global moderator pause) - Highest priority
/// 2. MessageSession.IsPaused (Session-level pause) - Medium priority  
/// 3. Message.IsPaused (Message-level pause) - Lowest priority
/// </summary>
public class OperationCoordinatorService
{
    private readonly ApplicationDbContext _db;
    private readonly ILogger<OperationCoordinatorService> _logger;
    private readonly ISignalRNotificationService _signalRNotificationService;
    private static readonly Dictionary<int, SemaphoreSlim> _operationLocks = new();
    private static readonly object _lockCreationLock = new();

    public OperationCoordinatorService(
        ApplicationDbContext db,
        ILogger<OperationCoordinatorService> logger,
        ISignalRNotificationService signalRNotificationService)
    {
        _db = db;
        _logger = logger;
        _signalRNotificationService = signalRNotificationService;
    }

    /// <summary>
    /// Gets or creates a semaphore for a specific moderator to coordinate operations.
    /// </summary>
    private SemaphoreSlim GetOrCreateSemaphore(int moderatorId)
    {
        lock (_lockCreationLock)
        {
            if (!_operationLocks.ContainsKey(moderatorId))
            {
                _operationLocks[moderatorId] = new SemaphoreSlim(1, 1);
            }
            return _operationLocks[moderatorId];
        }
    }

    /// <summary>
    /// Waits for any currently running operation for the specified moderator to complete.
    /// Times out after 30 seconds.
    /// </summary>
    public async Task<bool> WaitForCurrentOperationToFinishAsync(
        int moderatorId, 
        CancellationToken cancellationToken = default)
    {
        var semaphore = GetOrCreateSemaphore(moderatorId);
        var maxWaitTime = TimeSpan.FromSeconds(30);
        
        try
        {
            _logger.LogInformation("Waiting for current operation to finish for moderator {ModeratorId}", moderatorId);
            
            // Try to acquire the semaphore with timeout
            var acquired = await semaphore.WaitAsync(maxWaitTime, cancellationToken);
            
            if (acquired)
            {
                // Release immediately - we just wanted to wait for any ongoing operation
                semaphore.Release();
                _logger.LogInformation("No ongoing operation for moderator {ModeratorId}, proceeding", moderatorId);
                return true;
            }
            else
            {
                _logger.LogWarning("Timeout waiting for operation to finish for moderator {ModeratorId}", moderatorId);
                return false;
            }
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("Wait operation cancelled for moderator {ModeratorId}", moderatorId);
            return false;
        }
    }

    /// <summary>
    /// Pauses all ongoing tasks for the specified moderator using global pause (WhatsAppSession.IsPaused).
    /// This is the TOP level of the 3-tier hierarchy - no need to iterate through messages.
    /// The QueuedMessageProcessor checks WhatsAppSession.IsPaused first before processing any message.
    /// </summary>
    public async Task<bool> PauseAllOngoingTasksAsync(
        int moderatorId, 
        int? pausedBy = null, 
        string pauseReason = "Authentication check",
        CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Setting global pause for moderator {ModeratorId}. Reason: {Reason}", 
                moderatorId, pauseReason);

            // Get or create WhatsAppSession
            var whatsappSession = await _db.WhatsAppSessions
                .FirstOrDefaultAsync(ws => ws.ModeratorUserId == moderatorId && !ws.IsDeleted, cancellationToken);

            if (whatsappSession == null)
            {
                // Create new WhatsAppSession if doesn't exist
                whatsappSession = new WhatsAppSession
                {
                    ModeratorUserId = moderatorId,
                    Status = "connected",
                    CreatedAt = DateTime.UtcNow,
                    CreatedByUserId = pausedBy,
                    IsPaused = false
                };
                _db.WhatsAppSessions.Add(whatsappSession);
            }

            // Set global pause - this will affect ALL messages/sessions for this moderator
            whatsappSession.IsPaused = true;
            whatsappSession.PausedAt = DateTime.UtcNow;
            whatsappSession.PausedBy = pausedBy;
            whatsappSession.PauseReason = pauseReason;
            whatsappSession.UpdatedAt = DateTime.UtcNow;
            whatsappSession.UpdatedBy = pausedBy;

            await _db.SaveChangesAsync(cancellationToken);
            
            // Notify frontend of WhatsAppSession update
            await _signalRNotificationService.NotifyWhatsAppSessionUpdateAsync(moderatorId);
            
            _logger.LogInformation("Global pause set for moderator {ModeratorId}. All tasks will be paused by QueuedMessageProcessor.", 
                moderatorId);

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error setting global pause for moderator {ModeratorId}", moderatorId);
            throw;
        }
    }

    /// <summary>
    /// Resumes all tasks for the specified moderator by clearing global pause (WhatsAppSession.IsPaused).
    /// Only resumes if the current pause reason matches the specified reason.
    /// </summary>
    public async Task<bool> ResumeTasksPausedForReasonAsync(
        int moderatorId, 
        string pauseReason,
        CancellationToken cancellationToken = default)
    {
        try
        {
            _logger.LogInformation("Attempting to clear global pause for moderator {ModeratorId} if reason is '{Reason}'", 
                moderatorId, pauseReason);

            var whatsappSession = await _db.WhatsAppSessions
                .FirstOrDefaultAsync(ws => ws.ModeratorUserId == moderatorId && !ws.IsDeleted, cancellationToken);

            if (whatsappSession == null || !whatsappSession.IsPaused)
            {
                _logger.LogInformation("No paused WhatsAppSession found for moderator {ModeratorId}", moderatorId);
                return false;
            }

            // Only resume if the pause reason matches (don't override other pause reasons)
            if (whatsappSession.PauseReason != pauseReason)
            {
                _logger.LogWarning("Cannot resume moderator {ModeratorId}: Current pause reason is '{CurrentReason}', expected '{ExpectedReason}'", 
                    moderatorId, whatsappSession.PauseReason, pauseReason);
                return false;
            }

            // Clear global pause
            whatsappSession.IsPaused = false;
            whatsappSession.PausedAt = null;
            whatsappSession.PausedBy = null;
            whatsappSession.PauseReason = null;
            whatsappSession.UpdatedAt = DateTime.UtcNow;

            await _db.SaveChangesAsync(cancellationToken);
            
            // Notify frontend via SignalR
            await _signalRNotificationService.NotifyWhatsAppSessionUpdateAsync(moderatorId, whatsappSession.Status, false, null);
            
            _logger.LogInformation("Global pause cleared for moderator {ModeratorId}. Tasks can now resume.", 
                moderatorId);

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error clearing global pause for moderator {ModeratorId}", moderatorId);
            throw;
        }
    }

    /// <summary>
    /// Checks if there are any ongoing operations (messages with status="sending") for the moderator.
    /// </summary>
    public async Task<bool> HasOngoingOperationsAsync(
        int moderatorId,
        CancellationToken cancellationToken = default)
    {
        var count = await _db.Messages
            .Where(m => m.ModeratorId == moderatorId 
                && m.Status == "sending"
                && !m.IsDeleted)
            .CountAsync(cancellationToken);

        return count > 0;
    }
}
