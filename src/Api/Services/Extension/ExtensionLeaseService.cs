using Clinics.Domain;
using Clinics.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.SignalR;
using Clinics.Api.Hubs;

namespace Clinics.Api.Services.Extension
{
    /// <summary>
    /// Service for managing extension session leases.
    /// Ensures only one active extension session per moderator.
    /// </summary>
    public class ExtensionLeaseService : IExtensionLeaseService
    {
        private readonly ApplicationDbContext _db;
        private readonly ILogger<ExtensionLeaseService> _logger;
        private readonly IHubContext<DataUpdateHub> _hubContext;
        private readonly TimeSpan _leaseTtl = TimeSpan.FromMinutes(3);
        private readonly TimeSpan _heartbeatExtension = TimeSpan.FromMinutes(2);

        public ExtensionLeaseService(
            ApplicationDbContext db, 
            ILogger<ExtensionLeaseService> logger,
            IHubContext<DataUpdateHub> hubContext)
        {
            _db = db;
            _logger = logger;
            _hubContext = hubContext;
        }

        public async Task<(ExtensionSessionLease? lease, string? leaseToken, string? error)> AcquireLeaseAsync(
            int moderatorUserId, 
            Guid deviceId,
            bool forceTakeover = false)
        {
            // Verify device exists and is valid
            var device = await _db.ExtensionDevices.FindAsync(deviceId);
            if (device == null || device.ModeratorUserId != moderatorUserId || !device.IsActive)
            {
                return (null, null, "الجهاز غير صالح أو غير مقترن");
            }

            // First, clean up any expired leases (RevokedAtUtc IS NULL but expired)
            // These would violate the unique constraint if not handled
            var expiredLeases = await _db.ExtensionSessionLeases
                .Where(l => l.ModeratorUserId == moderatorUserId && 
                            l.RevokedAtUtc == null && 
                            l.ExpiresAtUtc <= DateTime.UtcNow)
                .ToListAsync();

            foreach (var expired in expiredLeases)
            {
                expired.RevokedAtUtc = DateTime.UtcNow;
                expired.RevokedReason = "Expired";
                _logger.LogInformation("Marking expired lease {LeaseId} as revoked", expired.Id);
            }

            if (expiredLeases.Any())
            {
                await _db.SaveChangesAsync();
            }

            // Check for existing active lease (not expired, not revoked)
            var existingLease = await _db.ExtensionSessionLeases
                .FirstOrDefaultAsync(l => l.ModeratorUserId == moderatorUserId && 
                                          l.RevokedAtUtc == null && 
                                          l.ExpiresAtUtc > DateTime.UtcNow);

            if (existingLease != null)
            {
                if (existingLease.DeviceId == deviceId)
                {
                    // Same device - refresh the lease
                    var refreshToken = GenerateLeaseToken();
                    existingLease.LeaseTokenHash = ExtensionPairingService.HashToken(refreshToken);
                    existingLease.ExpiresAtUtc = DateTime.UtcNow.Add(_leaseTtl);
                    existingLease.LastHeartbeatAtUtc = DateTime.UtcNow;
                    
                    await _db.SaveChangesAsync();
                    
                    _logger.LogInformation("Lease refreshed for moderator {ModeratorId}, device {DeviceId}", 
                        moderatorUserId, deviceId);
                    
                    return (existingLease, refreshToken, null);
                }
                
                if (!forceTakeover)
                {
                    // Different device has lease
                    return (null, null, "جهاز آخر لديه جلسة نشطة. استخدم خيار الاستحواذ لتولي الجلسة.");
                }

                // Takeover: revoke existing lease
                existingLease.RevokedAtUtc = DateTime.UtcNow;
                existingLease.RevokedReason = "Takeover";
                
                _logger.LogInformation("Lease takeover: revoking lease for device {OldDevice} by {NewDevice}", 
                    existingLease.DeviceId, deviceId);
                
                // Save revocation first to clear the unique constraint before inserting new lease
                await _db.SaveChangesAsync();
            }

            // Create new lease
            var leaseToken = GenerateLeaseToken();
            var newLease = new ExtensionSessionLease
            {
                Id = Guid.NewGuid(),
                ModeratorUserId = moderatorUserId,
                DeviceId = deviceId,
                LeaseTokenHash = ExtensionPairingService.HashToken(leaseToken),
                AcquiredAtUtc = DateTime.UtcNow,
                ExpiresAtUtc = DateTime.UtcNow.Add(_leaseTtl),
                LastHeartbeatAtUtc = DateTime.UtcNow
            };

            _db.ExtensionSessionLeases.Add(newLease);
            
            // Update device last seen
            device.LastSeenAtUtc = DateTime.UtcNow;
            
            await _db.SaveChangesAsync();

            // Broadcast lease acquired via SignalR
            newLease.Device = device; // Set for broadcast
            await BroadcastExtensionStatusAsync(moderatorUserId, newLease);

            _logger.LogInformation("Lease acquired for moderator {ModeratorId}, device {DeviceId}", 
                moderatorUserId, deviceId);

            return (newLease, leaseToken, null);
        }

