using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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

            // Try to get logs path from configuration or environment variable
            var configuredLogsPath = _configuration["LogPaths:Directory"]
                ?? Environment.GetEnvironmentVariable("LOGS_PATH");

            if (!string.IsNullOrEmpty(configuredLogsPath))
            {
                _logsPath = configuredLogsPath;
            }
            else
            {
                // Default to standard logs folder inside API root
                // This matches the new configuration in Program.cs and appsettings.json
                _logsPath = Path.Combine(_env.ContentRootPath, "logs");
            }
        }

        /// <summary>
        /// Get recent system logs from log files.
        /// </summary>
        /// <param name="date">Filter by date in YYYY-MM-DD format (optional, defaults to today)</param>
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

                // Determine which log files to read based on date
                string targetDate = date ?? DateTime.Now.ToString("yyyyMMdd");
                var targetFiles = new List<FileInfo>();

                // Get all log files ordered by latest
                var logFiles = logDir.GetFiles("*.log").OrderByDescending(f => f.LastWriteTimeUtc).ToList();

                // Find all files matching the date pattern
                targetFiles = logFiles.Where(f => f.Name.Contains(targetDate)).ToList();

                // Fallback: If no files found for the date, and no specific date was requested (or just to keep existing behavior safe), 
                // try to load the most recent file if we have nothing. 
                // However, strictly speaking, if a date IS provided and not found, we might want empty. 
                // But preserving previous logic: if target is empty, grab the first one.
                if (!targetFiles.Any() && logFiles.Any())
                {
                    // Only fallback if date was NOT explicitly provided (i.e. default load)
                    // Or follow previous logic which always fell back. Let's stick to safe fallback for now if the list is empty.
                    targetFiles.Add(logFiles.First());
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

                var files = logDir.GetFiles("*.log")
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
            using var fs = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
            using var reader = new StreamReader(fs);

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

                    if (DateTime.TryParse(match.Groups[1].Value, out var timestamp))
                    {
                        entries.Add(new LogEntryDto
                        {
                            LineNumber = lineNumber,
                            Timestamp = timestamp,
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
