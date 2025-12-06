using ClinicsManagementService.Models;
using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.Services.Domain;
using Microsoft.AspNetCore.Mvc;
using System.Threading;
using Clinics.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ClinicsManagementService.Controllers
{
    // Helper for robust async execution in controllers
    public static class ControllerAsyncHelper
    {
        public static async Task<IActionResult> TryExecuteAsync(Func<Task<IActionResult>> operation, ControllerBase controller, INotifier notifier, string operationName)
        {
            try
            {
                return await operation();
            }
            catch (OperationCanceledException)
            {
                notifier?.Notify($"⚠️ Operation cancelled in {operationName}");
                return controller.StatusCode(499, "Request was cancelled");
            }
            catch (Exception ex)
            {
                notifier?.Notify($"❌ Error in {operationName}: {ex.Message}");
                return controller.StatusCode(500, $"Internal error: {ex.Message}");
            }
        }
    }
    [ApiController]
    [Route("[controller]")]
    public class BulkMessagingController : ControllerBase
    {
        private readonly IMessageSender _messageSender;
        private readonly IWhatsAppService _whatsappService;
        private readonly INotifier _notifier;
        private readonly IValidationService _validationService;
        private readonly IWhatsAppSessionOptimizer _sessionOptimizer;
        private readonly IWhatsAppSessionSyncService _sessionSyncService;
        private readonly IWhatsAppSessionManager _sessionManager;
        private readonly ApplicationDbContext _dbContext;

        public BulkMessagingController(
            IMessageSender messageSender, 
            IWhatsAppService whatsappService, 
            INotifier notifier,
            IValidationService validationService,
            IWhatsAppSessionOptimizer sessionOptimizer,
            IWhatsAppSessionSyncService sessionSyncService,
            IWhatsAppSessionManager sessionManager,
            ApplicationDbContext dbContext)
        {
            _messageSender = messageSender;
            _whatsappService = whatsappService;
            _notifier = notifier;
            _validationService = validationService;
            _sessionOptimizer = sessionOptimizer;
            _sessionSyncService = sessionSyncService;
            _sessionManager = sessionManager;
            _dbContext = dbContext;
        }
        // Send a single message to a single phone number.
        [HttpPost("send-single")]
        public async Task<IActionResult> SendSingle(
            [FromBody] PhoneMessageDto request,
            [FromQuery] int moderatorUserId,
            [FromQuery] int? userId = null,
            [FromQuery] int? patientId = null,
            CancellationToken cancellationToken = default)
        {
            return await ControllerAsyncHelper.TryExecuteAsync(async () =>
            {
                // Check if request was already cancelled
                cancellationToken.ThrowIfCancellationRequested();

                // Validate userId if provided
                if (userId.HasValue && userId.Value <= 0)
                {
                    return BadRequest(new { error = "userId must be greater than 0 if provided" });
                }

                int effectiveModeratorId = moderatorUserId;

                // Acquire exclusive operation lock for this moderator
                // This prevents parallel send/restore operations from conflicting
                using var operationLock = await _sessionManager.AcquireOperationLockAsync(effectiveModeratorId, 120000); // 2 minute timeout
                if (operationLock == null)
                {
                    _notifier.Notify($"⏱️ [Moderator {effectiveModeratorId}] Another operation is in progress");
                    return StatusCode(503, new 
                    { 
                        error = "OperationInProgress",
                        code = "BUSY",
                        message = "عملية أخرى قيد التنفيذ. يرجى الانتظار.",
                        arabicMessage = "عملية أخرى قيد التنفيذ. يرجى الانتظار."
                    });
                }

                // ========== FIX 1: Check pause state BEFORE any browser/restore operations ==========
                // This prevents browser launch when session is paused (especially during PendingQR)
                var pauseCheckBeforeRestore = await _sessionSyncService.CheckIfSessionPausedDueToPendingQRAsync(effectiveModeratorId);
                if (pauseCheckBeforeRestore)
                {
                    _notifier.Notify($"🛑 [Moderator {effectiveModeratorId}] Session is paused - skipping all browser operations");
                    return BadRequest(new 
                    { 
                        error = "PendingQR",
                        code = "AUTHENTICATION_REQUIRED",
                        message = "جلسة الواتساب متوقفة وتحتاج إلى المصادقة. يرجى المصادقة أولاً قبل إرسال الرسائل.",
                        isPaused = true,
                        isResumable = false
                    });
                }

                // Also check WhatsAppSession.IsPaused flag directly for any pause reason
                var whatsappSession = await _dbContext.WhatsAppSessions
                    .FirstOrDefaultAsync(ws => ws.ModeratorUserId == effectiveModeratorId && !ws.IsDeleted);
                if (whatsappSession?.IsPaused == true)
                {
                    _notifier.Notify($"🛑 [Moderator {effectiveModeratorId}] Session is globally paused (Reason: {whatsappSession.PauseReason}) - skipping all browser operations");
                    return BadRequest(new 
                    { 
                        error = whatsappSession.PauseReason ?? "Paused",
                        code = "SESSION_PAUSED",
                        message = $"جلسة الواتساب متوقفة ({whatsappSession.PauseReason}). يرجى استئناف الجلسة أولاً.",
                        isPaused = true,
                        pauseReason = whatsappSession.PauseReason,
                        isResumable = whatsappSession.PauseReason != "PendingQR"
                    });
                }
                // ========== END FIX 1 ==========

                // Restore session from backup before sending message
                try
                {
                    await _sessionOptimizer.RestoreFromBackupAsync(effectiveModeratorId);
                    _notifier.Notify($"✅ Session restored from backup for moderator {effectiveModeratorId}");
                }
                catch (Exception restoreEx)
                {
                    _notifier.Notify($"⚠️ Session restore failed (non-critical): {restoreEx.Message}");
                }

                // Check and auto-restore if session size exceeds threshold for this moderator
                try
                {
                    await _sessionOptimizer.CheckAndAutoRestoreIfNeededAsync(effectiveModeratorId);
                }
                catch (Exception optimizeEx)
                {
                    _notifier.Notify($"⚠️ Auto-restore check failed (non-critical): {optimizeEx.Message}");
                }
                
                // Note: PendingQR check was moved BEFORE restore operations (Fix 1)

                var phoneValidation = _validationService.ValidatePhoneNumber(request.Phone);
                var messageValidation = _validationService.ValidateMessage(request.Message);

                if (!phoneValidation.IsValid)
                    return BadRequest(phoneValidation.ErrorMessage);

                if (!messageValidation.IsValid)
                    return BadRequest(messageValidation.ErrorMessage);

                // Validate IsValidWhatsAppNumber if patientId is provided
                if (patientId.HasValue)
                {
                    var patient = await _dbContext.Patients.FindAsync(patientId.Value);
                    if (patient == null)
                    {
                        return BadRequest(new { error = "PatientNotFound", message = "المريض غير موجود." });
                    }

                    // Check IsValidWhatsAppNumber state
                    if (!patient.IsValidWhatsAppNumber.HasValue)
                    {
                        // null state: WhatsApp number validation not performed yet
                        return BadRequest(new 
                        { 
                            error = "WhatsAppNotChecked", 
                            message = "لم يتم التحقق من رقم الواتساب. يرجى التحقق من الرقم أولاً." 
                        });
                    }
                    else if (patient.IsValidWhatsAppNumber.Value == false)
                    {
                        // false state: WhatsApp number is invalid
                        return BadRequest(new 
                        { 
                            error = "InvalidWhatsAppNumber", 
                            message = "رقم الواتساب غير صالح. يرجى التحقق من الرقم المُدخل." 
                        });
                    }
                    // true state: WhatsApp number is valid - proceed with send
                }

                // Check and auto-restore if session size exceeds threshold
                try
                {
                    await _sessionOptimizer.CheckAndAutoRestoreIfNeededAsync(effectiveModeratorId);
                }
                catch (Exception optimizeEx)
                {
                    _notifier.Notify($"⚠️ Auto-restore check failed (non-critical): {optimizeEx.Message}");
                }

                // Check cancellation before sending
                cancellationToken.ThrowIfCancellationRequested();

                // Use SendMessageWithResultAsync to get detailed status (PendingQR, BrowserClosure, etc.)
                var result = await _messageSender.SendMessageWithResultAsync(effectiveModeratorId, request.Phone, request.Message, cancellationToken);
                
                if (result.Sent)
                {
                    // Update session status on successful send to track activity
                    try
                    {
                        await _sessionSyncService.UpdateSessionStatusAsync(
                            effectiveModeratorId,
                            "connected",
                            DateTime.UtcNow,
                            activityUserId: userId ?? effectiveModeratorId
                        );
                    }
                    catch (Exception syncEx)
                    {
                        _notifier.Notify($"⚠️ Failed to sync session status after successful send: {syncEx.Message}");
                    }
                    return Ok(new 
                    { 
                        success = true, 
                        message = "Message sent successfully.",
                        status = "Success"
                    });
                }
                else
                {
                    // Return structured error response based on status type
                    // This allows the main API to detect specific error types and handle them accordingly
                    switch (result.Status)
                    {
                        case Models.MessageOperationStatus.PendingQR:
                            // PendingQR: Authentication required - UNRESUMABLE pause
                            // Update database status for consistency
                            try
                            {
                                await _sessionSyncService.UpdateSessionStatusAsync(effectiveModeratorId, "pending", activityUserId: userId ?? effectiveModeratorId);
                            }
                            catch (Exception syncEx)
                            {
                                _notifier.Notify($"⚠️ Failed to sync session status after PendingQR: {syncEx.Message}");
                            }
                            return BadRequest(new 
                            { 
                                success = false,
                                error = "PendingQR",
                                code = "AUTHENTICATION_REQUIRED",
                                message = result.Error ?? "جلسة الواتساب تحتاج إلى المصادقة. يرجى المصادقة أولاً قبل إرسال الرسائل.",
                                status = "PendingQR",
                                isRecoverable = true,
                                shouldPause = true,
                                isResumable = false // Only resumable after authentication completes
                            });
                        
                        case Models.MessageOperationStatus.BrowserClosure:
                            // BrowserClosure: Intentional browser close - RESUMABLE pause
                            return StatusCode(503, new 
                            { 
                                success = false,
                                error = "BrowserClosure",
                                code = "BROWSER_CLOSED",
                                message = result.Error ?? "تم إغلاق المتصفح. تم إيقاف جميع المهام الجارية.",
                                status = "BrowserClosure",
                                isRecoverable = true,
                                shouldPause = true,
                                isResumable = true // Can be manually resumed from OngoingTasksPanel
                            });
                        
                        case Models.MessageOperationStatus.PendingNET:
                            // PendingNET: Network failure - RESUMABLE pause
                            return StatusCode(503, new 
                            { 
                                success = false,
                                error = "PendingNET",
                                code = "NETWORK_FAILURE",
                                message = result.Error ?? "فشل الاتصال بالإنترنت. تم إيقاف جميع المهام الجارية.",
                                status = "PendingNET",
                                isRecoverable = true,
                                shouldPause = true,
                                isResumable = true // Can be manually resumed from OngoingTasksPanel
                            });
                        
                        case Models.MessageOperationStatus.Waiting:
                            // Waiting: Temporary state, can retry
                            return StatusCode(503, new 
                            { 
                                success = false,
                                error = "Waiting",
                                code = "WAITING",
                                message = result.Error ?? "في انتظار اكتمال العملية.",
                                status = "Waiting",
                                isRecoverable = true,
                                shouldPause = false,
                                isResumable = true
                            });
                        
                        default:
                            // Generic failure - NOT recoverable, mark as failed
                            // Check and auto-restore if session size exceeds threshold
                            try
                            {
                                await _sessionOptimizer.CheckAndAutoRestoreIfNeededAsync(effectiveModeratorId);
                            }
                            catch (Exception optimizeEx)
                            {
                                _notifier.Notify($"⚠️ Auto-restore check failed (non-critical): {optimizeEx.Message}");
                            }
                            return StatusCode(502, new 
                            { 
                                success = false,
                                error = "Failure",
                                code = "SEND_FAILED",
                                message = result.Error ?? "فشل في إرسال الرسالة.",
                                status = "Failure",
                                isRecoverable = false,
                                shouldPause = false,
                                isResumable = false
                            });
                    }
                }
            }, this, _notifier, nameof(SendSingle));
        }

        /* Send multiple messages to multiple phone numbers (each item is a phone/message pair), 
         with random throttling between sends using a random number between minDelayMs and maxDelayMs in MilliSeconds. */
    [HttpPost("send-bulk")]
    public async Task<IActionResult> SendBulk([FromBody] BulkPhoneMessageRequest request, [FromQuery] int moderatorUserId, [FromQuery] int minDelayMs = 1000, [FromQuery] int maxDelayMs = 3000)
        {
            var bulkValidation = _validationService.ValidateBulkRequest(request);
            if (!bulkValidation.IsValid)
                return BadRequest(bulkValidation.ErrorMessage);

            var delayValidation = _validationService.ValidateDelayParameters(minDelayMs, maxDelayMs);
            if (!delayValidation.IsValid)
                return BadRequest(delayValidation.ErrorMessage);

            // Check internet connectivity before sending
            if (!await _whatsappService.CheckInternetConnectivityAsync())
            {
                _notifier.Notify("Internet connectivity to WhatsApp Web failed. Please check your connection and try again.");
                return StatusCode(503, "Internet connectivity to WhatsApp Web failed. Please check your connection and try again.");
            }

            await Task.Delay(5000); // Brief delay after connectivity check

            // Filter out invalid entries and prepare for sending
            var items = request.Items
                .Where(i => !string.IsNullOrWhiteSpace(i.Phone) && !string.IsNullOrWhiteSpace(i.Message))
                .Select(i => new { i.Phone, i.Message })
                .ToList();

            var rawResults = await _messageSender.SendBulkWithThrottlingAsync(
                moderatorUserId,
                items.Select(i => (i.Phone, i.Message)), minDelayMs, maxDelayMs);

            var results = items.Zip(rawResults, (input, result) => new MessageSendResult
            {
                Phone = result.Phone,
                Message = input.Message,
                Sent = result.Sent,
                Error = result.Error,
                IconType = result.IconType,
                Status = DetermineStatus(result.Sent, result.Error)
            }).ToList();

            var failed = results.Where(r => !r.Sent).ToList();
            if (failed.Count == 0)
            {
                return Ok(new { message = "All messages sent successfully.", results });
            }
            return StatusCode(207, new { message = "Some messages failed", results });
        }

        /// <summary>
        /// Determines the status based on sent status and error message
        /// </summary>
        private MessageOperationStatus DetermineStatus(bool sent, string? error)
        {
            if (sent)
            {
                return MessageOperationStatus.Success;
            }

            if (error?.Contains("PendingQR:") == true || error?.Contains("WhatsApp authentication required") == true)
            {
                return MessageOperationStatus.PendingQR;
            }

            if (error?.Contains("PendingNET:") == true || error?.Contains("Internet connection unavailable") == true)
            {
                return MessageOperationStatus.PendingNET;
            }

            if (error?.Contains("Waiting:") == true)
            {
                return MessageOperationStatus.Waiting;
            }

            return MessageOperationStatus.Failure;
        }
    }
}