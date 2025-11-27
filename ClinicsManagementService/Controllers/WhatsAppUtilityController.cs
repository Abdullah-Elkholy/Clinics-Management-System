using Microsoft.AspNetCore.Mvc;
using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.Models;
using ClinicsManagementService.Services.Domain;
using ClinicsManagementService.Services.Infrastructure;
using ClinicsManagementService.Configuration;
using Clinics.Infrastructure;
using Clinics.Domain;
using Microsoft.EntityFrameworkCore;
using Microsoft.Playwright;
using System.Net;
using System.Threading;
using System.Linq;

namespace ClinicsManagementService.Controllers
{
    /// <summary>
    /// Controller for WhatsApp utility operations
    /// </summary>
    [ApiController]
    [Route("api/[controller]")]
    public class WhatsAppUtilityController : ControllerBase
    {
        private readonly IWhatsAppService _whatsAppService;
        private readonly INotifier _notifier;
        private readonly IWhatsAppSessionManager _sessionManager;
        private readonly Func<int, IBrowserSession> _browserSessionFactory;
        private readonly IWhatsAppUIService _whatsAppUIService;
        private readonly IRetryService _retryService;
        private readonly IWhatsAppSessionOptimizer _sessionOptimizer;
        private readonly IWhatsAppSessionSyncService _sessionSyncService;
        private readonly ApplicationDbContext _dbContext;
        private readonly OperationCoordinatorService _operationCoordinator;


        public WhatsAppUtilityController(
            IWhatsAppService whatsAppService,
            INotifier notifier,
            IWhatsAppSessionManager sessionManager,
            Func<int, IBrowserSession> browserSessionFactory,
            IWhatsAppUIService whatsAppUIService,
            IRetryService retryService,
            IWhatsAppSessionOptimizer sessionOptimizer,
            IWhatsAppSessionSyncService sessionSyncService,
            ApplicationDbContext dbContext,
            OperationCoordinatorService operationCoordinator)
        {
            _whatsAppService = whatsAppService;
            _notifier = notifier;
            _sessionManager = sessionManager;
            _browserSessionFactory = browserSessionFactory;
            _whatsAppUIService = whatsAppUIService;
            _retryService = retryService;
            _sessionOptimizer = sessionOptimizer;
            _sessionSyncService = sessionSyncService;
            _dbContext = dbContext;
            _operationCoordinator = operationCoordinator;
        }

        /// <summary>
        /// Checks internet connectivity
        /// </summary>
        /// <returns>Internet connectivity status</returns>
        [HttpGet("check-connectivity")]
        public async Task<ActionResult<OperationResult<bool>>> CheckConnectivity()
        {
            try
            {
                _notifier.Notify("🌐 Checking internet connectivity...");
                var result = await _whatsAppService.CheckInternetConnectivityDetailedAsync();

                if (result.Data == true)
                {
                    _notifier.Notify("✅ Internet connectivity confirmed.");
                    return Ok(result);
                }
                else
                {
                    _notifier.Notify("❌ Internet connectivity failed.");
                    return Ok(result);
                }
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Internet connectivity check failed: {ex.Message}");
                return Ok(OperationResult<bool>.Failure($"Connectivity check failed: {ex.Message}"));
            }
        }

