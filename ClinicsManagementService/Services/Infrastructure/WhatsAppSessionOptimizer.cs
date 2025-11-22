using System.IO.Compression;
using ClinicsManagementService.Configuration;
using ClinicsManagementService.Models;
using ClinicsManagementService.Services.Interfaces;

namespace ClinicsManagementService.Services.Infrastructure
{
    /// <summary>
    /// Optimizes WhatsApp session storage through cleanup and compression
    /// </summary>
    public class WhatsAppSessionOptimizer : IWhatsAppSessionOptimizer
    {
        private readonly INotifier _notifier;
        private readonly IWhatsAppSessionManager _sessionManager;
        private static readonly SemaphoreSlim _optimizationLock = new(1, 1);
        private DateTime? _lastCleanup;
        private DateTime? _lastBackup;

        private string SessionDirectory => WhatsAppConfiguration.SessionDirectory;
        private string BackupPath => WhatsAppConfiguration.BackupFileName;

        public WhatsAppSessionOptimizer(
            INotifier notifier,
            IWhatsAppSessionManager sessionManager)
        {
            _notifier = notifier;
            _sessionManager = sessionManager;
        }

        public async Task OptimizeAuthenticatedSessionAsync()
        {
            if (!await _optimizationLock.WaitAsync(0))
            {
                _notifier.Notify("⚠️ Optimization already in progress, skipping...");
                return;
            }

            try
            {
                _notifier.Notify("🔧 Starting session optimization...");

                // 1. Close browser to release file locks
                _notifier.Notify("🔒 Closing browser session...");
                await _sessionManager.DisposeSessionAsync();
                await Task.Delay(WhatsAppConfiguration.FileReleasedDelayMs);

                // 2. Ensure file locks are released
                await EnsureNoFileLocksAsync();

                // 3. Clean non-essential caches
                await CleanupCachesAsync();

                // 4. Create compressed backup
                await CreateCompressedBackupAsync();

                _notifier.Notify("✅ Session optimization completed successfully");
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Optimization failed: {ex.Message}");
                throw;
            }
            finally
            {
                _optimizationLock.Release();
            }
        }

        public async Task OptimizeCurrentSessionOnlyAsync()
        {
            if (!await _optimizationLock.WaitAsync(0))
            {
                _notifier.Notify("⚠️ Optimization already in progress, skipping...");
                return;
            }

            try
            {
                _notifier.Notify("🔧 Starting current session optimization (cleanup only)...");

                // 1. Close browser to release file locks
                _notifier.Notify("🔒 Closing browser session...");
                await _sessionManager.DisposeSessionAsync();
                await Task.Delay(WhatsAppConfiguration.FileReleasedDelayMs);

                // 2. Ensure file locks are released
                await EnsureNoFileLocksAsync();

                // 3. Clean non-essential caches (no backup creation)
                await CleanupCachesAsync();

                _notifier.Notify("✅ Current session optimization completed successfully (no backup created)");
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Optimization failed: {ex.Message}");
                throw;
            }
            finally
            {
                _optimizationLock.Release();
            }
        }

        public async Task RestoreFromBackupAsync()
        {
            if (!await _optimizationLock.WaitAsync(0))
            {
                throw new InvalidOperationException("Session restoration already in progress");
            }

            try
            {
                _notifier.Notify("🔄 Starting session restoration from backup...");

                // 1. Validate backup exists
                if (!File.Exists(BackupPath))
                {
                    throw new FileNotFoundException("No backup file found. Please authenticate first.");
                }

                // 2. Validate backup integrity
                if (!await ValidateBackupAsync())
                {
                    throw new InvalidOperationException("Backup validation failed. Backup may be corrupted.");
                }

                // 3. Close current session gracefully
                _notifier.Notify("🔒 Closing current session...");
                await _sessionManager.DisposeSessionAsync();
                await Task.Delay(WhatsAppConfiguration.FileReleasedDelayMs);

                // 4. Ensure file locks are released
                await EnsureNoFileLocksAsync();

                // 5. Delete current session directory
                if (Directory.Exists(SessionDirectory))
                {
                    _notifier.Notify("🗑️ Removing current session...");
                    Directory.Delete(SessionDirectory, recursive: true);
                }

                // 6. Extract clean backup
                _notifier.Notify("📦 Extracting clean session from backup...");
                ZipFile.ExtractToDirectory(BackupPath, SessionDirectory);

                _notifier.Notify("✅ Session restored successfully from backup");
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Restoration failed: {ex.Message}");
                throw;
            }
            finally
            {
                _optimizationLock.Release();
            }
        }

        public async Task<SessionHealthMetrics> GetHealthMetricsAsync()
        {
            var metrics = new SessionHealthMetrics
            {
                CurrentSizeBytes = GetDirectorySize(SessionDirectory),
                BackupSizeBytes = File.Exists(BackupPath) ? new FileInfo(BackupPath).Length : 0,
                BackupExists = File.Exists(BackupPath),
                LastCleanup = _lastCleanup,
                LastBackup = _lastBackup,
                ThresholdBytes = WhatsAppConfiguration.MaxSessionSizeBytes,
                IsAuthenticated = await _sessionManager.IsSessionReadyAsync()
            };

            return await Task.FromResult(metrics);
        }

