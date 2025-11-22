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

        private string GetSessionDirectory(int moderatorId) => WhatsAppConfiguration.GetSessionDirectory(moderatorId);
        private string GetBackupPath(int moderatorId) => WhatsAppConfiguration.GetBackupFileName(moderatorId);

        public WhatsAppSessionOptimizer(
            INotifier notifier,
            IWhatsAppSessionManager sessionManager)
        {
            _notifier = notifier;
            _sessionManager = sessionManager;
        }

        public async Task OptimizeAuthenticatedSessionAsync(int moderatorId)
        {
            if (!await _optimizationLock.WaitAsync(0))
            {
                _notifier.Notify("⚠️ Optimization already in progress, skipping...");
                return;
            }

            try
            {
                _notifier.Notify($"🔧 Starting session optimization for moderator {moderatorId}...");

                // 1. Close browser to release file locks
                _notifier.Notify($"🔒 Closing browser session for moderator {moderatorId}...");
                await _sessionManager.DisposeSessionAsync(moderatorId);
                await Task.Delay(WhatsAppConfiguration.FileReleasedDelayMs);

                // 2. Ensure file locks are released
                await EnsureNoFileLocksAsync(moderatorId);

                // 3. Clean non-essential caches
                await CleanupCachesAsync(moderatorId);

                // 4. Create compressed backup
                await CreateCompressedBackupAsync(moderatorId);

                _notifier.Notify($"✅ Session optimization completed successfully for moderator {moderatorId}");
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Optimization failed for moderator {moderatorId}: {ex.Message}");
                throw;
            }
            finally
            {
                _optimizationLock.Release();
            }
        }

        public async Task OptimizeCurrentSessionOnlyAsync(int moderatorId)
        {
            if (!await _optimizationLock.WaitAsync(0))
            {
                _notifier.Notify("⚠️ Optimization already in progress, skipping...");
                return;
            }

            try
            {
                _notifier.Notify($"🔧 Starting current session optimization (cleanup only) for moderator {moderatorId}...");

                // 1. Close browser to release file locks
                _notifier.Notify($"🔒 Closing browser session for moderator {moderatorId}...");
                await _sessionManager.DisposeSessionAsync(moderatorId);
                await Task.Delay(WhatsAppConfiguration.FileReleasedDelayMs);

                // 2. Ensure file locks are released
                await EnsureNoFileLocksAsync(moderatorId);

                // 3. Clean non-essential caches (no backup creation)
                await CleanupCachesAsync(moderatorId);

                _notifier.Notify($"✅ Current session optimization completed successfully for moderator {moderatorId} (no backup created)");
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Optimization failed for moderator {moderatorId}: {ex.Message}");
                throw;
            }
            finally
            {
                _optimizationLock.Release();
            }
        }

        public async Task RestoreFromBackupAsync(int moderatorId)
        {
            if (!await _optimizationLock.WaitAsync(0))
            {
                throw new InvalidOperationException("Session restoration already in progress");
            }

            try
            {
                _notifier.Notify($"🔄 Starting session restoration from backup for moderator {moderatorId}...");

                // 1. Validate backup exists
                var backupPath = GetBackupPath(moderatorId);
                if (!File.Exists(backupPath))
                {
                    throw new FileNotFoundException("No backup file found. Please authenticate first.");
                }

                // 2. Validate backup integrity
                if (!await ValidateBackupAsync(moderatorId))
                {
                    throw new InvalidOperationException("Backup validation failed. Backup may be corrupted.");
                }

                // 3. Close current session gracefully
                _notifier.Notify($"🔒 Closing current session for moderator {moderatorId}...");
                await _sessionManager.DisposeSessionAsync(moderatorId);
                await Task.Delay(WhatsAppConfiguration.FileReleasedDelayMs);

                // 4. Ensure file locks are released
                await EnsureNoFileLocksAsync(moderatorId);

                // 5. Delete current session directory
                var sessionDir = GetSessionDirectory(moderatorId);
                if (Directory.Exists(sessionDir))
                {
                    _notifier.Notify($"🗑️ Removing current session for moderator {moderatorId}...");
                    Directory.Delete(sessionDir, recursive: true);
                }

                // 6. Extract clean backup
                _notifier.Notify($"📦 Extracting clean session from backup for moderator {moderatorId}...");
                ZipFile.ExtractToDirectory(backupPath, sessionDir);

                _notifier.Notify($"✅ Session restored successfully from backup for moderator {moderatorId}");
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Restoration failed for moderator {moderatorId}: {ex.Message}");
                throw;
            }
            finally
            {
                _optimizationLock.Release();
            }
        }

        public async Task<SessionHealthMetrics> GetHealthMetricsAsync(int moderatorId)
        {
            var sessionDir = GetSessionDirectory(moderatorId);
            var backupPath = GetBackupPath(moderatorId);
            var metrics = new SessionHealthMetrics
            {
                CurrentSizeBytes = GetDirectorySize(sessionDir),
                BackupSizeBytes = File.Exists(backupPath) ? new FileInfo(backupPath).Length : 0,
                BackupExists = File.Exists(backupPath),
                LastCleanup = _lastCleanup,
                LastBackup = _lastBackup,
                ThresholdBytes = WhatsAppConfiguration.MaxSessionSizeBytes,
                IsAuthenticated = await _sessionManager.IsSessionReadyAsync(moderatorId),
                ProviderSessionId = _sessionManager.GetProviderSessionId(moderatorId)
            };

            return await Task.FromResult(metrics);
        }

        public async Task CheckAndAutoRestoreIfNeededAsync(int moderatorId)
        {
            try
            {
                var metrics = await GetHealthMetricsAsync(moderatorId);

                if (metrics.ExceedsThreshold && metrics.BackupExists)
                {
                    _notifier.Notify($"⚠️ Session size ({metrics.CurrentSizeMB}MB) exceeds threshold ({metrics.ThresholdMB}MB) for moderator {moderatorId}");
                    _notifier.Notify($"🔄 Auto-restoring session from backup for moderator {moderatorId}...");
                    await RestoreFromBackupAsync(moderatorId);
                }
            }
            catch (Exception ex)
            {
                _notifier.Notify($"⚠️ Auto-restore check failed for moderator {moderatorId}: {ex.Message}");
                // Don't throw - this is a background check
            }
        }

        private Task CleanupCachesAsync(int moderatorId)
        {
            var sessionDir = GetSessionDirectory(moderatorId);
            _notifier.Notify($"🧹 Cleaning non-essential caches for moderator {moderatorId}...");
            int cleanedCount = 0;

            foreach (var folder in WhatsAppConfiguration.CacheFoldersToClean)
            {
                var paths = new[]
                {
                    Path.Combine(sessionDir, folder),
                    Path.Combine(sessionDir, "Default", folder),
                    Path.Combine(sessionDir, "Default", "Service Worker", folder)
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
            _notifier.Notify($"✅ Cleaned {cleanedCount} cache folders for moderator {moderatorId}");
            return Task.CompletedTask;
        }

        private async Task CreateCompressedBackupAsync(int moderatorId)
        {
            var sessionDir = GetSessionDirectory(moderatorId);
            var backupPath = GetBackupPath(moderatorId);
            _notifier.Notify($"📦 Creating compressed backup for moderator {moderatorId}...");

            // Delete old backup if exists
            if (File.Exists(backupPath))
            {
                File.Delete(backupPath);
            }

            // Create new backup
            await Task.Run(() => ZipFile.CreateFromDirectory(sessionDir, backupPath, CompressionLevel.Optimal, false));

            var backupSize = new FileInfo(backupPath).Length;
            _lastBackup = DateTime.UtcNow;
            _notifier.Notify($"✅ Backup created for moderator {moderatorId}: {Math.Round(backupSize / (1024.0 * 1024.0), 2)}MB");
        }

        private async Task<bool> ValidateBackupAsync(int moderatorId)
        {
            try
            {
                var backupPath = GetBackupPath(moderatorId);
                _notifier.Notify($"🔍 Validating backup integrity for moderator {moderatorId}...");

                // Extract to temp location for validation
                var tempDir = Path.Combine(Path.GetTempPath(), Guid.NewGuid().ToString());
                ZipFile.ExtractToDirectory(backupPath, tempDir);

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
                    _notifier.Notify($"✅ Backup validation passed for moderator {moderatorId}");
                }

                return await Task.FromResult(valid);
            }
            catch (Exception ex)
            {
                _notifier.Notify($"❌ Backup validation error: {ex.Message}");
                return false;
            }
        }

        private async Task EnsureNoFileLocksAsync(int moderatorId)
        {
            var sessionDir = GetSessionDirectory(moderatorId);
            _notifier.Notify($"⏳ Ensuring file handles are released for moderator {moderatorId}...");

            int retries = 0;
            while (retries < WhatsAppConfiguration.MaxFileLockRetries)
            {
                try
                {
                    // Test write access to session directory
                    var testFile = Path.Combine(sessionDir, "test_lock.tmp");
                    await File.WriteAllTextAsync(testFile, "test");
                    File.Delete(testFile);
                    _notifier.Notify($"✅ File locks released for moderator {moderatorId}");
                    return; // Success
                }
                catch (IOException)
                {
                    retries++;
                    if (retries < WhatsAppConfiguration.MaxFileLockRetries)
                    {
                        _notifier.Notify($"  ⏳ Waiting for file locks to release for moderator {moderatorId} (attempt {retries}/{WhatsAppConfiguration.MaxFileLockRetries})...");
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
