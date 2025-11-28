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

        public WhatsAppSessionSyncService(ApplicationDbContext dbContext, INotifier notifier)
        {
            _dbContext = dbContext;
            _notifier = notifier;
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
                        LastSyncAt = lastSyncAt ?? DateTime.UtcNow,
                        CreatedAt = DateTime.UtcNow,
                        SessionName = WhatsAppConfiguration.GetSessionDirectory(moderatorUserId),
                        ProviderSessionId = providerSessionId,
                        CreatedByUserId = activityUserId,
                        LastActivityUserId = activityUserId,
                        LastActivityAt = DateTime.UtcNow
                    };
                    _dbContext.WhatsAppSessions.Add(session);
                    _notifier.Notify($"✅ [DB SYNC] New session entity created - ModeratorUserId: {moderatorUserId}, Status: {status}, SessionName: {session.SessionName}");
                }
                else
                {
                    // Update existing session
                    _notifier.Notify($"🔄 [DB SYNC] Existing session found - SessionId: {session.Id}, OldStatus: {session.Status}");
                    session.Status = status;
                    if (lastSyncAt.HasValue)
                    {
                        session.LastSyncAt = lastSyncAt.Value;
                    }
                    else if (status == "connected")
                    {
                        session.LastSyncAt = DateTime.UtcNow;
                    }
                    if (!string.IsNullOrWhiteSpace(providerSessionId))
                    {
                        session.ProviderSessionId = providerSessionId;
                    }
                    if (activityUserId.HasValue)
                    {
                        session.LastActivityUserId = activityUserId;
                        session.LastActivityAt = DateTime.UtcNow;
                    }
                    _notifier.Notify($"✅ [DB SYNC] Session entity updated - ModeratorUserId: {moderatorUserId}, NewStatus: {status}, LastSyncAt: {session.LastSyncAt}, LastActivityUserId: {session.LastActivityUserId}");
                }

                _notifier.Notify($"💾 [DB SYNC] Calling SaveChangesAsync...");
                var changeCount = await _dbContext.SaveChangesAsync();
                _notifier.Notify($"✅ [DB SYNC] SaveChangesAsync completed - Changes saved: {changeCount}");
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
    }
}
