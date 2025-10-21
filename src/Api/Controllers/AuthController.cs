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

        public AuthController(ApplicationDbContext db, ITokenService tokenService, ISessionService sessionService, IWebHostEnvironment env)
        {
            _db = db;
            _tokenService = tokenService;
            _sessionService = sessionService;
            _env = env;
        }

        [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest? req)
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
                                if (!string.IsNullOrEmpty(username)) req = new LoginRequest { Username = username, Password = password };
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

            var user = await _db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Username == req.Username);
            if (user == null) return Unauthorized(new { success = false, errors = new[]{ new { code = "InvalidCredentials", message = "Invalid username or password" } } });

            // For scaffold: PasswordHash may be null (seeded). Accept 'admin' without hash for demo
            var valid = false;
            var hasher = new PasswordHasher<Domain.User>();
            if (string.IsNullOrEmpty(user.PasswordHash) && req.Password == "admin") valid = true;
            else if (!string.IsNullOrEmpty(user.PasswordHash) && req.Password != null)
            {
                var verification = hasher.VerifyHashedPassword(user, user.PasswordHash, req.Password);
                valid = verification != PasswordVerificationResult.Failed;
            }

            if (!valid) return Unauthorized(new { success = false, errors = new[]{ new { code = "InvalidCredentials", message = "Invalid username or password" } } });

            // Use Role property directly (now stores the role name string)
            var token = _tokenService.CreateToken(user.Id, user.Username, user.Role, user.FullName);
            // create refresh token and set cookie
            var refreshToken = _sessionService.CreateRefreshToken(user.Id, TimeSpan.FromDays(7));
            Response.Cookies.Append("X-Refresh-Token", refreshToken, new CookieOptions { HttpOnly = true, Secure = !_env.IsDevelopment(), SameSite = SameSiteMode.Strict, Expires = DateTime.UtcNow.AddDays(7) });

            return Ok(new { success = true, data = new { accessToken = token } });
        }

        [HttpGet("me")]
        [Microsoft.AspNetCore.Authorization.Authorize]
        public async Task<IActionResult> GetCurrentUser()
        {
            var userIdClaim = User.Claims.FirstOrDefault(c => c.Type == System.Security.Claims.ClaimTypes.NameIdentifier);
            if (userIdClaim == null || !int.TryParse(userIdClaim.Value, out var userId))
            {
                return Unauthorized();
            }

            var user = await _db.Users.FirstOrDefaultAsync(u => u.Id == userId);
            if (user == null)
            {
                return NotFound();
            }

            var roleDisplayName = Clinics.Domain.UserRoleExtensions.GetDisplayNameFromRoleName(user.Role);
            return Ok(new { 
                success = true, 
                data = new { 
                    user.Id, 
                    user.Username, 
                    user.FullName, 
                    Role = user.Role,
                    RoleDisplayName = roleDisplayName
                } 
            });
        }

        [HttpPost("refresh")]
        public async Task<IActionResult> RefreshToken()
        {
            if (!Request.Cookies.TryGetValue("refreshToken", out var token))
                return Unauthorized(new { success = false });

            if (!Guid.TryParse(token, out var sessionId)) return Unauthorized(new { success = false });

            // in a real flow, decode session to find user; here we search
            var session = _db.Sessions.FirstOrDefault(s => s.Id == sessionId);
            if (session == null || session.ExpiresAt <= DateTime.UtcNow) return Unauthorized(new { success = false });

            var user = _db.Users.Include(u => u.Role).FirstOrDefault(u => u.Id == session.UserId);
            if (user == null) return Unauthorized(new { success = false });

            // rotate refresh token: revoke old session and create a new one
            _sessionService.RevokeSession(session.Id);
            var newRefresh = _sessionService.CreateRefreshToken(user.Id, TimeSpan.FromDays(30));
            var cookieOptions = new Microsoft.AspNetCore.Http.CookieOptions
            {
                HttpOnly = true,
                SameSite = Microsoft.AspNetCore.Http.SameSiteMode.None,
                Expires = DateTime.UtcNow.AddDays(30),
                Secure = true
            };
            Response.Cookies.Append("refreshToken", newRefresh, cookieOptions);

            var newAccess = _tokenService.CreateToken(user.Id, user.Username, user.Role, user.FullName);
            return Ok(new { success = true, data = new { accessToken = newAccess, expiresIn = 3600 } });
        }

        [HttpPost("logout")]
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