        public async Task<(bool success, string? error)> HeartbeatAsync(
            Guid leaseId, 
            string leaseToken,
            string? currentUrl = null,
            string? whatsAppStatus = null,
            string? lastError = null)
        {
            var lease = await _db.ExtensionSessionLeases
                .Include(l => l.Device)
                .FirstOrDefaultAsync(l => l.Id == leaseId);

            if (lease == null)
            {
                return (false, "Lease not found");
            }

            if (lease.RevokedAtUtc != null)
            {
                return (false, "Lease has been revoked");
            }

            // Validate lease token
            var tokenHash = ExtensionPairingService.HashToken(leaseToken);
            if (lease.LeaseTokenHash != tokenHash)
            {
                return (false, "Invalid lease token");
            }

            // Check if lease expired (allow grace period for heartbeat)
            if (lease.ExpiresAtUtc < DateTime.UtcNow.AddSeconds(-30))
            {
                lease.RevokedAtUtc = DateTime.UtcNow;
                lease.RevokedReason = "Expired";
                await _db.SaveChangesAsync();
                return (false, "Lease expired");
            }

            // Update lease
            lease.LastHeartbeatAtUtc = DateTime.UtcNow;
            lease.ExpiresAtUtc = DateTime.UtcNow.Add(_heartbeatExtension);
            lease.CurrentUrl = currentUrl ?? lease.CurrentUrl;
            lease.WhatsAppStatus = whatsAppStatus ?? lease.WhatsAppStatus;
            lease.LastError = lastError;

            // Update device last seen
            if (lease.Device != null)
            {
                lease.Device.LastSeenAtUtc = DateTime.UtcNow;
            }

            // Sync WhatsApp status to WhatsAppSessions table for frontend compatibility
            if (!string.IsNullOrEmpty(whatsAppStatus))
            {
                _logger.LogInformation("Syncing WhatsApp status '{Status}' to WhatsAppSessions for moderator {ModeratorId}", 
                    whatsAppStatus, lease.ModeratorUserId);
                await SyncWhatsAppSessionStatusAsync(lease.ModeratorUserId, whatsAppStatus);
            }
            else
            {
                // Still save lease heartbeat changes even if no status sync
                await _db.SaveChangesAsync();
            }

            // Broadcast status update via SignalR
            await BroadcastExtensionStatusAsync(lease.ModeratorUserId, lease);

            _logger.LogDebug("Heartbeat processed for lease {LeaseId}, moderator {ModeratorId}, status {Status}", 
                leaseId, lease.ModeratorUserId, whatsAppStatus ?? "null");

            return (true, null);
        }

        public async Task<bool> ReleaseLeaseAsync(Guid leaseId, string leaseToken, string reason = "Released")
        {
            var lease = await _db.ExtensionSessionLeases.FindAsync(leaseId);
            if (lease == null) return false;

            // Validate lease token
            var tokenHash = ExtensionPairingService.HashToken(leaseToken);
            if (lease.LeaseTokenHash != tokenHash)
            {
                _logger.LogWarning("Attempted to release lease {LeaseId} with invalid token", leaseId);
                return false;
            }

            var moderatorId = lease.ModeratorUserId;
            
            lease.RevokedAtUtc = DateTime.UtcNow;
            lease.RevokedReason = reason;
            await _db.SaveChangesAsync();

            // Sync WhatsApp session status to disconnected when extension disconnects
            await SyncWhatsAppSessionStatusAsync(moderatorId, "disconnected");

            // Broadcast disconnection via SignalR
            await BroadcastExtensionDisconnectedAsync(moderatorId);

            _logger.LogInformation("Lease {LeaseId} released for moderator {ModeratorId}: {Reason}", 
                leaseId, moderatorId, reason);

            return true;
        }

        public async Task<ExtensionSessionLease?> GetActiveLeaseAsync(int moderatorUserId)
        {
            return await _db.ExtensionSessionLeases
                .Include(l => l.Device)
                .FirstOrDefaultAsync(l => l.ModeratorUserId == moderatorUserId && 
                                          l.RevokedAtUtc == null && 
                                          l.ExpiresAtUtc > DateTime.UtcNow);
        }

        public async Task<bool> ValidateLeaseAsync(Guid leaseId, string leaseToken)
        {
            var lease = await _db.ExtensionSessionLeases.FindAsync(leaseId);
            if (lease == null) return false;

            if (lease.RevokedAtUtc != null || lease.ExpiresAtUtc <= DateTime.UtcNow)
                return false;

            var tokenHash = ExtensionPairingService.HashToken(leaseToken);
            return lease.LeaseTokenHash == tokenHash;
        }

