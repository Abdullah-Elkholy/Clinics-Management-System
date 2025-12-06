namespace ClinicsManagementService.Configuration
{
    /// <summary>
    /// Configuration settings for WhatsApp automation
    /// </summary>
    public static class WhatsAppConfiguration
    {
        #region Timeouts and Intervals
        public const int DefaultTaskTimeoutMs = 150000; // timeout for progress
        public const int defaultChecksFrequencyDelayMs = 1000; // delay between progress checks in waiting loops
        public const int DefaultSelectorTimeoutMs = 20000; // default timeout for selector-based waits
        public const int DefaultMaxRetryErrorDialog = 20; // Max retries for error dialog detection, high frequency check
        public const int DefaultMaxRetryAttempts = 3;
        public const int DefaultMaxMonitoringWaitMs = 900000; // 15 minutes in ms, used as a safe global cap for monitoring progressbar waits
        public const int DefaultAuthenticationWaitMs = 300000; // 5 minutes for user to scan QR and authenticate
        #endregion

        #region UI Elements and Selectors
        public static readonly string[] InputFieldSelectors = new[]
        {
            "footer div[contenteditable='true']", // Common footer input field
            "div[contenteditable='true'][aria-label*='Type a message']",
            "div[contenteditable='true'][data-tab='10']",
        };

        public static readonly string[] SendButtonSelectors = new[]
        {
            // Specific selector from provided HTML: data-icon 'wds-ic-send-filled'
            "span[data-icon='wds-ic-send-filled']",
            "div[role='button'] span[data-icon='wds-ic-send-filled']",
            // "div[role='button'][tabindex='0']",
            // "button[tabindex='0']",
            "[data-icon='wds-ic-send-filled']",

            // WhatsApp web default send icon/button variations
            "button[aria-label='Send']",
            "button[data-testid='send']",
            "span[data-icon='send']",
            "button[role='button'] span[data-icon='send']",
            "div[role='button'] span[data-icon='send']",
            "div[role='button'][data-testid='send']",
            "button[type='submit']",

            // fallback: any element with a send-related aria-label or title
            "[aria-label*='send' i]",
            "[title*='send' i]",
        };

        public static readonly string[] ProgressBarSelectors = new[]
        {
            "div[role='progressbar']",
            "progress",
            "div[aria-label^='Loading your chats']",
            "div[class*='x1n2onr6'] progress",
        };
        // Check for loading text indicators
        public static readonly string[] LoadingTextSelectors = new[]
        {
            "text=Loading your chats",
            "text=Don't close this window",
            "[aria-label^='Loading your chats']",
        };

        public static readonly string[] ChatUIReadySelectors = new[]
 {
            "div[aria-label='Chat list']", // chat list
            "div[data-testid='chat-list']", // chat list
            "div[role='listbox']", // chat list container
            "header", // WhatsApp header
            "footer" // WhatsApp footer
        };

        // Selectors for the "Starting chat" modal/dialog shown by WhatsApp Web
        public static readonly string[] StartingChatDialogSelectors = new[]
        {
            // Strong, attribute-based matches
            "div[data-animate-modal-popup='true'][aria-label='Starting chat']",
            "div[aria-label='Starting chat']",

            // Playwright-friendly text/has-text checks
            "div[data-animate-modal-body='true'] h1:has-text('Starting chat')",
            "text='Starting chat'",

            // Action/button presence inside the dialog
            "div[data-animate-modal-popup='true'] button:has-text('Cancel')",
            "button:has-text('Cancel')",

            "div[data-animate-modal-popup='true'] svg[role='status']", // Loading indicator inside the dialog (spinner)
            "div[data-animate-modal-body='true']", // Modal body container
        };
        #endregion

        #region Authentication and QR Code
        public static readonly string[] QrCodeSelectors = new[]
        {
            "div[data-ref]", // QR code container
            "canvas", // QR code canvas
            "div[aria-label*='QR']", // QR code aria label
            "div[data-testid='qr-code']", // QR code test id
            "div[aria-label*='scan me' i]",
            "div[role='button'] canvas",
            "canvas[aria-label*='scan me' i]",
            "div[tabindex='-1'] canvas",
            "div[role='button'][data-testid='refresh-large']",
            "div[aria-label*='to use whatsapp on your computer' i]",
            "div[aria-label*='use whatsapp on your computer' i]",
            "div[aria-label*='scan qr code' i]",
            "div[aria-label*='link with qr code' i]",
            "div[aria-label*='log in' i]",
            "div[aria-label*='session expired' i]"
        };

        public static readonly string[] LoginPromptTexts = new[]
        {
            "log in",
            "scan qr code",
            "link with qr code",
            "session expired",
            "to use whatsapp on your computer",
            "use whatsapp on your computer"
        };
        #endregion

        #region Message Status and Icons

        public static readonly string[] OutgoingMessageSelectors = new[]
        {
            "div.message-out"
        };

        public static readonly string[] OutgoingMessageTextSelectors = new[]
        {
            "span.selectable-text"
        };

        public static readonly string[] StatusIconSelectors = new[]
        {
            "span[data-icon]"
        };

        public static readonly string[] StatusIconFallbackXPaths = new[]
        {
            "(//span[@data-icon='msg-check' or @data-icon='msg-dblcheck' or @data-icon='msg-time'])[last()]"
        };

        public static readonly string[] SupportedStatusIconTypes = new[]
        {
            "msg-check",
            "msg-dblcheck",
            "msg-time"
        };

        public const string TailOutIconType = "tail-out";
        public const string StatusIconAttribute = "data-icon";
        #endregion

        #region Error and Network Handling
        public static readonly string[] NetworkErrorPatterns = new[]
        {
            "net::ERR_NAME_NOT_RESOLVED",
            "net::ERR_INTERNET_DISCONNECTED",
            "Navigation failed"
        };

        public static readonly string[] DisposedObjectMessage = new[]
{
            "Target page, context or browser has been closed",
            "Browser has been disconnected",
            "Session was closed",
            "Cannot access a disposed object"
        };

        public static readonly string[] ErrorDialogSelectors = new[]
        {
            // Specific selectors for the exact error dialog structure
            "[aria-label*='Phone number shared via url is invalid']", // General aria-label match
            "div[role='dialog'] div[data-animate-modal-popup='true'][aria-label*='Phone number shared via url is invalid.']", // General dialog match
            "div[role='dialog'] div[data-animate-modal-body='true'] div:has-text('Phone number shared via url is invalid')", // Specific body text match
            "div[role='dialog'] div:has-text('Phone number shared via url is invalid')", // Specific text match
            "div[data-animate-modal-popup='true'][aria-label*='Phone number shared via url is invalid']", // General aria-label match
            // More specific selectors based on the provided HTML structure
            // "div.x9f619.x78zum5.xdt5ytf.x6s0dn4.xl56j7k.xh8yej3.xpb48g7.x1jn0hjm.x1us19tq[role='dialog']", // Specific class match
            "div[data-animate-modal-popup='true'][aria-label*='Phone number shared via url is invalid.']", // Specific aria-label match
            "div[data-animate-modal-body='true'] div:has-text('Phone number shared via url is invalid.')", // Specific text match
            "text='Phone number shared via url is invalid.'", // Specific text match
            // Generic fallback selectors
            // "div[role='dialog']", // General dialog match
            // "div[data-animate-modal-popup='true']", // General modal popup
            // "div[data-animate-modal-body='true']" // General modal body
        };
        #endregion

        #region JavaScript Expressions
        public static readonly string[] ParentClassJsExpressions = new[]
        {
            "el => el.parentElement?.className"
        };

        public static readonly string[] ClearInputJsExpressions = new[]
        {
            "el => el.innerText = ''"
        };
        #endregion

        #region Message System Classes
        public static readonly string[] SystemMessageParentClasses = new[]
        {
            "x141l45o"
        };
        #endregion

        #region Attributes and Constants
        public const string SendEnterKey = "Enter";
        public const string AriaLabelAttribute = "aria-label";
        #endregion

        #region Session and Storage
        /// <summary>
        /// Get session directory for a specific moderator
        /// </summary>
        /// <param name="moderatorId">Moderator ID</param>
        /// <returns>Session directory path</returns>
        public static string GetSessionDirectory(int moderatorId)
        {
            return $"whatsapp-session-{moderatorId}";
        }

        /// <summary>
        /// Legacy session directory (for migration)
        /// </summary>
        public const string LegacySessionDirectory = "whatsapp-session";
        #endregion

        #region Session Optimization
        /// <summary>
        /// Maximum session size before auto-restore (60 MB)
        /// </summary>
        public const long MaxSessionSizeBytes = 60 * 1024 * 1024;

        /// <summary>
        /// Get backup file name for a specific moderator
        /// </summary>
        /// <param name="moderatorId">Moderator ID</param>
        /// <returns>Backup file name</returns>
        public static string GetBackupFileName(int moderatorId)
        {
            return $"whatsapp-session-{moderatorId}.zip";
        }

        /// <summary>
        /// Legacy backup file name (for migration)
        /// </summary>
        public const string LegacyBackupFileName = "whatsapp-session.zip";

        /// <summary>
        /// Folders to clean during optimization (non-essential caches)
        /// </summary>
        public static readonly string[] CacheFoldersToClean = new[]
        {
            "BrowserMetrics", // in root folder
            "Cache", // in "Default/" folder
            "Code Cache", // in "Default/" folder
            "DawnGraphiteCache", // in "Default/" folder
            "DawnWebGPUCache", // in "Default/" folder
            "GPUCache", // in "Default/" folder
            "CacheStorage", // in "Default/Service Worker/" folder
            "ScriptCache", // in "Default/Service Worker/" folder
            "GraphiteDawnCache", // in root folder
            "extensions_crx_cache", // in root folder
            "GrShaderCache", // in root folder
            "ShaderCache", // in root folder
        };

        /// <summary>
        /// Delay to ensure file handles are released (milliseconds)
        /// </summary>
        public const int FileReleasedDelayMs = 3000;
        public const int MaxFileLockRetries = 3;
        public const int FileLockRetryDelayMs = 2000;
        #endregion

        #region URLs
        public const string WhatsAppBaseUrl = "https://web.whatsapp.com/";
        public const string WhatsAppSendUrl = WhatsAppBaseUrl + "send?phone=";
        #endregion
    }
}