using System;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.Tasks;
using Clinics.Application.Interfaces;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;

namespace Clinics.Infrastructure.Services
{
    /// <summary>
    /// JWT Token Service Implementation
    /// Implements ITokenService interface (Dependency Inversion)
    /// Handles token creation and validation
    /// Single Responsibility: Only manages JWT operations
    /// </summary>
    public class JwtTokenService : ITokenService
    {
        private readonly IConfiguration _config;
        private readonly byte[] _signingKeyBytes;

        public JwtTokenService(IConfiguration config)
        {
            _config = config ?? throw new ArgumentNullException(nameof(config));
            _signingKeyBytes = DeriveSigningKey();
        }

        public string CreateToken(int userId, string username, string role, string fullName)
        {
            var claims = new[] 
            {
                new Claim(JwtRegisteredClaimNames.Sub, userId.ToString()),
                new Claim(ClaimTypes.Name, username),
                new Claim(ClaimTypes.Role, role),
                new Claim("role", role),
                new Claim("fullName", fullName),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
            };

            var key = new SymmetricSecurityKey(_signingKeyBytes);
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

            var token = new JwtSecurityToken(
                issuer: _config["Jwt:Issuer"],
                audience: _config["Jwt:Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddHours(2),
                signingCredentials: credentials
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        public async Task<bool> ValidateTokenAsync(string token)
        {
            try
            {
                var handler = new JwtSecurityTokenHandler();
                var key = new SymmetricSecurityKey(_signingKeyBytes);

                handler.ValidateToken(token, new TokenValidationParameters
                {
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = key,
                    ValidateIssuer = false,
                    ValidateAudience = false,
                    ValidateLifetime = true,
                    ClockSkew = TimeSpan.FromSeconds(30)
                }, out SecurityToken validatedToken);

                return await Task.FromResult(validatedToken != null);
            }
            catch
            {
                return false;
            }
        }

        private byte[] DeriveSigningKey()
        {
            var useTestKey = _config["USE_TEST_KEY"] == "true";
            var baseKey = useTestKey
                ? "TestKey_ThisIsALongerKeyForHmacSha256_ReplaceInProduction_123456"
                : (_config["Jwt:Key"] ?? "ReplaceWithStrongKey_UseEnvOrConfig_ChangeThisToASecureValue!");

            using (var sha = System.Security.Cryptography.SHA256.Create())
            {
                return sha.ComputeHash(Encoding.UTF8.GetBytes(baseKey));
            }
        }
    }
}