        public async Task<bool> ForceReleaseLeaseAsync(int moderatorUserId, string reason = "ForceReleased")
        {
            var lease = await _db.ExtensionSessionLeases
                .FirstOrDefaultAsync(l => l.ModeratorUserId == moderatorUserId && 
                                          l.RevokedAtUtc == null);

            if (lease == null) return true; // No active lease

            lease.RevokedAtUtc = DateTime.UtcNow;
            lease.RevokedReason = reason;
            await _db.SaveChangesAsync();

            // Sync WhatsApp session status to disconnected when extension disconnects
            await SyncWhatsAppSessionStatusAsync(moderatorUserId, "disconnected");

            // Broadcast disconnection via SignalR
            await BroadcastExtensionDisconnectedAsync(moderatorUserId);

            _logger.LogInformation("Force released lease {LeaseId} for moderator {ModeratorId}: {Reason}", 
                lease.Id, moderatorUserId, reason);

            return true;
        }

        public async Task<int> ExpireStaleLeases()
        {
            var now = DateTime.UtcNow;
            var staleLeases = await _db.ExtensionSessionLeases
                .Where(l => l.RevokedAtUtc == null && l.ExpiresAtUtc < now)
                .ToListAsync();

            foreach (var lease in staleLeases)
            {
                lease.RevokedAtUtc = now;
                lease.RevokedReason = "Expired";
            }

            if (staleLeases.Any())
            {
                await _db.SaveChangesAsync();
                _logger.LogInformation("Expired {Count} stale leases", staleLeases.Count);
                
                // Sync WhatsApp session status to disconnected for each expired lease
                foreach (var lease in staleLeases)
                {
                    await SyncWhatsAppSessionStatusAsync(lease.ModeratorUserId, "disconnected");
                    await BroadcastExtensionDisconnectedAsync(lease.ModeratorUserId);
                }
            }

            return staleLeases.Count;
        }

        #region Helper Methods

        private static string GenerateLeaseToken()
        {
            using var rng = System.Security.Cryptography.RandomNumberGenerator.Create();
            var bytes = new byte[32];
            rng.GetBytes(bytes);
            return Convert.ToBase64String(bytes);
        }