        /// <summary>
        /// Checks if a phone number has WhatsApp
        /// </summary>
        /// <param name="phoneNumber">Phone number to check</param>
        /// <param name="moderatorUserId">Moderator user ID whose session to use</param>
        /// <param name="userId">User ID performing this operation (for audit trail)</param>
        /// <param name="cancellationToken">Cancellation token to detect client disconnection</param>
        /// <returns>WhatsApp availability status</returns>
        [HttpGet("check-whatsapp/{phoneNumber}")]
        public async Task<ActionResult<OperationResult<bool>>> CheckWhatsAppNumber(
            string phoneNumber,
            [FromQuery] int? moderatorUserId = null,
            [FromQuery] int? userId = null,
            CancellationToken cancellationToken = default)
        {
            int effectiveModeratorId = 0;
            OperationCoordinatorService? coordinator = null;
            
            try
            {
                // Check if request was already cancelled
                cancellationToken.ThrowIfCancellationRequested();

                // Validate and use moderatorUserId (REQUIRED now)
                if (!moderatorUserId.HasValue || moderatorUserId.Value <= 0)
                {
                    return BadRequest(new { error = "moderatorUserId is required and must be greater than 0" });
                }

                effectiveModeratorId = moderatorUserId.Value;

                // ✅ Phase 12: Restore from backup at START (before any operations)
                try
                {
                    await _sessionOptimizer.RestoreFromBackupAsync(effectiveModeratorId);
                }
                catch (Exception restoreEx)
                {
                    _notifier.Notify($"⚠️ [CHECK-WHATSAPP] Restore from backup failed (non-critical): {restoreEx.Message}");
                }

                // Validate: Prevent checking your own WhatsApp number
                // Get moderator's WhatsApp phone number
                var moderatorSettings = await _dbContext.Set<ModeratorSettings>()
                    .FirstOrDefaultAsync(m => m.ModeratorUserId == effectiveModeratorId);
                
                if (moderatorSettings != null && !string.IsNullOrEmpty(moderatorSettings.WhatsAppPhoneNumber))
                {
                    // Normalize phone numbers for comparison (remove all non-digit characters)
                    var normalizePhone = (string? phone) => 
                    {
                        if (string.IsNullOrEmpty(phone)) return null;
                        // Remove all non-digit characters, but keep digits
                        var digitsOnly = new string(phone.Where(char.IsDigit).ToArray());
                        return digitsOnly;
                    };
                    
                    var moderatorPhoneNormalized = normalizePhone(moderatorSettings.WhatsAppPhoneNumber);
                    var checkPhoneNormalized = normalizePhone(phoneNumber);
                    
                    // Check if the phone number being checked matches the moderator's WhatsApp phone
                    if (!string.IsNullOrEmpty(moderatorPhoneNormalized) && !string.IsNullOrEmpty(checkPhoneNormalized))
                    {
                        // Try different combinations:
                        // 1. Direct match
                        // 2. Moderator phone ends with check phone (if check phone is shorter, like without country code)
                        // 3. Check phone ends with moderator phone (if moderator phone is shorter)
                        var isOwnNumber = checkPhoneNormalized == moderatorPhoneNormalized ||
                                         (moderatorPhoneNormalized.EndsWith(checkPhoneNormalized) && 
                                          checkPhoneNormalized.Length >= 7) || // At least 7 digits match
                                         (checkPhoneNormalized.EndsWith(moderatorPhoneNormalized) &&
                                          moderatorPhoneNormalized.Length >= 7); // At least 7 digits match
                        
                        if (isOwnNumber)
                        {
                            _notifier.Notify($"❌ [Moderator {effectiveModeratorId}] Cannot check own WhatsApp number: {phoneNumber}");
                            return BadRequest(new 
                            { 
                                error = "لا يمكن التحقق من رقم الواتساب الخاص بك. واتساب لا يدعم إرسال الرسائل إلى نفس الرقم.",
                                code = "SELF_MESSAGE_NOT_SUPPORTED",
                                message = "لا يمكن التحقق من رقم الواتساب الخاص بك. واتساب لا يدعم إرسال الرسائل إلى نفس الرقم."
                            });
                        }
                    }
                }

                // Check if WhatsApp session is paused due to PendingQR (unified session per moderator)
                // This check prevents operations when authentication is required
                var hasPausedMessages = await _sessionSyncService.CheckIfSessionPausedDueToPendingQRAsync(effectiveModeratorId);
                if (hasPausedMessages)
                {
                    _notifier.Notify($"❌ [Moderator {effectiveModeratorId}] Cannot check WhatsApp - session requires authentication (PendingQR)");
                    return BadRequest(new 
                    { 
                        error = "PendingQR",
                        code = "AUTHENTICATION_REQUIRED",
                        message = "جلسة الواتساب تحتاج إلى المصادقة. يرجى المصادقة أولاً قبل التحقق من الأرقام."
                    });
                }

                _notifier.Notify($"🔍 [Moderator {effectiveModeratorId}] Checking if {phoneNumber} has WhatsApp...");

                // Wait for any current operations to complete (with 30s timeout)
                coordinator = HttpContext.RequestServices.GetRequiredService<OperationCoordinatorService>();
                var waitResult = await coordinator.WaitForCurrentOperationToFinishAsync(effectiveModeratorId, cancellationToken);
                if (!waitResult)
                {
                    _notifier.Notify($"⚠️ [CHECK-WHATSAPP] Timeout waiting for operations to finish for moderator {effectiveModeratorId}");
                }
                
                // Pause all ongoing tasks using global pause (WhatsAppSession.IsPaused)
                var pauseSuccess = await coordinator.PauseAllOngoingTasksAsync(
                    effectiveModeratorId, 
                    userId ?? effectiveModeratorId, 
                    "Check WhatsApp number");
                _notifier.Notify($"⏸️ [CHECK-WHATSAPP] Global pause {(pauseSuccess ? "activated" : "failed")} for moderator {effectiveModeratorId}");

                // Use the moderator-specific browser session
                var browserSession = await _sessionManager.GetOrCreateSessionAsync(effectiveModeratorId);
                // Check and auto-restore if session size exceeds threshold for this moderator
                try
                {
                    await _sessionOptimizer.CheckAndAutoRestoreIfNeededAsync(effectiveModeratorId);
                }
                catch (Exception optimizeEx)
                {
                    _notifier.Notify($"⚠️ Auto-restore check failed (non-critical): {optimizeEx.Message}");
                }
                // Check cancellation before starting operation
                cancellationToken.ThrowIfCancellationRequested();
                
                var result = await _whatsAppService.CheckWhatsAppNumberAsync(phoneNumber, browserSession, cancellationToken);

                // Check cancellation before disposing
                cancellationToken.ThrowIfCancellationRequested();

                if (result != null)
                {
                    if (result.IsSuccess == true)
                    {
                        _notifier.Notify($"✅ Number {phoneNumber} has WhatsApp.");
                    }
                    else if (result.IsPendingQr())
                    {
                        _notifier.Notify($"❌ WhatsApp authentication required to check number {phoneNumber}.");
                    }
                    else if (result.IsPendingNet())
                    {
                        _notifier.Notify($"❌ Internet connection unavailable to check number {phoneNumber}.");
                        // PendingNET: Pause all tasks but do NOT update database (as per requirement)
                        await coordinator.PauseAllOngoingTasksAsync(
                            effectiveModeratorId, 
                            userId ?? effectiveModeratorId, 
                            "PendingNET - Network failure");
                        _notifier.Notify($"⏸️ [CHECK-WHATSAPP] Tasks paused due to PendingNET for moderator {effectiveModeratorId}");
                    }
                    else if (result.IsPendingQr())
                    {
                        _notifier.Notify($"❌ WhatsApp authentication required to check number {phoneNumber}.");
                        // PendingQR: Pause all tasks (authentication required)
                        await coordinator.PauseAllOngoingTasksAsync(
                            effectiveModeratorId, 
                            userId ?? effectiveModeratorId, 
                            "PendingQR - Authentication required");
                        _notifier.Notify($"⏸️ [CHECK-WHATSAPP] Tasks paused due to PendingQR for moderator {effectiveModeratorId}");
                    }
                    else if (result.IsSuccess == false && result.State != OperationState.Failure)
                    {
                        _notifier.Notify($"❌ Number {phoneNumber} does not have WhatsApp.");
                    }
                    else if (result.IsWaiting())
                    {
                        _notifier.Notify($"❓ Waiting state returned when checking number {phoneNumber}.");
                    }
                }
                else
                {
                    _notifier.Notify($"❌ Unable to determine WhatsApp status for {phoneNumber}.");
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
                
                // Resume tasks that were paused for check-whatsapp
                var resumeSuccess = await coordinator.ResumeTasksPausedForReasonAsync(
                    effectiveModeratorId, 
                    "Check WhatsApp number");
                _notifier.Notify($"▶️ [CHECK-WHATSAPP] Global pause {(resumeSuccess ? "cleared" : "not cleared")} for moderator {effectiveModeratorId}");
                return Ok(result);
            }
            catch (OperationCanceledException)
            {
                _notifier.Notify($"⚠️ Request cancelled while checking WhatsApp number {phoneNumber}");
                
                // Try to resume tasks even on cancellation
                if (coordinator != null && effectiveModeratorId > 0)
                {
                    try
                    {
                        await coordinator.ResumeTasksPausedForReasonAsync(effectiveModeratorId, "Check WhatsApp number");
                    }
                    catch { /* Ignore resume errors during exception handling */ }
                }
                
                return Ok(OperationResult<bool>.Failure("Request was cancelled", false));
            }
            catch (TimeoutException tex)
            {
                _notifier.Notify($"❌ Timeout checking WhatsApp number {phoneNumber}: {tex.Message}");
                
                // Try to resume tasks even on timeout
                if (coordinator != null && effectiveModeratorId > 0)
                {
                    try
                    {
                        await coordinator.ResumeTasksPausedForReasonAsync(effectiveModeratorId, "Check WhatsApp number");
                    }
                    catch { /* Ignore resume errors during exception handling */ }
                }
                
                return Ok(OperationResult<bool>.Failure($"Timeout checking WhatsApp number: {tex.Message}"));
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Exception checking WhatsApp number {phoneNumber}: {ex.Message}");
                
                // Try to resume tasks even on error
                if (coordinator != null && effectiveModeratorId > 0)
                {
                    try
                    {
                        await coordinator.ResumeTasksPausedForReasonAsync(effectiveModeratorId, "Check WhatsApp number");
                    }
                    catch { /* Ignore resume errors during exception handling */ }
                }
                
                return Ok(OperationResult<bool>.Failure($"Error checking WhatsApp number: {ex.Message}"));
            }
        }

        /// <summary>
        /// Checks WhatsApp authentication status
        /// </summary>
        /// <param name="moderatorUserId">Moderator user ID whose session to check</param>
        /// <param name="userId">User ID performing this operation (for audit trail)</param>
        /// <returns>WhatsApp authentication status</returns>
        [HttpGet("check-authentication")]
        public async Task<ActionResult<OperationResult<bool>>> CheckAuthentication(
            [FromQuery] int? moderatorUserId = null,
            [FromQuery] int? userId = null)
        {
            int effectiveModeratorId = 0;
            OperationCoordinatorService? coordinator = null;
            bool isAlreadyPausedDueToPendingQR = false;
            
            try
            {
                // Validate and use moderatorUserId (REQUIRED now)
                if (!moderatorUserId.HasValue || moderatorUserId.Value <= 0)
                {
                    return BadRequest(new { error = "moderatorUserId is required and must be greater than 0" });
                }

                // Validate userId if provided
                if (userId.HasValue && userId.Value <= 0)
                {
                    return BadRequest(new { error = "userId must be greater than 0 if provided" });
                }

                effectiveModeratorId = moderatorUserId.Value;
                _notifier.Notify($"🔐 [AUTH CHECK] Starting - ModeratorUserId: {effectiveModeratorId}");
                
                // CRITICAL: Check if already paused due to PendingQR - if so, allow access without pausing/resuming
                isAlreadyPausedDueToPendingQR = await _sessionSyncService.CheckIfSessionPausedDueToPendingQRAsync(effectiveModeratorId);
                
                if (!isAlreadyPausedDueToPendingQR)
                {
                    // Wait for any current operations to complete (with 30s timeout)
                    coordinator = HttpContext.RequestServices.GetRequiredService<OperationCoordinatorService>();
                    var waitResult = await coordinator.WaitForCurrentOperationToFinishAsync(effectiveModeratorId);
                    if (!waitResult)
                    {
                        _notifier.Notify($"⚠️ [AUTH CHECK] Timeout waiting for operations to finish for moderator {effectiveModeratorId}");
                    }
                    
                    // Pause all ongoing tasks using global pause (WhatsAppSession.IsPaused)
                    var pauseSuccess = await coordinator.PauseAllOngoingTasksAsync(
                        effectiveModeratorId, 
                        userId ?? effectiveModeratorId, 
                        "Authentication check");
                    _notifier.Notify($"⏸️ [AUTH CHECK] Global pause {(pauseSuccess ? "activated" : "failed")} for moderator {effectiveModeratorId}");
                }
                else
                {
                    _notifier.Notify($"⚠️ [AUTH CHECK] System already paused due to PendingQR - allowing authentication check without additional pause/resume");
                    coordinator = HttpContext.RequestServices.GetRequiredService<OperationCoordinatorService>();
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
                
                // Get the moderator-specific session
                var browserSession = await _sessionManager.GetOrCreateSessionAsync(effectiveModeratorId);
                await browserSession.InitializeAsync();
                
                var url = WhatsAppConfiguration.WhatsAppBaseUrl;
                _notifier.Notify($"🔗 [AUTH CHECK] Navigating to {url}...");
                await browserSession.NavigateToAsync(url);

                var waitUIResult = await _whatsAppUIService.WaitForPageLoadAsync(browserSession, WhatsAppConfiguration.ChatUIReadySelectors);
                _notifier.Notify($"📊 [AUTH CHECK] UI Result - Success: {waitUIResult.IsSuccess}, State: {waitUIResult.State}");

                // Sync database status based on authentication result
                if (waitUIResult.IsSuccess == true && waitUIResult.State == OperationState.Success)
                {
                    _notifier.Notify($"✅ [AUTH CHECK] Already authenticated - Updating DB for moderator {effectiveModeratorId}");
                    
                    // Update database: connected (track which user performed the check)
                    await _sessionSyncService.UpdateSessionStatusAsync(effectiveModeratorId, "connected", DateTime.UtcNow, activityUserId: userId ?? effectiveModeratorId);
                    _notifier.Notify($"💾 [AUTH CHECK] Database updated: ModeratorUserId={effectiveModeratorId}, Status=connected, ActivityUserId={userId ?? effectiveModeratorId}");
                }
                else if (waitUIResult.IsPendingQr())
                {
                    _notifier.Notify($"⚠️ [AUTH CHECK] Pending authentication - Updating DB for moderator {effectiveModeratorId}");
                    
                    // PendingQR: Keep tasks paused (authentication required)
                    // Note: Tasks were already paused at the beginning of this endpoint
                    _notifier.Notify($"⏸️ [AUTH CHECK] Tasks remain paused due to PendingQR for moderator {effectiveModeratorId}");
                    
                    // Update database: pending (track which user performed the check)
                    await _sessionSyncService.UpdateSessionStatusAsync(effectiveModeratorId, "pending", activityUserId: userId ?? effectiveModeratorId);
                    _notifier.Notify($"💾 [AUTH CHECK] Database updated: ModeratorUserId={effectiveModeratorId}, Status=pending, ActivityUserId={userId ?? effectiveModeratorId}");
                }
                else if (waitUIResult.IsPendingNet())
                {
                    _notifier.Notify($"⚠️ [AUTH CHECK] Network failure detected for moderator {effectiveModeratorId}");
                    
                    // PendingNET: Keep tasks paused but do NOT update database (as per requirement)
                    _notifier.Notify($"⏸️ [AUTH CHECK] Tasks remain paused due to PendingNET, database NOT updated for moderator {effectiveModeratorId}");
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
                
                // Resume tasks that were paused for authentication check (only if we paused them, not if already paused due to PendingQR)
                if (!isAlreadyPausedDueToPendingQR)
                {
                    var resumeSuccess = await coordinator.ResumeTasksPausedForReasonAsync(
                        effectiveModeratorId, 
                        "Authentication check");
                    _notifier.Notify($"▶️ [AUTH CHECK] Global pause {(resumeSuccess ? "cleared" : "not cleared")} for moderator {effectiveModeratorId}");
                }
                else
                {
                    _notifier.Notify($"⚠️ [AUTH CHECK] System remains paused due to PendingQR - not resuming tasks");
                }
                
                return Ok(waitUIResult);
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ [AUTH CHECK] Exception: {ex.Message}");
                _notifier.Notify($"❌ [AUTH CHECK] Stack trace: {ex.StackTrace}");
                
                // Try to resume tasks even on error (only if we paused them, not if already paused due to PendingQR)
                if (coordinator != null && effectiveModeratorId > 0 && !isAlreadyPausedDueToPendingQR)
                {
                    try
                    {
                        await coordinator.ResumeTasksPausedForReasonAsync(effectiveModeratorId, "Authentication check");
                    }
                    catch { /* Ignore resume errors during exception handling */ }
                }
                
                return Ok(OperationResult<bool>.Failure($"Authentication check failed: {ex.Message}"));
            }
        }

        /// <summary>
        /// Authenticates WhatsApp session by waiting for QR code scan
        /// </summary>
        /// <param name="moderatorUserId">Moderator user ID whose session to use</param>
        /// <param name="userId">User ID performing this operation (for audit trail)</param>
        /// <param name="cancellationToken">Cancellation token to detect client disconnection</param>
        /// <returns>WhatsApp authentication result</returns>
        [HttpPost("authenticate")]
        public async Task<ActionResult<OperationResult<bool>>> Authenticate(
            [FromQuery] int? moderatorUserId = null,
            [FromQuery] int? userId = null,
            CancellationToken cancellationToken = default)
        {
            try
            {
                // Check if request was already cancelled
                cancellationToken.ThrowIfCancellationRequested();

                // Validate and use moderatorUserId (REQUIRED now)
                if (!moderatorUserId.HasValue || moderatorUserId.Value <= 0)
                {
                    return BadRequest(new { error = "moderatorUserId is required and must be greater than 0" });
                }

                // Validate userId if provided
                if (userId.HasValue && userId.Value <= 0)
                {
                    return BadRequest(new { error = "userId must be greater than 0 if provided" });
                }

                int effectiveModeratorId = moderatorUserId.Value;
                // Check and auto-restore if session size exceeds threshold for this moderator
                try
                {
                    await _sessionOptimizer.CheckAndAutoRestoreIfNeededAsync(effectiveModeratorId);
                }
                catch (Exception optimizeEx)
                {
                    _notifier.Notify($"⚠️ Auto-restore check failed (non-critical): {optimizeEx.Message}");
                }
                _notifier.Notify($"🔐 [AUTHENTICATE] Starting - ModeratorUserId: {effectiveModeratorId}");

                // Use the moderator-specific session
                var browserSession = await _sessionManager.GetOrCreateSessionAsync(effectiveModeratorId);
                await browserSession.InitializeAsync();

                var url = WhatsAppConfiguration.WhatsAppBaseUrl;
                _notifier.Notify($"🔗 [AUTHENTICATE] Navigating to {url}...");
                await browserSession.NavigateToAsync(url);

                // First quick pass: check if already authenticated (ChatUI present)
                var initial = await _whatsAppUIService.WaitForPageLoadAsync(browserSession, WhatsAppConfiguration.ChatUIReadySelectors);
                _notifier.Notify($"📊 [AUTHENTICATE] Initial check - Success: {initial.IsSuccess}, State: {initial.State}");
                
                if (initial.IsSuccess == true)
                {
                    _notifier.Notify($"✅ [AUTHENTICATE] Already authenticated - Updating DB for moderator {effectiveModeratorId}");
                    
                    // Update database: connected (track which user performed authentication)
                    await _sessionSyncService.UpdateSessionStatusAsync(effectiveModeratorId, "connected", DateTime.UtcNow, activityUserId: userId ?? effectiveModeratorId);
                    _notifier.Notify($"💾 [AUTHENTICATE] Database updated: ModeratorUserId={effectiveModeratorId}, Status=connected, ActivityUserId={userId ?? effectiveModeratorId}");
                    
                    // CRITICAL: Optimize session and create backup after successful authentication
                    // This ensures a backup is created even when already authenticated
                    try
                    {
                        await _sessionOptimizer.OptimizeAuthenticatedSessionAsync(effectiveModeratorId);
                        _notifier.Notify($"✅ [AUTHENTICATE] Session optimized and backup created for moderator {effectiveModeratorId}");
                    }
                    catch (Exception optimizeEx)
                    {
                        _notifier.Notify($"⚠️ [AUTHENTICATE] Session optimization/backup failed (non-critical): {optimizeEx.Message}");
                    }
                    
                    return Ok(OperationResult<bool>.Success(true));
                }

                if (initial.IsPendingNet())
                {
                    _notifier.Notify("❌ Internet connection issue detected during authentication check.");
                    
                    // Dispose browser session on PendingNET
                    try
                    {
                        await _sessionManager.DisposeSessionAsync(effectiveModeratorId);
                        _notifier.Notify($"🗑️ [AUTHENTICATE] Browser session disposed due to PendingNET");
                    }
                    catch (Exception disposeEx)
                    {
                        _notifier.Notify($"⚠️ [AUTHENTICATE] Failed to dispose browser session (non-critical): {disposeEx.Message}");
                    }
                    
                    return Ok(OperationResult<bool>.PendingNET(initial.ResultMessage ?? "Internet connection unavailable"));
                }

                // If we reached here, authentication is required (QR) or ambiguous. If initial check detected QR,
                // wait for the user to scan and authenticate for a reasonable period (DefaultAuthenticationWaitMs).
                _notifier.Notify("⏳ Waiting for user to scan QR and for authentication to complete...");

                // If initial state shows PendingQR, give the user some time to scan the QR
                if (initial.IsPendingQr())
                {
                    // Check cancellation before long wait
                    cancellationToken.ThrowIfCancellationRequested();

                    var totalMs = WhatsAppConfiguration.DefaultAuthenticationWaitMs;
                    var intervalMs = WhatsAppConfiguration.defaultChecksFrequencyDelayMs;
                    _notifier.Notify($"🔔 Authentication pending - will wait up to {totalMs / 1000} seconds for user action.");

                    var start = DateTime.UtcNow;
                    var timeout = TimeSpan.FromMilliseconds(totalMs);
                    try
                    {
                        while (DateTime.UtcNow - start < timeout)
                        {
                            // Check if cancelled during wait
                            cancellationToken.ThrowIfCancellationRequested();

                            // Check success condition: any ChatUI selector is present
                            foreach (var selector in WhatsAppConfiguration.ChatUIReadySelectors ?? Array.Empty<string>())
                            {
                                try
                                {
                                    var element = await browserSession.QuerySelectorAsync(selector);
                                    if (element != null)
                                    {
                                        _notifier.Notify($"✅ [AUTHENTICATE] QR scanned successfully - Chat UI detected - Updating DB for moderator {effectiveModeratorId}");
                                        
                                        // Update database: connected (track which user completed authentication)
                                        await _sessionSyncService.UpdateSessionStatusAsync(effectiveModeratorId, "connected", DateTime.UtcNow, activityUserId: userId ?? effectiveModeratorId);
                                        _notifier.Notify($"💾 [AUTHENTICATE] Database updated: ModeratorUserId={effectiveModeratorId}, Status=connected, ActivityUserId={userId ?? effectiveModeratorId}");
                                        
                                        // CRITICAL: Optimize session and create backup after successful authentication
                                        // OptimizeAuthenticatedSessionAsync already disposes the browser session internally
                                        try
                                        {
                                            await _sessionOptimizer.OptimizeAuthenticatedSessionAsync(effectiveModeratorId);
                                            _notifier.Notify($"✅ [AUTHENTICATE] Session optimized and backup created after QR scan for moderator {effectiveModeratorId}");
                                        }
                                        catch (Exception optimizeEx)
                                        {
                                            _notifier.Notify($"⚠️ [AUTHENTICATE] Session optimization/backup failed (non-critical): {optimizeEx.Message}");
                                        }
                                        
                                        return Ok(OperationResult<bool>.Success(true));
                                    }
                                }
                                catch (Exception ex)
                                {
                                    if (_retryService.IsBrowserClosedException(ex))
                                    {
                                        _notifier.Notify("⚠️ Browser closed intentionally detected during authentication.");
                                        // Pause all ongoing tasks (don't fail them)
                                        if (moderatorUserId.HasValue && userId.HasValue)
                                        {
                                            await _operationCoordinator.PauseAllOngoingTasksAsync(
                                                moderatorUserId.Value,
                                                userId.Value,
                                                "Browser closed intentionally",
                                                cancellationToken);
                                        }
                                        // Dispose browser session on browser closure
                                        try
                                        {
                                            await _sessionManager.DisposeSessionAsync(effectiveModeratorId);
                                            _notifier.Notify($"🗑️ [AUTHENTICATE] Browser session disposed due to browser closure");
                                        }
                                        catch (Exception disposeEx)
                                        {
                                            _notifier.Notify($"⚠️ [AUTHENTICATE] Failed to dispose browser session (non-critical): {disposeEx.Message}");
                                        }
                                        
                                        // Return warning status (not error)
                                        return Ok(OperationResult<bool>.Warning("تم إغلاق المتصفح بشكل متعمد. تم إيقاف جميع المهام الجارية مؤقتًا."));
                                    }
                                    _notifier.Notify($"⚠️ Error checking Chat UI selector {selector}: {ex.Message}");
                                }
                            }

                            // Run continuous monitoring to detect progress bars, QR presence and network state
                            OperationResult<bool>? monitoringResult = null;
                            if (_whatsAppUIService is Services.Domain.WhatsAppUIService concreteMonitor)
                            {
                                monitoringResult = await concreteMonitor.ContinuousMonitoringAsync(browserSession, intervalMs, totalMs);
                            }
                            else
                            {
                                _notifier.Notify("⚠️ Monitoring not available on current UI service implementation.");
                            }
                            if (monitoringResult != null)
                            {
                                if (monitoringResult.IsPendingNet())
                                {
                                    _notifier.Notify("❌ Authentication interrupted due to network issues during wait.");
                                    
                                    // Dispose browser session on PendingNET
                                    try
                                    {
                                        await _sessionManager.DisposeSessionAsync(effectiveModeratorId);
                                        _notifier.Notify($"🗑️ [AUTHENTICATE] Browser session disposed due to PendingNET");
                                    }
                                    catch (Exception disposeEx)
                                    {
                                        _notifier.Notify($"⚠️ [AUTHENTICATE] Failed to dispose browser session (non-critical): {disposeEx.Message}");
                                    }
                                    
                                    return Ok(OperationResult<bool>.PendingNET(monitoringResult.ResultMessage ?? "Internet connection unavailable"));
                                }
                                if (monitoringResult.IsWaiting())
                                {
                                    // Progress bar didn't disappear in the monitoring window
                                    _notifier.Notify($"⚠️ Authentication still in progress: {monitoringResult.ResultMessage}");
                                    return Ok(OperationResult<bool>.Waiting(monitoringResult.ResultMessage));
                                }
                                if (monitoringResult.IsPendingQr())
                                {
                                    // Still on QR, continue waiting until timeout
                                    _notifier.Notify($"⏳ Still waiting for QR scan: {monitoringResult.ResultMessage}");
                                }
                                else if (monitoringResult.IsSuccess == true)
                                {
                                    _notifier.Notify("✅ Authentication completed (monitoring detected success).");
                                    
                                    // CRITICAL: Optimize session and create backup after successful authentication
                                    // OptimizeAuthenticatedSessionAsync already disposes the browser session internally
                                    try
                                    {
                                        await _sessionOptimizer.OptimizeAuthenticatedSessionAsync(effectiveModeratorId);
                                        _notifier.Notify($"✅ [AUTHENTICATE] Session optimized and backup created (monitoring) for moderator {effectiveModeratorId}");
                                    }
                                    catch (Exception optimizeEx)
                                    {
                                        _notifier.Notify($"⚠️ [AUTHENTICATE] Session optimization/backup failed (non-critical): {optimizeEx.Message}");
                                    }
                                    
                                    return Ok(OperationResult<bool>.Success(true));
                                }
                                else if (monitoringResult.IsSuccess == false)
                                {
                                    _notifier.Notify($"❌ Monitoring reported failure: {monitoringResult.ResultMessage}");
                                    return Ok(OperationResult<bool>.Failure(monitoringResult.ResultMessage ?? "Authentication failed during monitoring"));
                                }
                            }

                            // Send periodic progress notification (percent/time left)
                            var elapsed = DateTime.UtcNow - start;
                            var remaining = timeout - elapsed;
                            var pct = Math.Min(100, (int)((elapsed.TotalMilliseconds / totalMs) * 100));
                            if (remaining.TotalSeconds > 0)
                                _notifier.Notify($"⏳ Waiting for QR scan... {pct}% ({(int)remaining.TotalSeconds}s left)");

                            await Task.Delay(Math.Max(250, intervalMs));
                        }

                        // Timed out waiting for QR scan
                        _notifier.Notify("❌ Authentication failed or timed out: still on QR page after wait period.");
                        
                        // Dispose browser session on timeout
                        try
                        {
                            await _sessionManager.DisposeSessionAsync(effectiveModeratorId);
                            _notifier.Notify($"🗑️ [AUTHENTICATE] Browser session disposed due to timeout");
                        }
                        catch (Exception disposeEx)
                        {
                            _notifier.Notify($"⚠️ [AUTHENTICATE] Failed to dispose browser session (non-critical): {disposeEx.Message}");
                        }
                        
                        return Ok(OperationResult<bool>.Failure("Authentication failed: still on QR page after wait period."));
                    }
                    catch (Exception ex)
                    {
                        if (_retryService.IsBrowserClosedException(ex))
                        {
                            _notifier.Notify("⚠️ Browser closed intentionally detected during authentication.");
                            // Pause all ongoing tasks (don't fail them)
                            if (moderatorUserId.HasValue && userId.HasValue)
                            {
                                await _operationCoordinator.PauseAllOngoingTasksAsync(
                                    moderatorUserId.Value,
                                    userId.Value,
                                    "Browser closed intentionally",
                                    cancellationToken);
                            }
                            // Dispose browser session on browser closure
                            try
                            {
                                await _sessionManager.DisposeSessionAsync(effectiveModeratorId);
                                _notifier.Notify($"🗑️ [AUTHENTICATE] Browser session disposed due to browser closure");
                            }
                            catch (Exception disposeEx)
                            {
                                _notifier.Notify($"⚠️ [AUTHENTICATE] Failed to dispose browser session (non-critical): {disposeEx.Message}");
                            }
                            
                            // Return warning status (not error)
                            return Ok(OperationResult<bool>.Warning("تم إغلاق المتصفح بشكل متعمد. تم إيقاف جميع المهام الجارية مؤقتًا."));
                        }
                        _notifier.Notify($"❌ Exception while waiting for QR scan: {ex.Message}");
                        
                        // Dispose browser session on exception
                        try
                        {
                            await _sessionManager.DisposeSessionAsync(effectiveModeratorId);
                            _notifier.Notify($"🗑️ [AUTHENTICATE] Browser session disposed due to exception");
                        }
                        catch (Exception disposeEx)
                        {
                            _notifier.Notify($"⚠️ [AUTHENTICATE] Failed to dispose browser session (non-critical): {disposeEx.Message}");
                        }
                        
                        return Ok(OperationResult<bool>.Failure($"Authentication failed: {ex.Message}"));
                    }
                }

                // Otherwise, proceed to monitor until a longer default monitoring timeout (progress/transition)
                var waitForAuth = await _whatsAppUIService.WaitWithMonitoringAsync(browserSession, async () =>
                {
                    foreach (var selector in WhatsAppConfiguration.ChatUIReadySelectors ?? Array.Empty<string>())
                    {
                        var element = await browserSession.QuerySelectorAsync(selector);
                        if (element != null)
                            return true;
                    }
                    return false;
                }, WhatsAppConfiguration.DefaultMaxMonitoringWaitMs, WhatsAppConfiguration.defaultChecksFrequencyDelayMs);

                if (waitForAuth.IsSuccess == true)
                {
                    _notifier.Notify("✅ Authentication completed: Chat UI detected.");
                    
                    // CRITICAL: Optimize session and create backup after successful authentication
                    // OptimizeAuthenticatedSessionAsync already disposes the browser session internally
                    try
                    {
                        await _sessionOptimizer.OptimizeAuthenticatedSessionAsync(effectiveModeratorId);
                        _notifier.Notify($"✅ [AUTHENTICATE] Session optimized and backup created (waitForAuth) for moderator {effectiveModeratorId}");
                    }
                    catch (Exception optimizeEx)
                    {
                        _notifier.Notify($"⚠️ [AUTHENTICATE] Session optimization/backup failed (non-critical): {optimizeEx.Message}");
                    }
                    
                    return Ok(OperationResult<bool>.Success(true));
                }

                // If monitoring detected a QR (came back to QR) that's a failed authentication attempt
                if (waitForAuth.IsPendingQr())
                {
                    _notifier.Notify("❌ Authentication failed: returned to QR code page after progress.");
                    
                    // Dispose browser session on failure
                    try
                    {
                        await _sessionManager.DisposeSessionAsync(effectiveModeratorId);
                        _notifier.Notify($"🗑️ [AUTHENTICATE] Browser session disposed due to authentication failure");
                    }
                    catch (Exception disposeEx)
                    {
                        _notifier.Notify($"⚠️ [AUTHENTICATE] Failed to dispose browser session (non-critical): {disposeEx.Message}");
                    }
                    
                    return Ok(OperationResult<bool>.Failure("Authentication failed: returned to QR code page after progress."));
                }

                if (waitForAuth.IsPendingNet())
                {
                    _notifier.Notify("❌ Authentication interrupted due to network issues.");
                    
                    // Dispose browser session on PendingNET
                    try
                    {
                        await _sessionManager.DisposeSessionAsync(effectiveModeratorId);
                        _notifier.Notify($"🗑️ [AUTHENTICATE] Browser session disposed due to PendingNET");
                    }
                    catch (Exception disposeEx)
                    {
                        _notifier.Notify($"⚠️ [AUTHENTICATE] Failed to dispose browser session (non-critical): {disposeEx.Message}");
                    }
                    
                    return Ok(OperationResult<bool>.PendingNET(waitForAuth.ResultMessage ?? "Internet connection unavailable"));
                }

                if (waitForAuth.IsWaiting())
                {
                    _notifier.Notify($"⚠️ Authentication still in progress after timeout: {waitForAuth.ResultMessage}");
                    return Ok(OperationResult<bool>.Waiting(waitForAuth.ResultMessage));
                }

                // Any other failure
                _notifier.Notify($"❌ Authentication failed: {waitForAuth.ResultMessage}");
                
                // Dispose browser session on failure
                try
                {
                    await _sessionManager.DisposeSessionAsync(effectiveModeratorId);
                    _notifier.Notify($"🗑️ [AUTHENTICATE] Browser session disposed due to authentication failure");
                }
                catch (Exception disposeEx)
                {
                    _notifier.Notify($"⚠️ [AUTHENTICATE] Failed to dispose browser session (non-critical): {disposeEx.Message}");
                }
                
                return Ok(OperationResult<bool>.Failure(waitForAuth.ResultMessage ?? "Authentication failed"));
            }
            catch (Exception ex)
            {
                if (_retryService.IsBrowserClosedException(ex))
                {
                    _notifier.Notify("⚠️ Browser closed intentionally detected during authentication.");
                    // Pause all ongoing tasks (don't fail them)
                    if (moderatorUserId.HasValue && userId.HasValue)
                    {
                        await _operationCoordinator.PauseAllOngoingTasksAsync(
                            moderatorUserId.Value,
                            userId.Value,
                            "Browser closed intentionally",
                            cancellationToken);
                    }
                    
                    // Dispose browser session on browser closure
                    if (moderatorUserId.HasValue)
                    {
                        try
                        {
                            await _sessionManager.DisposeSessionAsync(moderatorUserId.Value);
                            _notifier.Notify($"🗑️ [AUTHENTICATE] Browser session disposed due to browser closure");
                        }
                        catch (Exception disposeEx)
                        {
                            _notifier.Notify($"⚠️ [AUTHENTICATE] Failed to dispose browser session (non-critical): {disposeEx.Message}");
                        }
                    }
                    
                    // Return warning status (not error)
                    return Ok(OperationResult<bool>.Warning("تم إغلاق المتصفح بشكل متعمد. تم إيقاف جميع المهام الجارية مؤقتًا."));
                }

                _notifier.Notify($"❌ Exception during authentication check: {ex.Message}");
                
                // Dispose browser session on exception
                if (moderatorUserId.HasValue)
                {
                    try
                    {
                        await _sessionManager.DisposeSessionAsync(moderatorUserId.Value);
                        _notifier.Notify($"🗑️ [AUTHENTICATE] Browser session disposed due to exception");
                    }
                    catch (Exception disposeEx)
                    {
                        _notifier.Notify($"⚠️ [AUTHENTICATE] Failed to dispose browser session (non-critical): {disposeEx.Message}");
                    }
                }
                
                return Ok(OperationResult<bool>.Failure($"Authentication check failed: {ex.Message}"));
            }
        }

        /// <summary>
        /// Get browser status for a moderator
        /// </summary>
        /// <param name="moderatorUserId">Moderator user ID</param>
        /// <returns>Browser status information</returns>
        [HttpGet("browser/status")]
        public async Task<ActionResult> GetBrowserStatus([FromQuery] int? moderatorUserId = null)
        {
            try
            {
                // Validate moderatorUserId
                if (!moderatorUserId.HasValue || moderatorUserId.Value <= 0)
                {
                    return BadRequest(new { success = false, error = "moderatorUserId is required and must be greater than 0" });
                }

                int effectiveModeratorId = moderatorUserId.Value;

                // Check if session exists
                var session = await _sessionManager.GetCurrentSessionAsync(effectiveModeratorId);
                
                if (session == null)
                {
                    return Ok(new 
                    { 
                        success = true, 
                        data = new 
                        {
                            isActive = false,
                            isHealthy = false,
                            currentUrl = (string?)null,
                            lastAction = (string?)null,
                            sessionAge = (string?)null,
                            isAuthenticated = false,
                            lastUpdated = (DateTime?)null
                        }
                    });
                }

                // Get browser status from session
                string? currentUrl = null;
                bool isHealthy = false;
                bool isAuthenticated = false;

                try
                {
                    currentUrl = await session.GetUrlAsync();
                    // Only check for blank pages, not URL content (WhatsApp may show base URL even when on chat)
                    isHealthy = !string.IsNullOrWhiteSpace(currentUrl) 
                        && currentUrl != "about:blank";
                    
                    // Check authentication status by looking for ChatUI selectors
                    foreach (var selector in WhatsAppConfiguration.ChatUIReadySelectors)
                    {
                        try
                        {
                            var element = await session.QuerySelectorAsync(selector);
                            if (element != null)
                            {
                                isAuthenticated = true;
                                break;
                            }
                        }
                        catch { }
                    }
                }
                catch (Exception ex)
                {
                    _notifier.Notify($"⚠️ Error getting browser status: {ex.Message}");
                    // Continue with default values
                }

                // Get database session info
                var dbSession = await _sessionSyncService.GetSessionStatusAsync(effectiveModeratorId);
                var sessionAge = dbSession?.CreatedAt != null 
                    ? DateTime.UtcNow - dbSession.CreatedAt 
                    : (TimeSpan?)null;

                var result = new
                {
                    isActive = true,
                    isHealthy = isHealthy,
                    currentUrl = currentUrl,
                    lastAction = "نشط", // Default, can be enhanced later with action tracking
                    sessionAge = sessionAge.HasValue ? FormatTimeSpan(sessionAge.Value) : (string?)null,
                    isAuthenticated = isAuthenticated,
                    lastUpdated = DateTime.UtcNow
                };

                return Ok(new { success = true, data = result });
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Error getting browser status: {ex.Message}");
                return StatusCode(500, new { success = false, error = $"حدث خطأ أثناء جلب حالة المتصفح: {ex.Message}" });
            }
        }

        /// <summary>
        /// Get browser status for all moderators (Admin only)
        /// </summary>
        /// <returns>List of browser status for all moderators</returns>
        [HttpGet("browser/status/all")]
        public async Task<ActionResult> GetAllModeratorsBrowserStatus()
        {
            try
            {
                // Get all moderators from database
                var moderators = await _dbContext.Users
                    .Where(u => u.Role == "moderator" && !u.IsDeleted)
                    .ToListAsync();

                var statusList = new List<object>();

                foreach (var moderator in moderators)
                {
                    try
                    {
                        // Check if session exists
                        var session = await _sessionManager.GetCurrentSessionAsync(moderator.Id);
                        
                        bool isActive = session != null;
                        bool isHealthy = false;
                        string? currentUrl = null;
                        bool isAuthenticated = false;

                        if (session != null)
                        {
                            try
                            {
                                currentUrl = await session.GetUrlAsync();
                                // Only check for blank pages, not URL content (WhatsApp may show base URL even when on chat)
                                isHealthy = !string.IsNullOrWhiteSpace(currentUrl) 
                                    && currentUrl != "about:blank";
                                
                                // Check authentication status
                                foreach (var selector in WhatsAppConfiguration.ChatUIReadySelectors)
                                {
                                    try
                                    {
                                        var element = await session.QuerySelectorAsync(selector);
                                        if (element != null)
                                        {
                                            isAuthenticated = true;
                                            break;
                                        }
                                    }
                                    catch { }
                                }
                            }
                            catch (Exception ex)
                            {
                                _notifier.Notify($"⚠️ Error getting browser status for moderator {moderator.Id}: {ex.Message}");
                            }
                        }

                        // Get database session info
                        var dbSession = await _sessionSyncService.GetSessionStatusAsync(moderator.Id);
                        var sessionAge = dbSession?.CreatedAt != null 
                            ? DateTime.UtcNow - dbSession.CreatedAt 
                            : (TimeSpan?)null;

                        statusList.Add(new
                        {
                            moderatorId = moderator.Id,
                            moderatorName = moderator.FullName,
                            moderatorUsername = moderator.Username,
                            isActive = isActive,
                            isHealthy = isHealthy,
                            currentUrl = currentUrl,
                            lastAction = "نشط", // Default
                            sessionAge = sessionAge.HasValue ? FormatTimeSpan(sessionAge.Value) : (string?)null,
                            isAuthenticated = isAuthenticated,
                            lastUpdated = DateTime.UtcNow
                        });
                    }
                    catch (Exception ex)
                    {
                        _notifier.Notify($"⚠️ Error processing moderator {moderator.Id}: {ex.Message}");
                        // Continue with other moderators
                        statusList.Add(new
                        {
                            moderatorId = moderator.Id,
                            moderatorName = moderator.FullName,
                            moderatorUsername = moderator.Username,
                            isActive = false,
                            isHealthy = false,
                            currentUrl = (string?)null,
                            lastAction = (string?)null,
                            sessionAge = (string?)null,
                            isAuthenticated = false,
                            lastUpdated = (DateTime?)null,
                            error = ex.Message
                        });
                    }
                }

                return Ok(new { success = true, data = statusList });
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Error getting all moderators browser status: {ex.Message}");
                return StatusCode(500, new { success = false, error = $"حدث خطأ أثناء جلب حالة المتصفحات: {ex.Message}" });
            }
        }

        /// <summary>
        /// Refresh browser status for a moderator
        /// </summary>
        /// <param name="moderatorUserId">Moderator user ID</param>
        /// <returns>Success response</returns>
        [HttpPost("browser/refresh")]
        public async Task<ActionResult> RefreshBrowserStatus([FromQuery] int? moderatorUserId = null)
        {
            try
            {
                // Validate moderatorUserId
                if (!moderatorUserId.HasValue || moderatorUserId.Value <= 0)
                {
                    return BadRequest(new { success = false, error = "moderatorUserId is required and must be greater than 0" });
                }

                int effectiveModeratorId = moderatorUserId.Value;

                // Get session and refresh by navigating to WhatsApp base URL
                var session = await _sessionManager.GetOrCreateSessionAsync(effectiveModeratorId);
                await session.InitializeAsync();
                
                var url = WhatsAppConfiguration.WhatsAppBaseUrl;
                _notifier.Notify($"🔄 Refreshing browser session for moderator {effectiveModeratorId}...");
                await session.NavigateToAsync(url);

                // Wait a bit for page to load
                await Task.Delay(2000);

                // Check authentication status
                var waitResult = await _whatsAppUIService.WaitForPageLoadAsync(session, WhatsAppConfiguration.ChatUIReadySelectors);
                
                if (waitResult.IsSuccess == true)
                {
                    await _sessionSyncService.UpdateSessionStatusAsync(effectiveModeratorId, "connected", DateTime.UtcNow);
                }
                else if (waitResult.IsPendingQr())
                {
                    await _sessionSyncService.UpdateSessionStatusAsync(effectiveModeratorId, "pending");
                }
                else
                {
                    await _sessionSyncService.UpdateSessionStatusAsync(effectiveModeratorId, "disconnected");
                }

                return Ok(new { success = true, message = "تم تحديث حالة المتصفح بنجاح" });
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Error refreshing browser status: {ex.Message}");
                return StatusCode(500, new { success = false, error = $"حدث خطأ أثناء تحديث حالة المتصفح: {ex.Message}" });
            }
        }

        /// <summary>
        /// Close browser session for a moderator
        /// </summary>
        /// <param name="moderatorUserId">Moderator user ID</param>
        /// <returns>Success response</returns>
        [HttpPost("browser/close")]
        public async Task<ActionResult> CloseBrowserSession([FromQuery] int? moderatorUserId = null)
        {
            try
            {
                // Validate moderatorUserId
                if (!moderatorUserId.HasValue || moderatorUserId.Value <= 0)
                {
                    return BadRequest(new { success = false, error = "moderatorUserId is required and must be greater than 0" });
                }

                int effectiveModeratorId = moderatorUserId.Value;

                _notifier.Notify($"🚪 Closing browser session for moderator {effectiveModeratorId}...");
                
                // Dispose session
                await _sessionManager.DisposeSessionAsync(effectiveModeratorId);
                
                // Update database status
                await _sessionSyncService.UpdateSessionStatusAsync(effectiveModeratorId, "disconnected");

                return Ok(new { success = true, message = "تم إغلاق المتصفح بنجاح" });
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Error closing browser session: {ex.Message}");
                return StatusCode(500, new { success = false, error = $"حدث خطأ أثناء إغلاق المتصفح: {ex.Message}" });
            }
        }

        /// <summary>
        /// Get QR code screenshot for authentication
        /// </summary>
        /// <param name="moderatorUserId">Moderator user ID</param>
        /// <returns>QR code image as base64</returns>
        [HttpGet("qr-code")]
        public async Task<ActionResult> GetQRCode([FromQuery] int? moderatorUserId = null)
        {
            try
            {
                // Validate moderatorUserId
                if (!moderatorUserId.HasValue || moderatorUserId.Value <= 0)
                {
                    return BadRequest(new { success = false, error = "moderatorUserId is required and must be greater than 0" });
                }

                int effectiveModeratorId = moderatorUserId.Value;

                // Get session
                var session = await _sessionManager.GetOrCreateSessionAsync(effectiveModeratorId);
                await session.InitializeAsync();

                // Navigate to WhatsApp base URL if not already there
                var currentUrl = await session.GetUrlAsync();
                if (!currentUrl.Contains("web.whatsapp.com"))
                {
                    await session.NavigateToAsync(WhatsAppConfiguration.WhatsAppBaseUrl);
                    await Task.Delay(2000); // Wait for page to load
                }

                // Find QR code element
                IElementHandle? qrCodeElement = null;
                foreach (var selector in WhatsAppConfiguration.QrCodeSelectors)
                {
                    try
                    {
                        var element = await session.QuerySelectorAsync(selector);
                        if (element != null)
                        {
                            qrCodeElement = element;
                            break;
                        }
                    }
                    catch { }
                }

                if (qrCodeElement == null)
                {
                    return NotFound(new { success = false, error = "رمز QR غير موجود. قد تكون الجلسة مصادقة بالفعل." });
                }

                // Take screenshot of QR code element
                try
                {
                    var screenshotBytes = await session.ScreenshotElementAsync(qrCodeElement);
                    if (screenshotBytes != null && screenshotBytes.Length > 0)
                    {
                        // Convert to base64 for JSON response
                        var base64Image = Convert.ToBase64String(screenshotBytes);
                        return Ok(new 
                        { 
                            success = true, 
                            data = new 
                            {
                                qrCodeImage = base64Image,
                                format = "image/png"
                            }
                        });
                    }
                }
                catch (Exception screenshotEx)
                {
                    _notifier.Notify($"⚠️ Error taking QR code screenshot: {screenshotEx.Message}");
                    // Fall through to return error
                }
                
                return NotFound(new { success = false, error = "فشل التقاط صورة رمز QR" });
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Error getting QR code: {ex.Message}");
                return StatusCode(500, new { success = false, error = $"حدث خطأ أثناء جلب رمز QR: {ex.Message}" });
            }
        }

        /// <summary>
        /// Helper method to format TimeSpan to readable Arabic string
        /// </summary>
        private static string FormatTimeSpan(TimeSpan timeSpan)
        {
            if (timeSpan.TotalDays >= 1)
                return $"{(int)timeSpan.TotalDays} يوم";
            if (timeSpan.TotalHours >= 1)
                return $"{(int)timeSpan.TotalHours} ساعة";
            if (timeSpan.TotalMinutes >= 1)
                return $"{(int)timeSpan.TotalMinutes} دقيقة";
            return $"{(int)timeSpan.TotalSeconds} ثانية";
        }
    }
}