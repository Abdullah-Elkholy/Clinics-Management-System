using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Globalization;
using System.IO.Compression;
using System.Text.RegularExpressions;

namespace Clinics.Api.Controllers
{
    /// <summary>
    /// Controller for viewing system logs from log files.
    /// Only accessible by admins.
    /// </summary>
    [ApiController]
    [Route("api/logs")]
    [Authorize(Roles = "primary_admin,secondary_admin")]
    public class LogsController : ControllerBase
    {
        private readonly ILogger<LogsController> _logger;
        private readonly IWebHostEnvironment _env;
        private readonly IConfiguration _configuration;
        private readonly string _logsPath;

        public LogsController(ILogger<LogsController> logger, IWebHostEnvironment env, IConfiguration configuration)
        {
            _logger = logger;
            _env = env;
            _configuration = configuration;

            // Prefer an explicit directory override, otherwise derive the directory from the same file path Serilog uses.
            // This keeps dev/prod consistent even when LogPaths:Main is something like "../../logs/dev-.log" or "/app/logs/production-.log".
            var configuredLogsDir = _configuration["LogPaths:Directory"]
                ?? Environment.GetEnvironmentVariable("LOGS_PATH");

            if (!string.IsNullOrWhiteSpace(configuredLogsDir))
            {
                _logsPath = Path.IsPathRooted(configuredLogsDir)
                    ? configuredLogsDir
                    : Path.GetFullPath(Path.Combine(_env.ContentRootPath, configuredLogsDir));
                return;
            }

            var mainLogPath = _configuration["LogPaths:Main"] ?? "logs/main-.log";
            var mainLogFullPath = Path.IsPathRooted(mainLogPath)
                ? mainLogPath
                : Path.GetFullPath(Path.Combine(_env.ContentRootPath, mainLogPath));

            _logsPath = Path.GetDirectoryName(mainLogFullPath)
                ?? Path.Combine(_env.ContentRootPath, "logs");
        }

        /// <summary>
        /// Get recent system logs from log files.
        /// </summary>
        /// <param name="date">
        /// Filter by date (optional, defaults to today).
        /// Accepts either YYYYMMDD (e.g. 20260205) or YYYY-MM-DD; only the digits are used to match log file names.
        /// </param>
        /// <param name="search">Search term to filter logs (optional)</param>
        /// <param name="page">Page number (1-indexed)</param>
        /// <param name="pageSize">Number of log lines per page (default 25, max 100)</param>
        /// <param name="level">Filter by level: All, INF, WRN, ERR</param>
        /// <returns>List of log entries with pagination</returns>
        [HttpGet]
        [ProducesResponseType(typeof(LogsResponse), 200)]
        public IActionResult GetLogs(
            [FromQuery] string? date = null,
            [FromQuery] string? search = null,
            [FromQuery] int page = 1,
            [FromQuery] int pageSize = 25,
            [FromQuery] string level = "All")
        {
            pageSize = Math.Min(pageSize, 100); // Cap at 100 per page
            page = Math.Max(page, 1); // Minimum page 1

            try
            {
                var logDir = new DirectoryInfo(_logsPath);
                if (!logDir.Exists)
                {
                    return Ok(new LogsResponse { Logs = new List<LogEntryDto>(), TotalCount = 0, Message = "مجلد السجلات غير موجود" });
                }

                // Normalize and determine which log files to read based on date
                // Frontend sends YYYYMMDD; if dashes are present we strip them so both formats work.
                string targetDate = !string.IsNullOrWhiteSpace(date)
                    ? new string(date.Where(char.IsDigit).ToArray())
                    : DateTime.Now.ToString("yyyyMMdd");
                var targetFiles = new List<FileInfo>();

                // Get all log files ordered by latest.
                // Note: some servers might archive rotated logs (e.g. *.log.gz), so we include those too.
                var logFiles = logDir.EnumerateFiles()
                    .Where(f =>
                        f.Name.EndsWith(".log", StringComparison.OrdinalIgnoreCase) ||
                        f.Name.EndsWith(".log.gz", StringComparison.OrdinalIgnoreCase))
                    .OrderByDescending(f => f.LastWriteTimeUtc)
                    .ToList();

                // Find all files matching the date pattern
                targetFiles = logFiles.Where(f => f.Name.Contains(targetDate)).ToList();

                // If a specific date was requested and no files were found for that date,
                // return an empty result instead of silently falling back to the latest logs.
                if (!targetFiles.Any())
                {
                    if (!string.IsNullOrWhiteSpace(date))
                    {
                        return Ok(new LogsResponse
                        {
                            Logs = new List<LogEntryDto>(),
                            TotalCount = 0,
                            Page = page,
                            PageSize = pageSize,
                            TotalPages = 0,
                            Message = "لا توجد سجلات لهذا التاريخ"
                        });
                    }

                    // No specific date requested: fall back to the most recent log file if available
                    if (logFiles.Any())
                    {
                        targetFiles.Add(logFiles.First());
                    }
                }

                if (!targetFiles.Any())
                {
                    return Ok(new LogsResponse { Logs = new List<LogEntryDto>(), TotalCount = 0, Message = "لا توجد ملفات سجلات" });
                }

                // Read all entries from ALL target files
                var allEntries = new List<LogEntryDto>();
                foreach (var file in targetFiles)
                {
                    allEntries.AddRange(ReadLogFile(file.FullName, level));
                }

                // Filter by search query if provided
                if (!string.IsNullOrWhiteSpace(search))
                {
                    var searchTerm = search.Trim();
                    allEntries = allEntries.Where(l =>
                        l.Message.Contains(searchTerm, StringComparison.OrdinalIgnoreCase) ||
                        l.Level.Contains(searchTerm, StringComparison.OrdinalIgnoreCase)
                    ).ToList();
                }

                // Sort by timestamp descending (most recent first)
                allEntries = allEntries.OrderByDescending(l => l.Timestamp).ToList();

                // Get total count of FILTERED results
                var totalCount = allEntries.Count;
                var totalPages = (int)Math.Ceiling((double)totalCount / pageSize);

                // Apply pagination
                var paginatedResult = allEntries
                    .Skip((page - 1) * pageSize)
                    .Take(pageSize)
                    .ToList();

                return Ok(new LogsResponse
                {
                    Logs = paginatedResult,
                    TotalCount = totalCount,
                    Page = page,
                    PageSize = pageSize,
                    TotalPages = totalPages
                });

            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error reading log files");
                return StatusCode(500, new { message = "خطأ في قراءة ملفات السجلات" });
            }
        }

