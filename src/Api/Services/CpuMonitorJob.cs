using Hangfire;
using System.Diagnostics;
using Microsoft.Extensions.Logging;

namespace Clinics.Api.Services;

/// <summary>
/// Security monitoring job that tracks CPU usage and logs alerts for unusual spikes.
/// This helps detect cryptominers or other malicious processes that consume CPU.
/// Runs as a Hangfire recurring job every 5 minutes.
/// </summary>
public class CpuMonitorJob
{
    private readonly ILogger<CpuMonitorJob> _logger;
    private const double CPU_THRESHOLD = 80.0; // Alert if process CPU > 80%

    public CpuMonitorJob(ILogger<CpuMonitorJob> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Executes CPU monitoring check. Logs warning if CPU usage exceeds threshold.
    /// </summary>
    [DisableConcurrentExecution(timeoutInSeconds: 60)]
    [AutomaticRetry(Attempts = 0)] // Don't retry monitoring jobs
    public async Task ExecuteAsync()
    {
        try
        {
            var currentProcess = Process.GetCurrentProcess();
            var startCpuTime = currentProcess.TotalProcessorTime;
            var startTime = DateTime.UtcNow;

            await Task.Delay(1000); // Sample over 1 second

            currentProcess.Refresh();
            var endCpuTime = currentProcess.TotalProcessorTime;
            var endTime = DateTime.UtcNow;

            var cpuUsedMs = (endCpuTime - startCpuTime).TotalMilliseconds;
            var elapsedMs = (endTime - startTime).TotalMilliseconds;
            var cpuPercent = cpuUsedMs / (Environment.ProcessorCount * elapsedMs) * 100;

            if (cpuPercent > CPU_THRESHOLD)
            {
                _logger.LogWarning(
                    "[SECURITY ALERT] High CPU usage detected in API process: {CpuPercent:F1}% (threshold: {Threshold}%)",
                    cpuPercent, CPU_THRESHOLD);

                // Log system-wide top processes for investigation
                LogTopProcesses();
            }
            else
            {
                _logger.LogDebug("CPU monitoring: API process at {CpuPercent:F1}%", cpuPercent);
            }

            // Also log memory usage for context
            var memoryMb = currentProcess.WorkingSet64 / (1024.0 * 1024.0);
            if (memoryMb > 500) // Warn if using more than 500MB
            {
                _logger.LogWarning("[SECURITY ALERT] High memory usage: {MemoryMb:F0} MB", memoryMb);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error during CPU monitoring check");
        }
    }

    private void LogTopProcesses()
    {
        try
        {
            var processes = Process.GetProcesses()
                .Where(p => !p.HasExited)
                .Select(p =>
                {
                    try
                    {
                        return new { p.ProcessName, p.Id, Memory = p.WorkingSet64 };
                    }
                    catch
                    {
                        return null;
                    }
                })
                .Where(p => p != null)
                .OrderByDescending(p => p!.Memory)
                .Take(5);

            foreach (var proc in processes)
            {
                _logger.LogWarning(
                    "[SECURITY] Top process by memory: {Name} (PID: {Pid}, Memory: {MemoryMb:F0} MB)",
                    proc!.ProcessName, proc.Id, proc.Memory / (1024.0 * 1024.0));
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Could not enumerate processes for security logging");
        }
    }
}