        /// <summary>
        /// Sync extension WhatsApp status to WhatsAppSessions table for frontend compatibility.
        /// Maps extension status to database status: "connected" -> "connected", "qr_pending"/"disconnected" -> "pending"
        /// </summary>
        private async Task SyncWhatsAppSessionStatusAsync(int moderatorUserId, string extensionStatus)
        {
            try
            {
                // Map extension status to DB status
                // Extension sends: connected, qr_pending, disconnected, unknown, loading, phone_disconnected
                var dbStatus = extensionStatus?.ToLower() switch
                {
                    "connected" => "connected",
                    "qr_pending" => "pending",
                    "disconnected" => "disconnected",
                    "phone_disconnected" => "disconnected",
                    "loading" => "pending",
                    "unknown" => "pending",
                    _ => "pending"
                };

                var session = await _db.WhatsAppSessions
                    .FirstOrDefaultAsync(s => s.ModeratorUserId == moderatorUserId);

                if (session == null)
                {
                    // Create new session if it doesn't exist
                    session = new Clinics.Domain.WhatsAppSession
                    {
                        ModeratorUserId = moderatorUserId,
                        SessionName = $"extension-session-{moderatorUserId}",
                        Status = dbStatus,
                        LastSyncAt = DateTime.UtcNow,
                        CreatedAt = DateTime.UtcNow,
                        ProviderSessionId = "extension",
                        CreatedByUserId = moderatorUserId,
                        LastActivityUserId = moderatorUserId,
                        LastActivityAt = DateTime.UtcNow,
                        IsPaused = dbStatus != "connected",
                        PauseReason = dbStatus != "connected" ? "Extension not connected" : null
                    };
                    _db.WhatsAppSessions.Add(session);
                    _logger.LogInformation("Created WhatsAppSession for moderator {ModeratorId} with status {Status}", 
                        moderatorUserId, dbStatus);
                }
                else
                {
                    session.Status = dbStatus;
                    session.LastSyncAt = DateTime.UtcNow;
                    session.LastActivityAt = DateTime.UtcNow;
                    session.ProviderSessionId = "extension";
                    
                    // Clear pause state when connected
                    if (dbStatus == "connected")
                    {
                        session.IsPaused = false;
                        session.PauseReason = null;
                        _logger.LogInformation("WhatsApp session unpaused for moderator {ModeratorId} - extension connected", moderatorUserId);
                        
                        // CRITICAL: Also unpause any Messages that were paused due to PendingQR/PendingNET/BrowserClosure
                        var pausedMessages = await _db.Messages
                            .Where(m => m.ModeratorId == moderatorUserId 
                                && !m.IsDeleted
                                && m.IsPaused 
                                && (m.PauseReason == "PendingQR" || m.PauseReason == "PendingNET" || m.PauseReason == "BrowserClosure")
                                && (m.Status == "queued" || m.Status == "sending"))
                            .ToListAsync();
                        
                        if (pausedMessages.Any())
                        {
                            foreach (var message in pausedMessages)
                            {
                                message.IsPaused = false;
                                message.PauseReason = null;
                            }
                            _logger.LogInformation("Unpaused {Count} messages for moderator {ModeratorId} - extension connected", 
                                pausedMessages.Count, moderatorUserId);
                        }
                    }
                    else
                    {
                        // CRITICAL: Auto-pause when session status changes from "connected" to anything else
                        // This prevents sending when session is not ready (pending, disconnected, qr_pending)
                        if (!session.IsPaused)
                        {
                            session.IsPaused = true;
                            session.PauseReason = $"Extension status: {extensionStatus}";
                            session.PausedAt = DateTime.UtcNow;
                            _logger.LogWarning("Auto-paused WhatsApp session for moderator {ModeratorId} - status changed to {Status}", 
                                moderatorUserId, extensionStatus);
                        }
                        else
                        {
                            // Already paused - update reason to reflect current status
                            session.PauseReason = $"Extension status: {extensionStatus}";
                        }
                    }
                    
                    _logger.LogDebug("Updated WhatsAppSession for moderator {ModeratorId} with status {Status}", 
                        moderatorUserId, dbStatus);
                }
                
                // CRITICAL: Save changes to persist pause state
                await _db.SaveChangesAsync();
                
                // CRITICAL: Broadcast WhatsAppSessionUpdated event for real-time frontend updates
                // This triggers immediate refresh of pause state and resume button enablement
                await _hubContext.Clients.Group($"moderator-{moderatorUserId}")
                    .SendAsync("WhatsAppSessionUpdated", new
                    {
                        moderatorUserId,
                        status = dbStatus,
                        isPaused = session.IsPaused,
                        pauseReason = session.PauseReason,
                        isResumable = session.IsPaused && dbStatus == "connected" // Only resumable when paused AND connected
                    });
                
                _logger.LogInformation("Broadcasted WhatsAppSessionUpdated for moderator {ModeratorId}, status={Status}, isPaused={IsPaused}",
                    moderatorUserId, dbStatus, session.IsPaused);
            }
            catch (Exception ex)
            {
                // Non-critical - log but don't fail the heartbeat
                _logger.LogWarning(ex, "Failed to sync WhatsApp session status for moderator {ModeratorId}", moderatorUserId);
            }
        }

        /// <summary>
        /// Broadcast extension status update via SignalR
        /// </summary>
        private async Task BroadcastExtensionStatusAsync(int moderatorUserId, ExtensionSessionLease lease)
        {
            try
            {
                await _hubContext.Clients.Group($"moderator-{moderatorUserId}")
                    .SendAsync("ExtensionStatusUpdated", new
                    {
                        moderatorUserId,
                        hasActiveLease = true,
                        deviceId = lease.DeviceId,
                        deviceName = lease.Device?.DeviceName,
                        whatsAppStatus = lease.WhatsAppStatus,
                        lastHeartbeat = lease.LastHeartbeatAtUtc,
                        currentUrl = lease.CurrentUrl,
                        expiresAt = lease.ExpiresAtUtc
                    });
                
                _logger.LogDebug("Broadcast ExtensionStatusUpdated for moderator {ModeratorId}", moderatorUserId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to broadcast extension status for moderator {ModeratorId}", moderatorUserId);
            }
        }

        /// <summary>
        /// Broadcast extension disconnected status via SignalR
        /// </summary>
        private async Task BroadcastExtensionDisconnectedAsync(int moderatorUserId)
        {
            try
            {
                await _hubContext.Clients.Group($"moderator-{moderatorUserId}")
                    .SendAsync("ExtensionStatusUpdated", new
                    {
                        moderatorUserId,
                        hasActiveLease = false,
                        deviceId = (Guid?)null,
                        deviceName = (string?)null,
                        whatsAppStatus = "disconnected",
                        lastHeartbeat = DateTime.UtcNow,
                        currentUrl = (string?)null,
                        expiresAt = (DateTime?)null
                    });
                
                _logger.LogDebug("Broadcast ExtensionDisconnected for moderator {ModeratorId}", moderatorUserId);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to broadcast extension disconnected for moderator {ModeratorId}", moderatorUserId);
            }
        }

        #endregion
    }
}
