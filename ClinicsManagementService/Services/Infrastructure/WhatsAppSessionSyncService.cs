using ClinicsManagementService.Services.Interfaces;
using Clinics.Domain;
using Clinics.Infrastructure;
using ClinicsManagementService.Configuration;
using Microsoft.EntityFrameworkCore;

namespace ClinicsManagementService.Services.Infrastructure
{
    /// <summary>
    /// Service to synchronize WhatsApp session status between filesystem and database
    /// </summary>
    public class WhatsAppSessionSyncService : IWhatsAppSessionSyncService
    {
        private readonly ApplicationDbContext _dbContext;
        private readonly INotifier _notifier;
        private readonly ISignalRNotificationService _signalRNotificationService;

        public WhatsAppSessionSyncService(ApplicationDbContext dbContext, INotifier notifier, ISignalRNotificationService signalRNotificationService)
        {
            _dbContext = dbContext;
            _notifier = notifier;
            _signalRNotificationService = signalRNotificationService;
        }

        /// <summary>
        /// Update WhatsApp session status in database
        /// </summary>
        /// <param name="moderatorUserId">Moderator user ID</param>
        /// <param name="status">Status: 'connected', 'disconnected', 'pending'</param>
        /// <param name="lastSyncAt">Optional last sync timestamp</param>
        /// <param name="providerSessionId">Optional provider session identifier</param>
        /// <param name="activityUserId">Optional user ID performing this operation for audit trail</param>
        public async Task UpdateSessionStatusAsync(int moderatorUserId, string status, DateTime? lastSyncAt = null, string? providerSessionId = null, int? activityUserId = null)
        {
            try
            {
                _notifier.Notify($"💾 [DB SYNC] UpdateSessionStatusAsync called - ModeratorUserId: {moderatorUserId}, Status: {status}, LastSyncAt: {lastSyncAt?.ToString() ?? "null"}");

                // Validate status values
                var validStatuses = new[] { "connected", "disconnected", "pending" };
                if (!validStatuses.Contains(status.ToLowerInvariant()))
                {
                    _notifier.Notify($"⚠️ [DB SYNC] Invalid session status: {status}. Using 'disconnected' as fallback.");
                    status = "disconnected";
                }

                _notifier.Notify($"🔍 [DB SYNC] Querying database for existing session with ModeratorUserId={moderatorUserId}...");
                var session = await _dbContext.WhatsAppSessions
                    .FirstOrDefaultAsync(s => s.ModeratorUserId == moderatorUserId);

                if (session == null)
                {
                    // Create new session record
                    _notifier.Notify($"➕ [DB SYNC] No existing session found - Creating new record...");
                    session = new WhatsAppSession
                    {
                        ModeratorUserId = moderatorUserId,
                        Status = status,
                        // LastSyncAt, SessionName, ProviderSessionId REMOVED - deprecated columns
                        CreatedAt = DateTime.UtcNow,
                        CreatedByUserId = activityUserId,
                        LastActivityUserId = activityUserId,
                        LastActivityAt = DateTime.UtcNow
                    };
                    _dbContext.WhatsAppSessions.Add(session);
                    _notifier.Notify($"✅ [DB SYNC] New session entity created - ModeratorUserId: {moderatorUserId}, Status: {status}");
                }
                else
                {
                    // Update existing session
                    _notifier.Notify($"🔄 [DB SYNC] Existing session found - SessionId: {session.Id}, OldStatus: {session.Status}");
                    session.Status = status;
                    // LastSyncAt, ProviderSessionId removal - deprecated columns
                    if (activityUserId.HasValue)
                    {
                        session.LastActivityUserId = activityUserId;
                        session.LastActivityAt = DateTime.UtcNow;
                    }
                    _notifier.Notify($"✅ [DB SYNC] Session entity updated - ModeratorUserId: {moderatorUserId}, NewStatus: {status}, LastActivityUserId: {session.LastActivityUserId}");
                }

                _notifier.Notify($"💾 [DB SYNC] Calling SaveChangesAsync...");
                var changeCount = await _dbContext.SaveChangesAsync();
                _notifier.Notify($"✅ [DB SYNC] SaveChangesAsync completed - Changes saved: {changeCount}");

                // Notify frontend via SignalR - include current pause state so frontend knows to enable/disable resume button
                // IMPORTANT: When status becomes "connected" after PendingQR, we keep isPaused=true but frontend enables resume button
                await _signalRNotificationService.NotifyWhatsAppSessionUpdateAsync(
                    moderatorUserId,
                    status,
                    session.IsPaused,  // Include current pause state
                    session.PauseReason  // Include current pause reason
                );
                _notifier.Notify($"📢 [DB SYNC] SignalR notification sent - Status: {status}, IsPaused: {session.IsPaused}, PauseReason: {session.PauseReason}");
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ [DB SYNC] Error updating WhatsApp session status: {ex.Message}");
                _notifier.Notify($"❌ [DB SYNC] Stack trace: {ex.StackTrace}");
                _notifier.Notify($"❌ [DB SYNC] Inner exception: {ex.InnerException?.Message}");
                // Don't throw - session sync is non-critical
            }
        }

        /// <summary>
        /// Get WhatsApp session status from database
        /// </summary>
        /// <param name="moderatorUserId">Moderator user ID</param>
        /// <returns>WhatsApp session or null if not found</returns>
        public async Task<WhatsAppSession?> GetSessionStatusAsync(int moderatorUserId)
        {
            try
            {
                return await _dbContext.WhatsAppSessions
                    .FirstOrDefaultAsync(s => s.ModeratorUserId == moderatorUserId);
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Error retrieving WhatsApp session status: {ex.Message}");
                return null;
            }
        }

