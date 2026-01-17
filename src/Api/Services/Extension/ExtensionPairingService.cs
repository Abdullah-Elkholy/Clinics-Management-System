using System.Security.Cryptography;
using System.Globalization;
using System.Text;
using System.Text.Json;
using Clinics.Domain;
using Clinics.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace Clinics.Api.Services.Extension
{
    /// <summary>
    /// Service for managing extension device pairing.
    /// </summary>
    public class ExtensionPairingService : IExtensionPairingService
    {
        private readonly ApplicationDbContext _db;
        private readonly ILogger<ExtensionPairingService> _logger;
        private readonly TimeSpan _pairingCodeExpiry = TimeSpan.FromMinutes(5);
        private readonly TimeSpan _deviceTokenExpiry = TimeSpan.FromDays(30);

        public ExtensionPairingService(ApplicationDbContext db, ILogger<ExtensionPairingService> logger)
        {
            _db = db;
            _logger = logger;
        }

        public async Task<ExtensionPairingCode> StartPairingAsync(int moderatorUserId)
        {
            // Check if moderator already has an active (non-revoked) device
            var existingActiveDevice = await _db.ExtensionDevices
                .FirstOrDefaultAsync(d => d.ModeratorUserId == moderatorUserId && d.RevokedAtUtc == null);

            if (existingActiveDevice != null)
            {
                _logger.LogWarning("Moderator {ModeratorId} already has an active device: {DeviceId}",
                    moderatorUserId, existingActiveDevice.DeviceId);
                throw new InvalidOperationException("يوجد جهاز مقترن بالفعل. يرجى إلغاء إقران الجهاز الحالي أولاً قبل إضافة جهاز جديد.");
            }

            // Invalidate any existing unused pairing codes for this moderator
            var existingCodes = await _db.ExtensionPairingCodes
                .Where(c => c.ModeratorUserId == moderatorUserId && c.UsedAtUtc == null)
                .ToListAsync();

            foreach (var code in existingCodes)
            {
                code.ExpiresAtUtc = DateTime.UtcNow; // Expire immediately
            }

            // Generate new pairing code
            var pairingCode = new ExtensionPairingCode
            {
                Id = Guid.NewGuid(),
                ModeratorUserId = moderatorUserId,
                Code = GeneratePairingCode(),
                CreatedAtUtc = DateTime.UtcNow,
                ExpiresAtUtc = DateTime.UtcNow.Add(_pairingCodeExpiry)
            };

            _db.ExtensionPairingCodes.Add(pairingCode);
            await _db.SaveChangesAsync();

            _logger.LogInformation("Pairing code generated for moderator {ModeratorId}: {Code}",
                moderatorUserId, pairingCode.Code);

            return pairingCode;
        }

        public async Task<(ExtensionDevice? device, string? token, string? error)> CompletePairingAsync(
            string code,
            string deviceId,
            string? deviceName,
            string? extensionVersion,
            string? userAgent)
        {
            // Find valid pairing code
            var pairingCode = await _db.ExtensionPairingCodes
                .FirstOrDefaultAsync(c => c.Code == code && c.UsedAtUtc == null && c.ExpiresAtUtc > DateTime.UtcNow);

            if (pairingCode == null)
            {
                // Check if code exists but was already used (for better error message)
                var usedCode = await _db.ExtensionPairingCodes
                    .FirstOrDefaultAsync(c => c.Code == code && c.UsedAtUtc != null);

                if (usedCode != null)
                {
                    _logger.LogWarning("Pairing code already used: {Code}", code);
                    return (null, null, "رمز الاقتران مستخدم بالفعل. تم الإقران بنجاح مسبقاً أو يرجى إنشاء رمز جديد.");
                }

                _logger.LogWarning("Invalid or expired pairing code: {Code}", code);
                return (null, null, "رمز الاقتران غير صالح أو منتهي الصلاحية");
            }

            // Check if moderator already has an active (non-revoked) device that is different from this one
            var existingActiveDevice = await _db.ExtensionDevices
                .FirstOrDefaultAsync(d => d.ModeratorUserId == pairingCode.ModeratorUserId
                    && d.RevokedAtUtc == null
                    && d.DeviceId != deviceId);

            if (existingActiveDevice != null)
            {
                _logger.LogWarning("Moderator {ModeratorId} already has an active device: {ExistingDeviceId}, cannot pair new device: {NewDeviceId}",
                    pairingCode.ModeratorUserId, existingActiveDevice.DeviceId, deviceId);
                return (null, null, "يوجد جهاز مقترن بالفعل. يرجى إلغاء إقران الجهاز الحالي أولاً قبل إضافة جهاز جديد.");
            }

            // Check if this exact device already exists AND is active (non-revoked) for this moderator
            // Revoked devices are treated as historical records - always create a new device record
            var existingActiveDeviceSameId = await _db.ExtensionDevices
                .FirstOrDefaultAsync(d => d.ModeratorUserId == pairingCode.ModeratorUserId
                    && d.DeviceId == deviceId
                    && d.RevokedAtUtc == null);

            // Generate new token
            var rawToken = GenerateDeviceToken();
            var tokenHash = HashToken(rawToken);

            ExtensionDevice device;
            if (existingActiveDeviceSameId != null)
            {
                // Update existing active device (same device re-pairing while still active)
                existingActiveDeviceSameId.TokenHash = tokenHash;
                existingActiveDeviceSameId.TokenExpiresAtUtc = DateTime.UtcNow.Add(_deviceTokenExpiry);
                existingActiveDeviceSameId.ExtensionVersion = extensionVersion;
                existingActiveDeviceSameId.UserAgent = userAgent;
                existingActiveDeviceSameId.DeviceName = deviceName ?? existingActiveDeviceSameId.DeviceName;
                existingActiveDeviceSameId.LastSeenAtUtc = DateTime.UtcNow;
                device = existingActiveDeviceSameId;

                _logger.LogInformation("Active device re-paired for moderator {ModeratorId}: {DeviceId}",
                    pairingCode.ModeratorUserId, deviceId);
            }
            else
            {
                // Create new device record (either first time or re-pairing after revocation)
                // Revoked devices stay as historical records with full audit trail
                device = new ExtensionDevice
                {
                    Id = Guid.NewGuid(),
                    ModeratorUserId = pairingCode.ModeratorUserId,
                    DeviceId = deviceId,
                    DeviceName = deviceName ?? GenerateDeviceName(userAgent),
                    TokenHash = tokenHash,
                    ExtensionVersion = extensionVersion,
                    UserAgent = userAgent,
                    TokenExpiresAtUtc = DateTime.UtcNow.Add(_deviceTokenExpiry),
                    CreatedAtUtc = DateTime.UtcNow,
                    LastSeenAtUtc = DateTime.UtcNow
                };
                _db.ExtensionDevices.Add(device);

                _logger.LogInformation("New device record created for moderator {ModeratorId}: {DeviceId}",
                    pairingCode.ModeratorUserId, deviceId);
            }

            // Mark pairing code as used
            pairingCode.UsedAtUtc = DateTime.UtcNow;
            pairingCode.UsedByDeviceId = device.Id;

            await _db.SaveChangesAsync();

            return (device, rawToken, null);
        }

        public async Task<bool> RevokeDeviceAsync(Guid deviceId, string reason)
        {
            var device = await _db.ExtensionDevices.FindAsync(deviceId);
            if (device == null) return false;

            // Soft-revoke: mark as revoked for audit traceability (don't delete)
            device.RevokedAtUtc = DateTime.UtcNow;
            device.RevokedReason = reason;
            await _db.SaveChangesAsync();

            _logger.LogInformation("Device {DeviceId} revoked for moderator {ModeratorId}: {Reason}",
                deviceId, device.ModeratorUserId, reason);

            return true;
        }

        public async Task<bool> DeleteDeviceAsync(Guid deviceId)
        {
            var device = await _db.ExtensionDevices.FindAsync(deviceId);
            if (device == null) return false;

            var moderatorId = device.ModeratorUserId;

            // Wrap all deletions in a transaction for atomicity
            await using var transaction = await _db.Database.BeginTransactionAsync();
            try
            {
                // Delete associated leases first
                var leases = await _db.ExtensionSessionLeases
                    .Where(l => l.DeviceId == deviceId)
                    .ToListAsync();

                // Delete associated commands through leases
                foreach (var lease in leases)
                {
                    var commands = await _db.ExtensionCommands
                        .Where(c => c.ModeratorUserId == lease.ModeratorUserId)
                        .ToListAsync();
                    _db.ExtensionCommands.RemoveRange(commands);
                }

                _db.ExtensionSessionLeases.RemoveRange(leases);

                // Delete any pairing codes that reference this device
                var pairingCodes = await _db.ExtensionPairingCodes
                    .Where(p => p.UsedByDeviceId == deviceId)
                    .ToListAsync();
                _db.ExtensionPairingCodes.RemoveRange(pairingCodes);

                // Finally delete the device
                _db.ExtensionDevices.Remove(device);

                await _db.SaveChangesAsync();
                await transaction.CommitAsync();

                _logger.LogInformation("Device {DeviceId} permanently deleted for moderator {ModeratorId}",
                    deviceId, moderatorId);

                return true;
            }
            catch (Exception ex)
            {
                await transaction.RollbackAsync();
                _logger.LogError(ex, "Failed to delete device {DeviceId} for moderator {ModeratorId}",
                    deviceId, moderatorId);
                return false;
            }
        }

        public async Task<IList<ExtensionDevice>> GetDevicesAsync(int moderatorUserId)
        {
            // Only return active (non-revoked) devices
            // Revoked devices are soft-deleted for audit traceability but should not appear as paired
            return await _db.ExtensionDevices
                .Where(d => d.ModeratorUserId == moderatorUserId && d.RevokedAtUtc == null)
                .OrderByDescending(d => d.LastSeenAtUtc)
                .ToListAsync();
        }

        #region Helper Methods

        private static string GeneratePairingCode()
        {
            // Generate 8-digit numeric code
            using var rng = RandomNumberGenerator.Create();
            var bytes = new byte[4];
            rng.GetBytes(bytes);
            var number = Math.Abs(BitConverter.ToInt32(bytes, 0)) % 100000000;
            return number.ToString("D8", CultureInfo.InvariantCulture);
        }

        private static string GenerateDeviceToken()
        {
            // Generate secure random token
            using var rng = RandomNumberGenerator.Create();
            var bytes = new byte[32];
            rng.GetBytes(bytes);
            return Convert.ToBase64String(bytes);
        }

        public static string HashToken(string token)
        {
            using var sha256 = SHA256.Create();
            var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(token));
            return Convert.ToBase64String(bytes);
        }

        private static string GenerateDeviceName(string? userAgent)
        {
            if (string.IsNullOrEmpty(userAgent))
                return "Unknown Device";

            // Simple browser detection
            if (userAgent.Contains("Chrome"))
                return "Chrome Browser";
            if (userAgent.Contains("Firefox"))
                return "Firefox Browser";
            if (userAgent.Contains("Edge"))
                return "Edge Browser";

            return "Browser Extension";
        }

        #endregion
    }
}
