using Clinics.Domain;
using Clinics.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;

namespace Clinics.Api.Services
{
    /// <summary>
    /// Service for retrieving and updating rate limit settings.
    /// Settings are cached for performance.
    /// </summary>
    public interface IRateLimitSettingsService
    {
        /// <summary>
        /// Get the current rate limit settings.
        /// </summary>
        Task<RateLimitSettings> GetRateLimitSettingsAsync();

        /// <summary>
        /// Get a random delay based on current settings.
        /// Returns TimeSpan.Zero if rate limiting is disabled.
        /// </summary>
        Task<TimeSpan> GetRandomDelayAsync();

        /// <summary>
        /// Update the rate limit settings (admin only).
        /// </summary>
        Task UpdateRateLimitSettingsAsync(int minSeconds, int maxSeconds, bool enabled, int updatedBy);

        /// <summary>
        /// Invalidate the cached settings (call after update).
        /// </summary>
        void InvalidateCache();
    }

    /// <summary>
    /// Rate limit settings data transfer object.
    /// </summary>
    public class RateLimitSettings
    {
        public int MinSeconds { get; set; } = 3;
        public int MaxSeconds { get; set; } = 7;
        public bool Enabled { get; set; } = true;

        /// <summary>
        /// Estimated seconds per message including processing time.
        /// Used for UI time estimation.
        /// </summary>
        public double EstimatedSecondsPerMessage => Enabled
            ? (MinSeconds + MaxSeconds) / 2.0 + 4.0  // Average delay + 4s processing
            : 4.0;  // Just processing time if disabled
    }

    /// <summary>
    /// Implementation of rate limit settings service with caching.
    /// </summary>
    public class RateLimitSettingsService : IRateLimitSettingsService
    {
        private readonly ApplicationDbContext _db;
        private readonly IMemoryCache _cache;
        private readonly ILogger<RateLimitSettingsService> _logger;
        private static readonly Random _random = new Random();

        private const string CacheKey = "RateLimitSettings";
        private static readonly TimeSpan CacheDuration = TimeSpan.FromMinutes(5);

        public RateLimitSettingsService(
            ApplicationDbContext db,
            IMemoryCache cache,
            ILogger<RateLimitSettingsService> logger)
        {
            _db = db;
            _cache = cache;
            _logger = logger;
        }

        public async Task<RateLimitSettings> GetRateLimitSettingsAsync()
        {
            // Try to get from cache first
            if (_cache.TryGetValue(CacheKey, out RateLimitSettings? cached) && cached != null)
            {
                return cached;
            }

            // Load from database
            var settings = await _db.SystemSettings
                .Where(s => s.Category == "RateLimit")
                .ToListAsync();

            var result = new RateLimitSettings
            {
                MinSeconds = ParseIntSetting(settings, SystemSettingKeys.RateLimitMinSeconds, 3),
                MaxSeconds = ParseIntSetting(settings, SystemSettingKeys.RateLimitMaxSeconds, 7),
                Enabled = ParseBoolSetting(settings, SystemSettingKeys.RateLimitEnabled, true)
            };

            // Validate (max >= min)
            if (result.MaxSeconds < result.MinSeconds)
            {
                _logger.LogWarning("RateLimitMaxSeconds ({Max}) is less than RateLimitMinSeconds ({Min}). Using min value for both.",
                    result.MaxSeconds, result.MinSeconds);
                result.MaxSeconds = result.MinSeconds;
            }

            // Cache the result
            _cache.Set(CacheKey, result, CacheDuration);

            _logger.LogDebug("Loaded rate limit settings: Min={Min}s, Max={Max}s, Enabled={Enabled}",
                result.MinSeconds, result.MaxSeconds, result.Enabled);

            return result;
        }

        public async Task<TimeSpan> GetRandomDelayAsync()
        {
            var settings = await GetRateLimitSettingsAsync();

            if (!settings.Enabled || settings.MinSeconds <= 0)
            {
                return TimeSpan.Zero;
            }

            // Generate random delay between min and max (inclusive)
            var delaySeconds = _random.Next(settings.MinSeconds, settings.MaxSeconds + 1);

            _logger.LogDebug("Rate limit delay: {DelaySeconds}s (range: {Min}-{Max}s)",
                delaySeconds, settings.MinSeconds, settings.MaxSeconds);

            return TimeSpan.FromSeconds(delaySeconds);
        }

        public async Task UpdateRateLimitSettingsAsync(int minSeconds, int maxSeconds, bool enabled, int updatedBy)
        {
            // Validate input
            if (minSeconds < 0 || minSeconds > 60)
                throw new ArgumentException("MinSeconds must be between 0 and 60", nameof(minSeconds));
            if (maxSeconds < 1 || maxSeconds > 120)
                throw new ArgumentException("MaxSeconds must be between 1 and 120", nameof(maxSeconds));
            if (maxSeconds < minSeconds)
                throw new ArgumentException("MaxSeconds must be greater than or equal to MinSeconds");

            var now = DateTime.UtcNow;

            // Update each setting
            await UpdateSettingAsync(SystemSettingKeys.RateLimitMinSeconds, minSeconds.ToString(), updatedBy, now);
            await UpdateSettingAsync(SystemSettingKeys.RateLimitMaxSeconds, maxSeconds.ToString(), updatedBy, now);
            await UpdateSettingAsync(SystemSettingKeys.RateLimitEnabled, enabled.ToString().ToLower(), updatedBy, now);

            await _db.SaveChangesAsync();

            // Invalidate cache
            InvalidateCache();

            _logger.LogInformation("Rate limit settings updated by user {UserId}: Min={Min}s, Max={Max}s, Enabled={Enabled}",
                updatedBy, minSeconds, maxSeconds, enabled);

            // Arabic business log
            _logger.LogInformation("[Business] قام المستخدم {UserId} بتحديث إعدادات حد السرعة: الحد الأدنى={Min}ث, الحد الأقصى={Max}ث, التفعيل={Enabled}",
                updatedBy, minSeconds, maxSeconds, enabled ? "نعم" : "لا");
        }

        public void InvalidateCache()
        {
            _cache.Remove(CacheKey);
        }

        private async Task UpdateSettingAsync(string key, string value, int updatedBy, DateTime now)
        {
            var setting = await _db.SystemSettings.FirstOrDefaultAsync(s => s.Key == key);

            if (setting != null)
            {
                setting.Value = value;
                setting.UpdatedAt = now;
                setting.UpdatedBy = updatedBy;
            }
            else
            {
                // Create if doesn't exist (shouldn't happen with proper seeding)
                _db.SystemSettings.Add(new SystemSettings
                {
                    Key = key,
                    Value = value,
                    Category = "RateLimit",
                    CreatedAt = now,
                    UpdatedBy = updatedBy
                });
            }
        }

        private static int ParseIntSetting(List<SystemSettings> settings, string key, int defaultValue)
        {
            var setting = settings.FirstOrDefault(s => s.Key == key);
            if (setting != null && int.TryParse(setting.Value, out var value))
            {
                return value;
            }
            return defaultValue;
        }

        private static bool ParseBoolSetting(List<SystemSettings> settings, string key, bool defaultValue)
        {
            var setting = settings.FirstOrDefault(s => s.Key == key);
            if (setting != null && bool.TryParse(setting.Value, out var value))
            {
                return value;
            }
            return defaultValue;
        }
    }
}