        /// <summary>
        /// Get list of available log files.
        /// </summary>
        [HttpGet("files")]
        [ProducesResponseType(typeof(LogFilesResponse), 200)]
        public IActionResult GetLogFiles()
        {
            try
            {
                var logDir = new DirectoryInfo(_logsPath);
                if (!logDir.Exists)
                {
                    return Ok(new LogFilesResponse { Files = new List<LogFileInfo>() });
                }

                var files = logDir.EnumerateFiles()
                    .Where(f =>
                        f.Name.EndsWith(".log", StringComparison.OrdinalIgnoreCase) ||
                        f.Name.EndsWith(".log.gz", StringComparison.OrdinalIgnoreCase))
                    .OrderByDescending(f => f.LastWriteTimeUtc)
                    .Select(f => new LogFileInfo
                    {
                        Name = f.Name,
                        SizeBytes = f.Length,
                        SizeFormatted = FormatBytes(f.Length),
                        LastModified = f.LastWriteTimeUtc
                    })
                    .ToList();

                return Ok(new LogFilesResponse { Files = files });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error listing log files");
                return StatusCode(500, new { message = "خطأ في قراءة قائمة الملفات" });
            }
        }

        private List<LogEntryDto> ReadLogFile(string filePath, string levelFilter)
        {
            var entries = new List<LogEntryDto>();

            // Read file with shared access (so Serilog can still write)
            // Support gzip-archived logs (.log.gz) if present on the server.
            using var fs = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
            Stream contentStream = fs;
            if (filePath.EndsWith(".gz", StringComparison.OrdinalIgnoreCase))
            {
                contentStream = new GZipStream(fs, CompressionMode.Decompress);
            }
            using var reader = new StreamReader(contentStream);

            string? line;
            var lineNumber = 0;

            // Regex to parse Serilog default format: 2026-01-11 21:06:42.249 +02:00 [INF] Message
            var logPattern = new Regex(@"^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}(?:\.\d+)?)\s+([+-]\d{2}:\d{2})?\s*\[(\w{3})\]\s*(.+)$");

            while ((line = reader.ReadLine()) != null)
            {
                lineNumber++;
                var match = logPattern.Match(line);

                if (match.Success)
                {
                    var level = match.Groups[3].Value; // INF, WRN, ERR

                    // Apply level filter
                    if (levelFilter != "All" && level != levelFilter)
                        continue;

                    // Skip verbose EF Core logs
                    var message = match.Groups[4].Value;
                    if (message.StartsWith("Executed DbCommand") || message.StartsWith("SELECT ") || message.StartsWith("INSERT "))
                        continue;

                    // Skip noisy DataProtection and Kestrel logs
                    if (IsNoisyLog(message))
                        continue;

                    // Preserve timezone offset if present, then normalize to UTC for consistent client-side local-time rendering.
                    // Example line: "2026-01-11 21:06:42.249 +02:00 [INF] Message"
                    var timestampText = match.Groups[1].Value;
                    var offsetText = match.Groups[2].Success && !string.IsNullOrWhiteSpace(match.Groups[2].Value)
                        ? match.Groups[2].Value
                        : null;

                    DateTime utcTimestamp;
                    if (offsetText != null &&
                        DateTimeOffset.TryParse(
                            $"{timestampText} {offsetText}",
                            CultureInfo.InvariantCulture,
                            DateTimeStyles.AllowWhiteSpaces,
                            out var dtoWithOffset))
                    {
                        utcTimestamp = dtoWithOffset.UtcDateTime;
                    }
                    else if (DateTimeOffset.TryParse(
                        timestampText,
                        CultureInfo.InvariantCulture,
                        DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal,
                        out var dtoNoOffset))
                    {
                        utcTimestamp = dtoNoOffset.UtcDateTime;
                    }
                    else if (DateTime.TryParse(
                        timestampText,
                        CultureInfo.InvariantCulture,
                        DateTimeStyles.AllowWhiteSpaces | DateTimeStyles.AssumeLocal,
                        out var fallbackTimestamp))
                    {
                        utcTimestamp = fallbackTimestamp.Kind == DateTimeKind.Utc
                            ? fallbackTimestamp
                            : fallbackTimestamp.ToUniversalTime();
                    }
                    else
                    {
                        continue;
                    }

                    {
                        entries.Add(new LogEntryDto
                        {
                            LineNumber = lineNumber,
                            Timestamp = utcTimestamp,
                            Level = level,
                            LevelArabic = GetArabicLevel(level),
                            Message = message
                        });
                    }
                }
            }

            return entries;
        }

