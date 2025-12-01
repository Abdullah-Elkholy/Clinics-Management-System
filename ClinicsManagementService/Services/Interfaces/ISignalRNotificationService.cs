namespace ClinicsManagementService.Services.Interfaces
{
    /// <summary>
    /// Service for notifying the main API about WhatsAppSession updates via HTTP
    /// The main API will then broadcast these updates via SignalR
    /// </summary>
    public interface ISignalRNotificationService
    {
        /// <summary>
        /// Notify the main API that a WhatsAppSession has been updated
        /// </summary>
        /// <param name="moderatorUserId">The moderator user ID</param>
        /// <param name="status">Session status (connected, disconnected, pending)</param>
        /// <param name="isPaused">Whether the session is paused</param>
        /// <param name="pauseReason">Reason for pause (PendingQR, BrowserClosure, PendingNET, etc.)</param>
        Task NotifyWhatsAppSessionUpdateAsync(int moderatorUserId, string? status = null, bool? isPaused = null, string? pauseReason = null);
    }
}