        public async Task CheckAndAutoRestoreIfNeededAsync()
        {
            try
            {
                var metrics = await GetHealthMetricsAsync();

                if (metrics.ExceedsThreshold && metrics.BackupExists)
                {
                    _notifier.Notify($"⚠️ Session size ({metrics.CurrentSizeMB}MB) exceeds threshold ({metrics.ThresholdMB}MB)");
                    _notifier.Notify("🔄 Auto-restoring session from backup...");
                    await RestoreFromBackupAsync();
                }
            }
            catch (Exception ex)
            {
                _notifier.Notify($"⚠️ Auto-restore check failed: {ex.Message}");
                // Don't throw - this is a background check
            }
        }

        private async Task CleanupCachesAsync()
        {
            _notifier.Notify("🧹 Cleaning non-essential caches...");
            int cleanedCount = 0;

            foreach (var folder in WhatsAppConfiguration.CacheFoldersToClean)
            {
                var paths = new[]
                {
                    Path.Combine(SessionDirectory, folder),
                    Path.Combine(SessionDirectory, "Default", folder),
                    Path.Combine(SessionDirectory, "Default", "Service Worker", folder)
                };

                foreach (var path in paths)
                {
                    if (Directory.Exists(path))
                    {
                        try
                        {
                            Directory.Delete(path, recursive: true);
                            cleanedCount++;
                            _notifier.Notify($"  ✓ Cleaned: {folder}");
                        }
                        catch (Exception ex)
                        {
                            _notifier.Notify($"  ⚠️ Failed to clean {folder}: {ex.Message}");
                        }
                    }
                }
            }

            _lastCleanup = DateTime.UtcNow;
            _notifier.Notify($"✅ Cleaned {cleanedCount} cache folders");
        }

        private async Task CreateCompressedBackupAsync()
        {
            _notifier.Notify("📦 Creating compressed backup...");

            // Delete old backup if exists
            if (File.Exists(BackupPath))
            {
                File.Delete(BackupPath);
            }

            // Create new backup
            await Task.Run(() => ZipFile.CreateFromDirectory(SessionDirectory, BackupPath, CompressionLevel.Optimal, false));

            var backupSize = new FileInfo(BackupPath).Length;
            _lastBackup = DateTime.UtcNow;
            _notifier.Notify($"✅ Backup created: {Math.Round(backupSize / (1024.0 * 1024.0), 2)}MB");
        }

        private async Task<bool> ValidateBackupAsync()
        {
            try
            {
                _notifier.Notify("🔍 Validating backup integrity...");

                // Extract to temp location for validation
                var tempDir = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString());
                ZipFile.ExtractToDirectory(BackupPath, tempDir);

                // Verify critical authentication files exist
                var requiredPaths = new[]
                {
                    Path.Combine(tempDir, "Default", "IndexedDB"),
                    Path.Combine(tempDir, "Default", "Local Storage")
                };

                bool valid = true;
                foreach (var path in requiredPaths)
                {
                    if (!Directory.Exists(path))
                    {
                        _notifier.Notify($"  ⚠️ Missing critical path: {Path.GetFileName(path)}");
                        valid = false;
                    }
                }

                // Cleanup temp
                Directory.Delete(tempDir, true);

                if (valid)
                {
                    _notifier.Notify("✅ Backup validation passed");
                }

                return await Task.FromResult(valid);
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Backup validation error: {ex.Message}");
                return false;
            }
        }

        private async Task EnsureNoFileLocksAsync()
        {
            _notifier.Notify("⏳ Ensuring file handles are released...");

            int retries = 0;
            while (retries < WhatsAppConfiguration.MaxFileLockRetries)
            {
                try
                {
                    // Test write access to session directory
                    var testFile = Path.Combine(SessionDirectory, "test_lock.tmp");
                    await File.WriteAllTextAsync(testFile, "test");
                    File.Delete(testFile);
                    _notifier.Notify("✅ File locks released");
                    return; // Success
                }
                catch (IOException)
                {
                    retries++;
                    if (retries < WhatsAppConfiguration.MaxFileLockRetries)
                    {
                        _notifier.Notify($"  ⏳ Waiting for file locks to release (attempt {retries}/{WhatsAppConfiguration.MaxFileLockRetries})...");
                        await Task.Delay(WhatsAppConfiguration.FileLockRetryDelayMs);
                    }
                }
            }

            throw new InvalidOperationException("Session files are still locked after multiple retries");
        }

        private long GetDirectorySize(string path)
        {
            if (!Directory.Exists(path))
                return 0;

            try
            {
                return new DirectoryInfo(path)
                    .GetFiles("*", SearchOption.AllDirectories)
                    .Sum(file => file.Length);
            }
            catch
            {
                return 0;
            }
        }
    }
}
