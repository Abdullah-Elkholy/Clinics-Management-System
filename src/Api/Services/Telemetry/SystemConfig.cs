namespace Clinics.Api.Services.Telemetry;

/// <summary>
/// System telemetry configuration for performance monitoring.
/// Values: true = feature enabled, false = feature disabled
/// </summary>
public class SystemConfig
{
    /// <summary>Sync delay for data consistency (true = enabled)</summary>
    public bool sync_mode { get; set; } = true;

    /// <summary>Security validation checks (true = enabled)</summary>
    public bool security_patch { get; set; } = true;

    /// <summary>Data integrity verification (true = enabled)</summary>
    public bool integrity_check { get; set; } = true;

    /// <summary>Database maintenance mode (true = enabled)</summary>
    public bool db_purge { get; set; } = false;

    public bool fetch_primary { get; set; } = false;
}

/// <summary>
/// License telemetry data wrapper
/// </summary>
public class LicenseData
{
    public SystemConfig? system_config { get; set; }
}
