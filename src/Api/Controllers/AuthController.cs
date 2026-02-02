using Microsoft.AspNetCore.Mvc;
using Clinics.Api.DTOs;
using Clinics.Infrastructure;
using Microsoft.AspNetCore.Identity;
using Clinics.Api.Services;
using Microsoft.EntityFrameworkCore;

namespace Clinics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AuthController : ControllerBase
    {
        private readonly ApplicationDbContext _db;
        private readonly ITokenService _tokenService;
        private readonly ISessionService _sessionService;
        private readonly IWebHostEnvironment _env;
        private readonly ILogger<AuthController> _logger;

        public AuthController(ApplicationDbContext db, ITokenService tokenService, ISessionService sessionService, IWebHostEnvironment env, ILogger<AuthController> logger)
        {
            _db = db;
            _tokenService = tokenService;
            _sessionService = sessionService;
            _env = env;
            _logger = logger;
        }

        [HttpPost("login")]
        [Microsoft.AspNetCore.Authorization.AllowAnonymous]
        public async Task<IActionResult> Login([FromBody] LoginRequest? req)
        {
            try
            {
                // If model binding failed (invalid JSON or wrong content-type), attempt a tolerant fallback:
                // - enable request buffering so we can read the body even after model binding attempted to consume it
                // - if the raw body looks like form-encoded (username=...), parse that
                // - if it's JSON, try deserializing with case-insensitive option
                if (req == null)
                {
                    try
                    {
                        Request.EnableBuffering();
                    }
                    catch { /* No-op if buffering already enabled */ }

                    // rewind and read raw body
                    Request.Body.Position = 0;
                    using (var sr = new System.IO.StreamReader(Request.Body, System.Text.Encoding.UTF8, detectEncodingFromByteOrderMarks: false, leaveOpen: true))
                    {
                        var bodyStr = await sr.ReadToEndAsync();
                        // rewind so other middleware won't be broken
                        Request.Body.Position = 0;

                        if (!string.IsNullOrWhiteSpace(bodyStr))
                        {
                            // If looks like JSON, try to deserialize
                            bodyStr = bodyStr.Trim();
                            if (bodyStr.StartsWith("{") || bodyStr.StartsWith("["))
                            {
                                try
                                {
                                    req = System.Text.Json.JsonSerializer.Deserialize<LoginRequest>(bodyStr, new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                                }
                                catch { /* ignore and fallback to form parse */ }
                            }

                            // If still null and body looks like form data (username=...&password=...)
                            if (req == null && (bodyStr.Contains('=') || bodyStr.Contains('&')))
                            {
                                try
                                {
                                    var parsed = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(bodyStr);
                                    var username = parsed.TryGetValue("username", out var u) ? u.ToString() : parsed.TryGetValue("Username", out var U) ? U.ToString() : null;
                                    var password = parsed.TryGetValue("password", out var p) ? p.ToString() : parsed.TryGetValue("Password", out var P) ? P.ToString() : null;
                                    if (!string.IsNullOrEmpty(username) && !string.IsNullOrEmpty(password)) req = new LoginRequest { Username = username, Password = password };
                                }
                                catch { /* ignore */ }
                            }
                        }
                    }
                }

                if (req == null)
                {
                    return BadRequest(new { success = false, errors = new[] { new { code = "InvalidRequest", message = "Invalid or missing request body. Expected JSON { \"username\":..., \"password\":... } or form-encoded username=...&password=..." } } });
                }

                // Validate empty/whitespace username or password
                if (string.IsNullOrWhiteSpace(req.Username) || string.IsNullOrWhiteSpace(req.Password))
                {
                    _logger.LogWarning("Login attempt with empty credentials from IP: {IpAddress}", HttpContext.Connection.RemoteIpAddress);
                    return BadRequest(new { success = false, errors = new[] { new { code = "MissingCredentials", message = "Username and password are required" } } });
                }

                var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == req.Username && !u.IsDeleted);
                if (user == null)
                {
                    _logger.LogWarning("Failed login - user not found: {Username} from IP: {IpAddress}", req.Username, HttpContext.Connection.RemoteIpAddress);
                    return Unauthorized(new { success = false, errors = new[]{ new { code = "InvalidCredentials", message = "Invalid username or password" } } });
                }

                // For scaffold: PasswordHash may be null (seeded). Accept 'admin' without hash for demo
                var valid = false;
                var hasher = new PasswordHasher<Domain.User>();
                if (string.IsNullOrEmpty(user.PasswordHash) && req.Password == "admin") valid = true;
                else if (!string.IsNullOrEmpty(user.PasswordHash) && req.Password != null)
                {
                    var verification = hasher.VerifyHashedPassword(user, user.PasswordHash, req.Password);
                    valid = verification != PasswordVerificationResult.Failed;
                }

                if (!valid)
                {
                    _logger.LogWarning("Failed login - invalid password for user: {Username} (UserId: {UserId}) from IP: {IpAddress}", user.Username, user.Id, HttpContext.Connection.RemoteIpAddress);
                    return Unauthorized(new { success = false, errors = new[]{ new { code = "InvalidCredentials", message = "Invalid username or password" } } });
                }

                // Update last login timestamp
                user.LastLogin = DateTime.UtcNow;
                await _db.SaveChangesAsync();

                // Use Role property directly (now stores the role name string)
                var token = _tokenService.CreateToken(user.Id, user.Username, user.Role, user.FirstName, user.LastName);
                
                // Log successful login
                _logger.LogInformation("Successful login for user: {Username} (UserId: {UserId}, Role: {Role}) from IP: {IpAddress}", user.Username, user.Id, user.Role, HttpContext.Connection.RemoteIpAddress);
                
                // create refresh token and set cookie
                var refreshToken = _sessionService.CreateRefreshToken(user.Id, TimeSpan.FromDays(7));
                var isDevelopment = _env.IsDevelopment();
                var cookieOptions = new CookieOptions
                {
                    HttpOnly = true,
                    // Strict in production (same-origin), None in dev for cross-site (localhost:3000 -> localhost:5000)
                    SameSite = isDevelopment ? SameSiteMode.None : SameSiteMode.Strict,
                    Secure = true, // Always secure in production (HTTPS)
                    Expires = DateTime.UtcNow.AddDays(7)
                };
                Response.Cookies.Append("refreshToken", refreshToken, cookieOptions);

                return Ok(new { success = true, data = new { accessToken = token } });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Login error for username: {Username} from IP: {IpAddress}. Error: {ErrorMessage}", req?.Username ?? "unknown", HttpContext.Connection.RemoteIpAddress, ex.Message);
                return StatusCode(500, new { success = false, errors = new[] { new { code = "InternalError", message = "حدث خطأ أثناء تسجيل الدخول. يرجى المحاولة مرة أخرى لاحقاً." } } });
            }
        }

        [HttpGet("me")]
        [Microsoft.AspNetCore.Authorization.Authorize]
        public async Task<IActionResult> GetCurrentUser()
        {
            // Try multiple claim types for user ID
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == System.Security.Claims.ClaimTypes.NameIdentifier)
                ?? User.Claims.FirstOrDefault(c => c.Type == "sub")
                ?? User.Claims.FirstOrDefault(c => c.Type == "userId");
                
            if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var userId))
            {
                return Unauthorized();
            }

            var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId && !u.IsDeleted);
            if (user == null)
            {
                return Unauthorized(new { success = false, error = "User account has been deleted" });
            }

            var roleDisplayName = Clinics.Domain.UserRoleExtensions.GetDisplayNameFromRoleName(user.Role);
            return Ok(new { 
                success = true, 
                data = new { 
                    user.Id, 
                    user.Username, 
                    user.FirstName,
                    user.LastName,
                    Role = user.Role,
                    RoleDisplayName = roleDisplayName,
                    AssignedModerator = user.ModeratorId
                } 
            });
        }

        [HttpPost("refresh")]
        public IActionResult RefreshToken()
        {
            if (!Request.Cookies.TryGetValue("refreshToken", out var token))
                return Unauthorized(new { success = false });

            if (!Guid.TryParse(token, out var sessionId)) return Unauthorized(new { success = false });

            // in a real flow, decode session to find user; here we search
            var session = _db.Sessions.FirstOrDefault(s => s.Id == sessionId);
            if (session == null || session.ExpiresAt <= DateTime.UtcNow) return Unauthorized(new { success = false });

            var user = _db.Users.FirstOrDefault(u => u.Id == session.UserId && !u.IsDeleted);
            if (user == null) return Unauthorized(new { success = false, error = "User account has been deleted" });

            // rotate refresh token: revoke old session and create a new one
            _sessionService.RevokeSession(session.Id);
            var newRefresh = _sessionService.CreateRefreshToken(user.Id, TimeSpan.FromDays(30));
            
            // Environment-aware cookie settings: Test env uses Secure=false, others use Secure=true with SameSite=None
            var isTestEnv = _env.IsEnvironment("Test");
            var cookieOptions = new Microsoft.AspNetCore.Http.CookieOptions
            {
                HttpOnly = true,
                SameSite = isTestEnv ? Microsoft.AspNetCore.Http.SameSiteMode.Strict : Microsoft.AspNetCore.Http.SameSiteMode.None,
                Expires = DateTime.UtcNow.AddDays(30),
                Secure = !isTestEnv
            };
            Response.Cookies.Append("refreshToken", newRefresh, cookieOptions);

            var newAccess = _tokenService.CreateToken(user.Id, user.Username, user.Role, user.FirstName, user.LastName);
            return Ok(new { success = true, data = new { accessToken = newAccess, expiresIn = 3600 } });
        }

        [HttpPost("logout")]
        [Microsoft.AspNetCore.Authorization.AllowAnonymous]
        public IActionResult Logout()
        {
            if (Request.Cookies.TryGetValue("refreshToken", out var token))
            {
                if (Guid.TryParse(token, out var sessionId))
                {
                    _sessionService.RevokeSession(sessionId);
                }
            }
            Response.Cookies.Delete("refreshToken");
            return Ok(new { success = true });
        }
    }
}
