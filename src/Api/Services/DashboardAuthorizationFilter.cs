using Hangfire.Dashboard;
using Microsoft.AspNetCore.Http;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Linq;

// Hangfire dashboard authorization: accept cookie auth or Authorization: Bearer <token>
public class DashboardAuthorizationFilter : IDashboardAuthorizationFilter
{
    public bool Authorize(DashboardContext context)
    {
        var httpContext = context.GetHttpContext();
        // If user is already authenticated via cookie/principal, check role
        if (httpContext.User?.Identity?.IsAuthenticated ?? false)
        {
            if (httpContext.User.IsInRole("primary_admin") || httpContext.User.IsInRole("secondary_admin")) return true;
        }

        // Otherwise, check Authorization header for Bearer token
        var authHeader = httpContext.Request.Headers["Authorization"].FirstOrDefault();
        if (!string.IsNullOrEmpty(authHeader) && authHeader.StartsWith("Bearer "))
        {
            var token = authHeader.Substring("Bearer ".Length).Trim();
            try
            {
                var key = httpContext.RequestServices.GetService(typeof(Microsoft.Extensions.Configuration.IConfiguration)) as Microsoft.Extensions.Configuration.IConfiguration;
                var jwtKey = key?["Jwt:Key"] ?? "ReplaceWithStrongKey";
                var tokenHandler = new JwtSecurityTokenHandler();
                var validations = new TokenValidationParameters
                {
                    ValidateIssuer = false,
                    ValidateAudience = false,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
                };
                var principal = tokenHandler.ValidateToken(token, validations, out var validatedToken);
                if (principal.IsInRole("primary_admin") || principal.IsInRole("secondary_admin")) return true;
            }
            catch
            {
                return false;
            }
        }

        return false;
    }
}