        /// <summary>
        /// Check if session is paused due to PendingQR (authentication required)
        /// Checks both WhatsAppSession status and paused messages/sessions
        /// </summary>
        /// <param name="moderatorUserId">Moderator user ID</param>
        /// <returns>True if session is paused due to PendingQR</returns>
        public async Task<bool> CheckIfSessionPausedDueToPendingQRAsync(int moderatorUserId)
        {
            try
            {
                // Check WhatsAppSession status
                var whatsappSession = await _dbContext.WhatsAppSessions
                    .FirstOrDefaultAsync(s => s.ModeratorUserId == moderatorUserId && !s.IsDeleted);

                if (whatsappSession != null && whatsappSession.Status == "pending")
                {
                    return true; // Session requires authentication
                }

                // Check if there are paused messages with PendingQR reason
                var hasPausedMessages = await _dbContext.Messages
                    .AnyAsync(m => m.ModeratorId == moderatorUserId
                        && m.IsPaused
                        && m.PauseReason == "PendingQR"
                        && (m.Status == "queued" || m.Status == "sending")
                        && !m.IsDeleted);

                if (hasPausedMessages)
                {
                    return true; // Messages are paused due to PendingQR
                }

                // Check if there are paused MessageSessions with PendingQR reason
                var hasPausedSessions = await _dbContext.MessageSessions
                    .AnyAsync(s => s.ModeratorId == moderatorUserId
                        && s.IsPaused
                        && s.PauseReason == "PendingQR"
                        && s.Status == "paused");

                return hasPausedSessions; // Return true if any session is paused due to PendingQR
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Error checking PendingQR pause state: {ex.Message}");
                // On error, assume not paused to allow operations (fail-safe)
                return false;
            }
        }

        /// <summary>
        /// Pause WhatsAppSession globally for the specified moderator due to PendingQR
        /// This sets IsPaused=true on the WhatsAppSession entity with PauseReason="PendingQR"
        /// </summary>
        /// <param name="moderatorUserId">Moderator user ID</param>
        /// <param name="pausedBy">Optional user ID who triggered the pause</param>
        /// <returns>True if session was paused successfully</returns>
        public async Task<bool> PauseSessionDueToPendingQRAsync(int moderatorUserId, int? pausedBy = null, string pauseReason = "PendingQR")
        {
            try
            {
                _notifier.Notify($"⏸️ [DB SYNC] PauseSessionDueToPendingQRAsync called - ModeratorUserId: {moderatorUserId}, Reason: {pauseReason}");

                // Get or create WhatsAppSession
                var whatsappSession = await _dbContext.WhatsAppSessions
                    .FirstOrDefaultAsync(s => s.ModeratorUserId == moderatorUserId && !s.IsDeleted);

                if (whatsappSession == null)
                {
                    // Create new WhatsAppSession if doesn't exist
                    _notifier.Notify($"➕ [DB SYNC] Creating new WhatsAppSession for moderator {moderatorUserId}");
                    whatsappSession = new WhatsAppSession
                    {
                        ModeratorUserId = moderatorUserId,
                        // Only set status to "pending" for actual PendingQR/PendingNET, otherwise "connected" by default
                        Status = (pauseReason == "PendingQR" || pauseReason == "PendingNET") ? "pending" : "connected",
                        CreatedAt = DateTime.UtcNow,
                        CreatedByUserId = pausedBy,
                        IsPaused = true,
                        PausedAt = DateTime.UtcNow,
                        PausedBy = pausedBy,
                        PauseReason = pauseReason
                        // SessionName REMOVED - deprecated column
                    };
                    _dbContext.WhatsAppSessions.Add(whatsappSession);
                }
                else
                {
                    // Update existing session with global pause
                    _notifier.Notify($"🔄 [DB SYNC] Updating existing WhatsAppSession {whatsappSession.Id} to paused state");
                    whatsappSession.IsPaused = true;
                    whatsappSession.PausedAt = DateTime.UtcNow;
                    whatsappSession.PausedBy = pausedBy;
                    whatsappSession.PauseReason = pauseReason;
                    // Only set status to "pending" for actual PendingQR/PendingNET, not for BrowserClosure
                    if (pauseReason == "PendingQR" || pauseReason == "PendingNET")
                    {
                        whatsappSession.Status = "pending";
                    }
                    whatsappSession.UpdatedAt = DateTime.UtcNow;
                    whatsappSession.UpdatedBy = pausedBy;
                }

                var changeCount = await _dbContext.SaveChangesAsync();
                _notifier.Notify($"✅ [DB SYNC] WhatsAppSession paused globally - ModeratorUserId: {moderatorUserId}, Changes: {changeCount}");

                // Notify frontend via SignalR with appropriate status
                var notifyStatus = (pauseReason == "PendingQR" || pauseReason == "PendingNET") ? "pending" : whatsappSession.Status;
                await _signalRNotificationService.NotifyWhatsAppSessionUpdateAsync(moderatorUserId, notifyStatus, true, pauseReason);

                return true;
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ [DB SYNC] Error pausing WhatsAppSession: {ex.Message}");
                _notifier.Notify($"❌ [DB SYNC] Stack trace: {ex.StackTrace}");
                return false;
            }
        }
    }
}
