namespace Clinics.Api.Services.Extension
{
    /// <summary>
    /// Configuration options for WhatsApp provider selection.
    /// </summary>
    public class WhatsAppProviderOptions
    {
        public const string SectionName = "WhatsAppProvider";

        /// <summary>
        /// If true, use the browser extension provider.
        /// If false, use the server-side Playwright provider.
        /// </summary>
        public bool UseExtension { get; set; } = false;

        /// <summary>
        /// If true and extension is unavailable, fallback to Playwright.
        /// </summary>
        public bool FallbackToPlaywright { get; set; } = true;

        /// <summary>
        /// Timeout in seconds for extension commands.
        /// </summary>
        public int ExtensionCommandTimeoutSeconds { get; set; } = 120;
    }
}
