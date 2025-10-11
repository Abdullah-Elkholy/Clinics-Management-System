namespace ClinicsManagementService.Configuration
{
    /// <summary>
    /// Configuration settings for WhatsApp automation
    /// </summary>
    public static class WhatsAppConfiguration
    {
        #region Timeouts and Intervals
        public const int DefaultSelectorTimeoutMs = 20000;
        public const int DefaultMaxRetryErrorDialog = 10;
        public const int DefaultMaxRetryAttempts = 3;
        public const int DefaultProgressBarWaitMs = 60000;
        public const int DefaultUIWaitMs = 30000;
        public const int DefaultMaxUIAttempts = 100;
        public const int DefaultMaxMonitoringWaitMs = 900000; // 15 minutes in ms, used as a safe global cap for monitoring progressbar waits
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
            "button[aria-label='Send']",
            "button[data-testid='send']",
            "span[data-icon='send']",
            "button[role='button'] span[data-icon='send']",
            "div[role='button'] span[data-icon='send']",
            "div[role='button'][data-testid='send']",
            "button[type='submit']"
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
        public const string SessionDirectory = "whatsapp-session";
        #endregion

        #region URLs
        public const string WhatsAppBaseUrl = "https://web.whatsapp.com/";
        public const string WhatsAppSendUrl = WhatsAppBaseUrl + "send?phone=";
        #endregion
    }
}