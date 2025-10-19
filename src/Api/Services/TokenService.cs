using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace Clinics.Api.Services
{
    public interface ITokenService
    {
        string CreateToken(int userId, string username, string role, string fullName);
    }

    public class TokenService : ITokenService
    {
        private readonly IConfiguration _config;
        public TokenService(IConfiguration config)
        {
            _config = config;
        }

        public string CreateToken(int userId, string username, string role, string fullName)
        {
            var claims = new[] {
                new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
                new Claim(ClaimTypes.Name, username),
                new Claim(ClaimTypes.Role, role),
                new Claim("role", role),
                new Claim("fullName", fullName),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            // Use configured Jwt:Key if present; otherwise a secure default.
            var defaultKey = "ReplaceWithStrongKey_UseEnvOrConfig_ChangeThisToASecureValue!";
            var baseKey = string.IsNullOrEmpty(_config["Jwt:Key"]) ? defaultKey : _config["Jwt:Key"]!;

            // Derive a stable 256-bit key via SHA-256 from the baseKey so HMAC-SHA256 signing requirements are satisfied
            byte[] keyBytes;
            using (var sha = System.Security.Cryptography.SHA256.Create())
            {
                keyBytes = sha.ComputeHash(Encoding.UTF8.GetBytes(baseKey));
            }

            var key = new SymmetricSecurityKey(keyBytes);
            var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: _config["Jwt:Issuer"],
                audience: _config["Jwt:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddHours(2),
                signingCredentials: creds
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
    }
}
