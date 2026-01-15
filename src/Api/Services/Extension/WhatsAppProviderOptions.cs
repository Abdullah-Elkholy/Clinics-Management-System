namespace Clinics.Api.Services.Extension
{
    /// <summary>
    /// Configuration options for WhatsApp provider.
    /// Currently only the browser extension provider is supported.
    /// </summary>
    public class WhatsAppProviderOptions
    {
        public const string SectionName = "WhatsAppProvider";

        /// <summary>
        /// If true, use the browser extension provider.
        /// Default is true since extension is the only supported provider.
        /// </summary>
        public bool UseExtension { get; set; } = true;

        /// <summary>
        /// Timeout in seconds for extension commands.
        /// </summary>
        public int ExtensionCommandTimeoutSeconds { get; set; } = 120;
    }
}

