using ClinicsManagementService.Services.Interfaces;
using Clinics.Domain;
using Clinics.Infrastructure;
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
        public async Task UpdateSessionStatusAsync(int moderatorUserId, string status, DateTime? lastSyncAt = null)
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
                        SessionName = $"WhatsApp-Moderator-{moderatorUserId}"
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
                    _notifier.Notify($"✅ [DB SYNC] Session entity updated - ModeratorUserId: {moderatorUserId}, NewStatus: {status}, LastSyncAt: {session.LastSyncAt}");
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
    }
}