        private static bool IsNoisyLog(string message)
        {
            if (string.IsNullOrWhiteSpace(message)) return true;

            // Kestrel startup noise
            if (message.Contains("Overriding HTTP_PORTS")) return true;

            // Data Protection noise (ephemeral keys) in containers
            if (message.Contains("No XML encryptor configured")) return true;
            if (message.Contains("Neither user profile nor HKLM registry available")) return true;
            if (message.Contains("Using an in-memory repository")) return true;
            if (message.Contains("Key {") && message.Contains("} may be persisted to storage in unencrypted form")) return true;

            return false;
        }

        private static string GetArabicLevel(string level) => level switch
        {
            "INF" => "معلومات",
            "WRN" => "تحذير",
            "ERR" => "خطأ",
            "DBG" => "تصحيح",
            _ => level
        };

        private static string TruncateMessage(string message, int maxLength)
        {
            if (message.Length <= maxLength) return message;
            return message.Substring(0, maxLength) + "...";
        }

        private static string FormatBytes(long bytes)
        {
            if (bytes < 1024) return $"{bytes} B";
            if (bytes < 1024 * 1024) return $"{bytes / 1024.0:F1} KB";
            return $"{bytes / (1024.0 * 1024.0):F1} MB";
        }
    }

    public class LogsResponse
    {
        public List<LogEntryDto> Logs { get; set; } = new();
        public int TotalCount { get; set; }
        public int Page { get; set; }
        public int PageSize { get; set; }
        public int TotalPages { get; set; }
        public string? Message { get; set; }
    }

    public class LogEntryDto
    {
        public int LineNumber { get; set; }
        public DateTime Timestamp { get; set; }
        public string Level { get; set; } = "";
        public string LevelArabic { get; set; } = "";
        public string Message { get; set; } = "";
    }

    public class LogFilesResponse
    {
        public List<LogFileInfo> Files { get; set; } = new();
    }

    public class LogFileInfo
    {
        public string Name { get; set; } = "";
        public long SizeBytes { get; set; }
        public string SizeFormatted { get; set; } = "";
        public DateTime LastModified { get; set; }
    }
}
