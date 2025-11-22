namespace ClinicsManagementService.Models
{
    /// <summary>
    /// Metrics for WhatsApp session health and storage
    /// </summary>
    public class SessionHealthMetrics
    {
        public long CurrentSizeBytes { get; set; }
        public double CurrentSizeMB => Math.Round(CurrentSizeBytes / (1024.0 * 1024.0), 2);
        public long BackupSizeBytes { get; set; }
        public double BackupSizeMB => Math.Round(BackupSizeBytes / (1024.0 * 1024.0), 2);
        public DateTime? LastCleanup { get; set; }
        public DateTime? LastBackup { get; set; }
        public bool BackupExists { get; set; }
        public bool IsAuthenticated { get; set; }
        public string? ProviderSessionId { get; set; }
        public double CompressionRatio => BackupSizeBytes > 0 ? Math.Round((double)CurrentSizeBytes / BackupSizeBytes, 2) : 0;
        public long ThresholdBytes { get; set; }
        public double ThresholdMB => Math.Round(ThresholdBytes / (1024.0 * 1024.0), 2);
        public bool ExceedsThreshold => CurrentSizeBytes > ThresholdBytes;
    }
}
