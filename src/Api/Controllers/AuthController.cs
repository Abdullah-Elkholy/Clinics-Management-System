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
        public async Task<IActionResult> Login([FromBody] LoginRequest req)
        {
            var user = await _db.Users.Include(u => u.Role).FirstOrDefaultAsync(u => u.Username == req.Username);
            if (user == null) return Unauthorized(new { success = false, errors = new[]{ new { code = "InvalidCredentials", message = "Invalid username or password" } } });

            // For scaffold: PasswordHash may be null (seeded). Accept 'admin' without hash for demo
            var valid = false;
            var hasher = new PasswordHasher<Domain.User>();
            if (string.IsNullOrEmpty(user.PasswordHash) && req.Password == "admin") valid = true;
            else if (!string.IsNullOrEmpty(user.PasswordHash))
            {
                var verification = hasher.VerifyHashedPassword(user, user.PasswordHash, req.Password);
                valid = verification != PasswordVerificationResult.Failed;
            }

            if (!valid) return Unauthorized(new { success = false, errors = new[]{ new { code = "InvalidCredentials", message = "Invalid username or password" } } });

            var token = _tokenService.CreateToken(user.Id, user.Username, user.Role?.Name ?? "user", user.FullName);
            // create refresh token and set cookie
            var refreshToken = _sessionService.CreateRefreshToken(user.Id, TimeSpan.FromDays(30));
            var cookieOptions = new Microsoft.AspNetCore.Http.CookieOptions
            {
                HttpOnly = true,
                SameSite = Microsoft.AspNetCore.Http.SameSiteMode.None,
                Expires = DateTime.UtcNow.AddDays(30),
                Secure = !_env.IsDevelopment()
            };
            Response.Cookies.Append("refreshToken", refreshToken, cookieOptions);

            var res = new LoginResponse {
                AccessToken = token,
                ExpiresIn = 3600,
                User = new UserDto { Id = user.Id, Username = user.Username, FullName = user.FullName, Role = user.Role?.Name ?? "user" }
            };

            return Ok(new { success = true, data = res });
        }

        [HttpPost("refresh")]
        public IActionResult Refresh()
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

            var newAccess = _tokenService.CreateToken(user.Id, user.Username, user.Role?.Name ?? "user", user.FullName);
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
