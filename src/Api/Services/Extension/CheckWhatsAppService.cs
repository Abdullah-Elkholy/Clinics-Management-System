using System.Text.Json;
using Clinics.Domain;
using Clinics.Infrastructure;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace Clinics.Api.Services.Extension
{
    /// <summary>
    /// Result of checking if a phone number has WhatsApp.
    /// </summary>
    public class CheckWhatsAppResult
    {
        public bool Success { get; init; }
        public bool? HasWhatsApp { get; init; }
        public string ResultStatus { get; init; } = "failed";
        public string? ErrorMessage { get; init; }
        public bool ShouldPauseGlobally { get; init; }
        public string? PauseReason { get; init; }

        public static CheckWhatsAppResult Valid() => new()
        {
            Success = true,
            HasWhatsApp = true,
            ResultStatus = ExtensionResultStatuses.Success
        };

        public static CheckWhatsAppResult Invalid(string? message = null) => new()
        {
            Success = true,
            HasWhatsApp = false,
            ResultStatus = ExtensionResultStatuses.Success,
            ErrorMessage = message ?? "هذا الرقم لا يمتلك واتساب"
        };

        public static CheckWhatsAppResult Unknown(string message) => new()
        {
            Success = false,
            HasWhatsApp = null,
            ResultStatus = ExtensionResultStatuses.Waiting,
            ErrorMessage = message
        };

        public static CheckWhatsAppResult Failed(string message) => new()
        {
            Success = false,
            HasWhatsApp = null,
            ResultStatus = ExtensionResultStatuses.Failed,
            ErrorMessage = message
        };

        public static CheckWhatsAppResult PendingQR(string message) => new()
        {
            Success = false,
            HasWhatsApp = null,
            ResultStatus = ExtensionResultStatuses.PendingQR,
            ErrorMessage = message,
            ShouldPauseGlobally = true,
            PauseReason = "PendingQR"
        };

        public static CheckWhatsAppResult PendingNET(string message) => new()
        {
            Success = false,
            HasWhatsApp = null,
            ResultStatus = ExtensionResultStatuses.PendingNET,
            ErrorMessage = message,
            ShouldPauseGlobally = true,
            PauseReason = "PendingNET"
        };

        public static CheckWhatsAppResult NoActiveLease(string message) => new()
        {
            Success = false,
            HasWhatsApp = null,
            ResultStatus = ExtensionResultStatuses.NoActiveLease,
            ErrorMessage = message
        };
    }

    /// <summary>
    /// Payload for CheckWhatsAppNumber command.
    /// </summary>
    public class CheckWhatsAppNumberPayload
    {
        public string PhoneNumber { get; set; } = "";
        public string? CountryCode { get; set; }
        public string? E164Phone { get; set; }
        public Guid? CheckSessionId { get; set; }
    }

    /// <summary>
    /// Service for checking WhatsApp number validity via extension.
    /// Implements hard interrupt behavior similar to global pause.
    /// </summary>
    public interface ICheckWhatsAppService
    {
        /// <summary>
        /// Check if a phone number has WhatsApp.
        /// This will:
        /// 1. Hard pause any active sending (unresumable until checks complete)
        /// 2. Create a check session if needed
        /// 3. Execute the check via extension
        /// 4. Resume sending capability after checks complete
        /// </summary>
        Task<CheckWhatsAppResult> CheckNumberAsync(
            string phoneNumber,
            string countryCode,
            int moderatorUserId,
            int userId,
            bool forceCheck = false,
            CancellationToken cancellationToken = default);

        /// <summary>
        /// Cancel any ongoing check session for a moderator.
        /// Clears the CheckWhatsApp pause and allows sending to resume.
        /// </summary>
        Task CancelCheckSessionAsync(int moderatorUserId);

        /// <summary>
        /// Check if there's an active check session for a moderator.
        /// </summary>
        Task<MessageSession?> GetActiveCheckSessionAsync(int moderatorUserId);
    }

    public class CheckWhatsAppService : ICheckWhatsAppService
    {
        private readonly ApplicationDbContext _db;
        private readonly IExtensionLeaseService _leaseService;
        private readonly IExtensionCommandService _commandService;
        private readonly IHubContext<Hubs.ExtensionHub> _extensionHub;
        private readonly ILogger<CheckWhatsAppService> _logger;
        private readonly TimeSpan _commandTimeout = TimeSpan.FromSeconds(60);
        private readonly TimeSpan _pollInterval = TimeSpan.FromMilliseconds(500);

        public CheckWhatsAppService(
            ApplicationDbContext db,
            IExtensionLeaseService leaseService,
            IExtensionCommandService commandService,
            IHubContext<Hubs.ExtensionHub> extensionHub,
            ILogger<CheckWhatsAppService> logger)
        {
            _db = db;
            _leaseService = leaseService;
            _commandService = commandService;
            _extensionHub = extensionHub;
            _logger = logger;
        }

        public async Task<CheckWhatsAppResult> CheckNumberAsync(
            string phoneNumber,
            string countryCode,
            int moderatorUserId,
            int userId,
            bool forceCheck = false,
            CancellationToken cancellationToken = default)
        {
            _logger.LogInformation(
                "CheckWhatsApp requested for {PhoneNumber} by moderator {ModeratorId} (Force: {Force})",
                phoneNumber, moderatorUserId, forceCheck);

            // Step 1: Pre-flight checks
            // 1.1 Check Cache First (only if not forced)
            var e164Phone = BuildE164Phone(phoneNumber, countryCode);

            if (!forceCheck)
            {
                var cachedResult = await _db.PhoneWhatsAppRegistry
                    .Where(r => r.PhoneNumber == e164Phone)
                    .FirstOrDefaultAsync(cancellationToken);

                if (cachedResult != null && (cachedResult.ExpiresAt == null || cachedResult.ExpiresAt > DateTime.UtcNow))
                {
                    _logger.LogInformation("Cache hit for {PhoneNumber}: HasWhatsApp={Status}", e164Phone, cachedResult.HasWhatsApp);
                    return cachedResult.HasWhatsApp
                        ? CheckWhatsAppResult.Valid()
                        : CheckWhatsAppResult.Invalid();
                }
            }

            var lease = await _leaseService.GetActiveLeaseAsync(moderatorUserId);
            if (lease == null)
            {
                _logger.LogWarning("No active extension lease for moderator {ModeratorId}", moderatorUserId);
                return CheckWhatsAppResult.NoActiveLease("لا يوجد امتداد نشط متصل. يرجى تشغيل امتداد المتصفح.");
            }

            // Check WhatsApp status
            if (lease.WhatsAppStatus == "pending_qr")
            {
                return CheckWhatsAppResult.PendingQR("جلسة الواتساب تحتاج إلى المصادقة. يرجى مسح رمز QR.");
            }

            if (lease.WhatsAppStatus == "pending_net" || lease.WhatsAppStatus == "disconnected")
            {
                return CheckWhatsAppResult.PendingNET("فشل الاتصال بالإنترنت.");
            }

            // Step 2: Hard pause sending - set global pause with CheckWhatsApp reason
            var whatsAppSession = await _db.WhatsAppSessions
                .Where(ws => ws.ModeratorUserId == moderatorUserId && !ws.IsDeleted)
                .FirstOrDefaultAsync(cancellationToken);

            if (whatsAppSession != null && !whatsAppSession.IsPaused)
            {
                whatsAppSession.IsPaused = true;
                whatsAppSession.PauseReason = "CheckWhatsApp";
                whatsAppSession.PausedAt = DateTime.UtcNow;
                whatsAppSession.PausedBy = userId;
                await _db.SaveChangesAsync(cancellationToken);

                _logger.LogInformation(
                    "Hard paused sending for moderator {ModeratorId} due to CheckWhatsApp",
                    moderatorUserId);

                // Broadcast pause update via SignalR
                await _extensionHub.Clients
                    .Group($"moderator-{moderatorUserId}")
                    .SendAsync("WhatsAppSessionUpdated", new
                    {
                        moderatorUserId,
                        status = whatsAppSession.Status,
                        isPaused = true,
                        pauseReason = "CheckWhatsApp",
                        isResumable = false
                    }, cancellationToken);
            }

            try
            {
                // Step 3: already built E.164 phone number above
                // var e164Phone = BuildE164Phone(phoneNumber, countryCode);

                // Step 4: Check for existing in-flight check command
                var existingCommand = await _db.ExtensionCommands
                    .Where(c => c.ModeratorUserId == moderatorUserId
                        && c.CommandType == ExtensionCommandTypes.CheckWhatsAppNumber
                        && (c.Status == ExtensionCommandStatuses.Pending ||
                            c.Status == ExtensionCommandStatuses.Sent ||
                            c.Status == ExtensionCommandStatuses.Acked)
                        && c.CreatedAtUtc > DateTime.UtcNow.AddMinutes(-2))
                    .FirstOrDefaultAsync(cancellationToken);

                if (existingCommand != null)
                {
                    _logger.LogWarning(
                        "Check command already in progress for moderator {ModeratorId}, waiting...",
                        moderatorUserId);

                    // Wait for existing command to complete
                    return await WaitForCheckCommandResult(existingCommand.Id, cancellationToken);
                }

                // Step 5: Create check command
                var payload = new CheckWhatsAppNumberPayload
                {
                    PhoneNumber = phoneNumber,
                    CountryCode = countryCode,
                    E164Phone = e164Phone
                };

                var command = await _commandService.CreateCommandAsync(
                    moderatorUserId,
                    ExtensionCommandTypes.CheckWhatsAppNumber,
                    payload,
                    priority: 50, // Higher priority than regular messages (100)
                    timeout: _commandTimeout);

                _logger.LogInformation(
                    "Created CheckWhatsAppNumber command {CommandId} for {E164Phone}",
                    command.Id, e164Phone);

                // Step 6: Notify extension via SignalR
                try
                {
                    await _extensionHub.Clients
                        .Group($"extension-{moderatorUserId}")
                        .SendAsync("ExecuteCommand", new
                        {
                            commandId = command.Id,
                            commandType = command.CommandType,
                            payload = payload
                        }, cancellationToken);

                    await _commandService.MarkSentAsync(command.Id);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Failed to send check command {CommandId} via SignalR", command.Id);
                }

                // Step 7: Wait for command completion
                // Step 7: Wait for command completion
                var result = await WaitForCheckCommandResult(command.Id, cancellationToken);

                // Step 7.1: Update Cache if successful (wrapped in transaction for atomicity)
                if (result.Success && result.HasWhatsApp.HasValue)
                {
                    await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
                    try
                    {
                        var hasWhatsApp = result.HasWhatsApp.Value;
                        var existingEntry = await _db.PhoneWhatsAppRegistry
                            .FirstOrDefaultAsync(r => r.PhoneNumber == e164Phone, cancellationToken);

                        if (existingEntry == null)
                        {
                            existingEntry = new PhoneWhatsAppRegistry
                            {
                                PhoneNumber = e164Phone,
                                CreatedAt = DateTime.UtcNow
                            };
                            _db.PhoneWhatsAppRegistry.Add(existingEntry);
                        }

                        existingEntry.HasWhatsApp = hasWhatsApp;
                        existingEntry.CheckedByUserId = userId;
                        existingEntry.ValidationCount++;
                        // Cache policy: Valid = 30 days, Invalid = 7 days
                        existingEntry.ExpiresAt = DateTime.UtcNow.AddDays(hasWhatsApp ? 30 : 7);

                        // Sync to Patient.IsValidWhatsAppNumber for all patients with this phone
                        var patientsToUpdate = await _db.Patients
                            .Where(p => (p.PhoneNumber == e164Phone ||
                                        p.PhoneNumber == phoneNumber ||
                                        ("+" + p.CountryCode + p.PhoneNumber.TrimStart('0')) == e164Phone)
                                   && !p.IsDeleted)
                            .ToListAsync(cancellationToken);

                        foreach (var patient in patientsToUpdate)
                        {
                            patient.IsValidWhatsAppNumber = hasWhatsApp;
                            patient.UpdatedAt = DateTime.UtcNow;
                        }

                        if (patientsToUpdate.Count > 0)
                        {
                            _logger.LogInformation(
                                "Synced IsValidWhatsAppNumber={HasWhatsApp} to {Count} patients with phone {Phone}",
                                hasWhatsApp, patientsToUpdate.Count, e164Phone);
                        }

                        await _db.SaveChangesAsync(cancellationToken);
                        await transaction.CommitAsync(cancellationToken);
                        _logger.LogInformation("Updated cache for {PhoneNumber}: HasWhatsApp={Status}", e164Phone, hasWhatsApp);
                    }
                    catch (Exception ex)
                    {
                        await transaction.RollbackAsync(cancellationToken);
                        _logger.LogError(ex, "Failed to update cache and patient sync for {PhoneNumber}", e164Phone);
                        // Don't fail the whole operation - cache update failure is not critical
                    }
                }

                return result;
            }
            catch (OperationCanceledException)
            {
                _logger.LogInformation("CheckWhatsApp cancelled for moderator {ModeratorId}", moderatorUserId);
                throw;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error during CheckWhatsApp for moderator {ModeratorId}", moderatorUserId);
                return CheckWhatsAppResult.Failed("حدث خطأ أثناء التحقق: " + ex.Message);
            }
            finally
            {
                // Step 8: Clear pause if this was the last check
                // Note: In a proper queue system, we'd check if there are more checks pending
                // For now, clear the pause after each individual check
                await ClearCheckPauseIfNeeded(moderatorUserId, cancellationToken);
            }
        }

        public async Task CancelCheckSessionAsync(int moderatorUserId)
        {
            _logger.LogInformation("Cancelling check session for moderator {ModeratorId}", moderatorUserId);

            // Cancel any pending check commands
            var pendingCommands = await _db.ExtensionCommands
                .Where(c => c.ModeratorUserId == moderatorUserId
                    && c.CommandType == ExtensionCommandTypes.CheckWhatsAppNumber
                    && (c.Status == ExtensionCommandStatuses.Pending ||
                        c.Status == ExtensionCommandStatuses.Sent))
                .ToListAsync();

            foreach (var cmd in pendingCommands)
            {
                await _commandService.FailAsync(cmd.Id, "Cancelled by user");
            }

            // Clear the CheckWhatsApp pause
            var whatsAppSession = await _db.WhatsAppSessions
                .Where(ws => ws.ModeratorUserId == moderatorUserId && !ws.IsDeleted)
                .FirstOrDefaultAsync();

            if (whatsAppSession != null &&
                whatsAppSession.IsPaused &&
                whatsAppSession.PauseReason?.Contains("CheckWhatsApp", StringComparison.OrdinalIgnoreCase) == true)
            {
                whatsAppSession.IsPaused = false;
                whatsAppSession.PauseReason = null;
                whatsAppSession.PausedAt = null;
                whatsAppSession.PausedBy = null;
                await _db.SaveChangesAsync();

                _logger.LogInformation(
                    "Cleared CheckWhatsApp pause for moderator {ModeratorId}",
                    moderatorUserId);

                // Broadcast update
                await _extensionHub.Clients
                    .Group($"moderator-{moderatorUserId}")
                    .SendAsync("WhatsAppSessionUpdated", new
                    {
                        moderatorUserId,
                        status = whatsAppSession.Status,
                        isPaused = false,
                        pauseReason = (string?)null,
                        isResumable = false
                    });
            }
        }

        public async Task<MessageSession?> GetActiveCheckSessionAsync(int moderatorUserId)
        {
            return await _db.MessageSessions
                .Where(s => s.ModeratorId == moderatorUserId
                    && s.SessionType == MessageSessionTypes.CheckWhatsApp
                    && s.Status == "active"
                    && !s.IsDeleted)
                .OrderByDescending(s => s.StartTime)
                .FirstOrDefaultAsync();
        }

        #region Private Methods

        private async Task<CheckWhatsAppResult> WaitForCheckCommandResult(
            Guid commandId,
            CancellationToken cancellationToken)
        {
            var startTime = DateTime.UtcNow;
            while (DateTime.UtcNow - startTime < _commandTimeout)
            {
                cancellationToken.ThrowIfCancellationRequested();

                var command = await _commandService.GetCommandAsync(commandId);
                if (command == null)
                {
                    return CheckWhatsAppResult.Failed("الأمر غير موجود");
                }

                switch (command.Status)
                {
                    case ExtensionCommandStatuses.Completed:
                        return MapCommandResultToCheckResult(command);

                    case ExtensionCommandStatuses.Failed:
                    case ExtensionCommandStatuses.Expired:
                        var errorMsg = ExtractErrorMessage(command.ResultJson);
                        return CheckWhatsAppResult.Failed(errorMsg ?? "فشل في التحقق من الرقم");
                }

                await Task.Delay(_pollInterval, cancellationToken);
            }

            // Timeout
            _logger.LogWarning(
                "CheckWhatsApp command {CommandId} timed out after {Timeout}s",
                commandId, _commandTimeout.TotalSeconds);

            return CheckWhatsAppResult.Unknown("انتهت مهلة انتظار التحقق - يرجى المحاولة مرة أخرى");
        }

        private CheckWhatsAppResult MapCommandResultToCheckResult(ExtensionCommand command)
        {
            _logger.LogInformation("MapCommandResultToCheckResult: ResultJson={ResultJson}, ResultStatus={ResultStatus}",
                command.ResultJson, command.ResultStatus);

            if (string.IsNullOrEmpty(command.ResultJson))
            {
                _logger.LogWarning("MapCommandResultToCheckResult: ResultJson is null or empty");
                return CheckWhatsAppResult.Unknown("لم يتم استلام نتيجة من الامتداد");
            }

            try
            {
                var doc = JsonDocument.Parse(command.ResultJson);
                _logger.LogInformation("MapCommandResultToCheckResult: Parsed JSON. Root element kind: {Kind}",
                    doc.RootElement.ValueKind);

                // Check for "checked" and "hasWhatsApp" properties from extension
                if (doc.RootElement.TryGetProperty("checked", out var checkedProp))
                {
                    var wasChecked = checkedProp.GetBoolean();
                    _logger.LogInformation("MapCommandResultToCheckResult: Found 'checked' property, value={WasChecked}", wasChecked);

                    if (!wasChecked)
                    {
                        return CheckWhatsAppResult.Unknown("لم يتمكن الامتداد من التحقق - يرجى المحاولة مرة أخرى");
                    }

                    if (doc.RootElement.TryGetProperty("hasWhatsApp", out var hasWhatsAppProp))
                    {
                        var hasWhatsApp = hasWhatsAppProp.GetBoolean();
                        _logger.LogInformation("MapCommandResultToCheckResult: Found 'hasWhatsApp' property, value={HasWhatsApp}", hasWhatsApp);
                        return hasWhatsApp
                            ? CheckWhatsAppResult.Valid()
                            : CheckWhatsAppResult.Invalid();
                    }
                    else
                    {
                        _logger.LogWarning("MapCommandResultToCheckResult: 'hasWhatsApp' property NOT found in JSON");
                    }
                }
                else
                {
                    _logger.LogWarning("MapCommandResultToCheckResult: 'checked' property NOT found in JSON. Properties available: {Props}",
                        string.Join(", ", doc.RootElement.EnumerateObject().Select(p => p.Name)));
                }

                // Fallback: check resultStatus
                if (command.ResultStatus == ExtensionResultStatuses.Success)
                {
                    // Assume success means has WhatsApp
                    return CheckWhatsAppResult.Valid();
                }

                return CheckWhatsAppResult.Unknown("نتيجة غير متوقعة من الامتداد");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to parse check result JSON: {Json}", command.ResultJson);
                return CheckWhatsAppResult.Unknown("خطأ في تحليل نتيجة التحقق");
            }
        }

        private static string? ExtractErrorMessage(string? resultJson)
        {
            if (string.IsNullOrEmpty(resultJson))
                return null;

            try
            {
                var doc = JsonDocument.Parse(resultJson);
                if (doc.RootElement.TryGetProperty("error", out var errorElement))
                {
                    return errorElement.GetString();
                }
                if (doc.RootElement.TryGetProperty("message", out var messageElement))
                {
                    return messageElement.GetString();
                }
            }
            catch
            {
                // Ignore JSON parse errors
            }

            return null;
        }

        private static string BuildE164Phone(string phoneNumber, string countryCode)
        {
            // If phone already starts with '+', assume it's already E.164 format
            if (!string.IsNullOrEmpty(phoneNumber) && phoneNumber.StartsWith('+'))
            {
                // Already E.164 format, just return as-is (no double-prefix)
                return phoneNumber;
            }

            // Normalize country code (remove leading + if present)
            var normalizedCC = countryCode?.TrimStart('+') ?? "20";

            // Normalize phone number (remove leading 0)
            var normalizedPhone = phoneNumber.TrimStart('0');

            return $"+{normalizedCC}{normalizedPhone}";
        }

        private async Task ClearCheckPauseIfNeeded(int moderatorUserId, CancellationToken cancellationToken)
        {
            // Check if there are any pending check commands
            var hasPendingChecks = await _db.ExtensionCommands
                .AnyAsync(c => c.ModeratorUserId == moderatorUserId
                    && c.CommandType == ExtensionCommandTypes.CheckWhatsAppNumber
                    && (c.Status == ExtensionCommandStatuses.Pending ||
                        c.Status == ExtensionCommandStatuses.Sent ||
                        c.Status == ExtensionCommandStatuses.Acked),
                    cancellationToken);

            if (!hasPendingChecks)
            {
                var whatsAppSession = await _db.WhatsAppSessions
                    .Where(ws => ws.ModeratorUserId == moderatorUserId && !ws.IsDeleted)
                    .FirstOrDefaultAsync(cancellationToken);

                if (whatsAppSession != null &&
                    whatsAppSession.IsPaused &&
                    whatsAppSession.PauseReason?.Contains("CheckWhatsApp", StringComparison.OrdinalIgnoreCase) == true)
                {
                    whatsAppSession.IsPaused = false;
                    whatsAppSession.PauseReason = null;
                    whatsAppSession.PausedAt = null;
                    whatsAppSession.PausedBy = null;
                    await _db.SaveChangesAsync(cancellationToken);

                    _logger.LogInformation(
                        "Auto-cleared CheckWhatsApp pause for moderator {ModeratorId} - no more pending checks",
                        moderatorUserId);

                    // Broadcast update
                    await _extensionHub.Clients
                        .Group($"moderator-{moderatorUserId}")
                        .SendAsync("WhatsAppSessionUpdated", new
                        {
                            moderatorUserId,
                            status = whatsAppSession.Status,
                            isPaused = false,
                            pauseReason = (string?)null,
                            isResumable = false
                        }, cancellationToken);
                }
            }
        }

        #endregion
    }
}
