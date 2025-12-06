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
        private readonly IWhatsAppSessionSyncService _sessionSyncService;
        private static readonly SemaphoreSlim _optimizationLock = new(1, 1);
        private DateTime? _lastCleanup;
        private DateTime? _lastBackup;

        private string GetSessionDirectory(int moderatorId) => WhatsAppConfiguration.GetSessionDirectory(moderatorId);
        private string GetBackupPath(int moderatorId) => WhatsAppConfiguration.GetBackupFileName(moderatorId);

        public WhatsAppSessionOptimizer(
            INotifier notifier,
            IWhatsAppSessionManager sessionManager,
            IWhatsAppSessionSyncService sessionSyncService)
        {
            _notifier = notifier;
            _sessionManager = sessionManager;
            _sessionSyncService = sessionSyncService;
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

                // 3. Clean non-essential caches (disabled for now as the session is malfunctioning)
                // await CleanupCachesAsync(moderatorId);

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
            
            // Check database status first (source of truth), then fallback to browser session check
            bool isAuthenticated = false;
            try
            {
                var dbSession = await _sessionSyncService.GetSessionStatusAsync(moderatorId);
                if (dbSession != null && dbSession.Status == "connected")
                {
                    isAuthenticated = true;
                }
                else
                {
                    // Fallback to browser session check if database says not connected
                    isAuthenticated = await _sessionManager.IsSessionReadyAsync(moderatorId);
                }
            }
            catch (Exception ex)
            {
                _notifier.Notify($"⚠️ Error checking authentication status, using browser session check: {ex.Message}");
                // Fallback to browser session check on error
                isAuthenticated = await _sessionManager.IsSessionReadyAsync(moderatorId);
            }
            
            var metrics = new SessionHealthMetrics
            {
                CurrentSizeBytes = GetDirectorySize(sessionDir),
                BackupSizeBytes = File.Exists(backupPath) ? new FileInfo(backupPath).Length : 0,
                BackupExists = File.Exists(backupPath),
                LastCleanup = _lastCleanup,
                LastBackup = _lastBackup,
                ThresholdBytes = WhatsAppConfiguration.MaxSessionSizeBytes,
                IsAuthenticated = isAuthenticated,
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

            // First, try to kill any orphaned Chrome processes that might be holding locks
            try
            {
                await KillOrphanedChromeProcessesAsync(moderatorId);
            }
            catch (Exception ex)
            {
                _notifier.Notify($"⚠️ Error killing orphaned Chrome processes: {ex.Message}");
            }

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
                catch (IOException ioEx)
                {
                    retries++;
                    if (retries < WhatsAppConfiguration.MaxFileLockRetries)
                    {
                        _notifier.Notify($"  ⏳ Waiting for file locks to release for moderator {moderatorId} (attempt {retries}/{WhatsAppConfiguration.MaxFileLockRetries}): {ioEx.Message}");
                        await Task.Delay(WhatsAppConfiguration.FileLockRetryDelayMs);
                        
                        // Every 3 retries, try killing Chrome processes again
                        if (retries % 3 == 0)
                        {
                            try
                            {
                                await KillOrphanedChromeProcessesAsync(moderatorId);
                            }
                            catch { /* ignore */ }
                        }
                    }
                }
            }

            // Final attempt - don't throw, just warn (allow operation to continue with best effort)
            _notifier.Notify($"⚠️ File locks may still exist for moderator {moderatorId} after {retries} retries - continuing anyway");
        }

        /// <summary>
        /// Kill any orphaned Chrome processes that might be holding file locks on the session directory
        /// </summary>
        private async Task KillOrphanedChromeProcessesAsync(int moderatorId)
        {
            try
            {
                var sessionDir = GetSessionDirectory(moderatorId);
                var chromeProcesses = System.Diagnostics.Process.GetProcessesByName("chrome");
                
                foreach (var proc in chromeProcesses)
                {
                    try
                    {
                        // Try to check if this Chrome process is using our session directory
                        // This is a heuristic - we can't perfectly determine which Chrome uses which profile
                        // but orphaned processes with no window are likely candidates
                        if (proc.MainWindowHandle == IntPtr.Zero)
                        {
                            _notifier.Notify($"  🔍 Found orphaned Chrome process (PID: {proc.Id}) with no main window");
                            // Don't kill by default - just log. Uncomment to enable killing:
                            // proc.Kill();
                            // await Task.Delay(500);
                        }
                    }
                    catch { /* ignore - process may have exited */ }
                }
            }
            catch (Exception ex)
            {
                _notifier.Notify($"⚠️ Error checking for orphaned Chrome processes: {ex.Message}");
            }
            
            await Task.CompletedTask;
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
