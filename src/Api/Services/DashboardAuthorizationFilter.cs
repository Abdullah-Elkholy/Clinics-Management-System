using Hangfire.Dashboard;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;
using System.IdentityModel.Tokens.Jwt;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Linq;
using System.Net;

// Hangfire dashboard authorization: accept cookie auth or Authorization: Bearer <token>
// SECURITY: In production, only localhost access is allowed (use SSH tunnel)
public class DashboardAuthorizationFilter : IDashboardAuthorizationFilter
{
    public bool Authorize(DashboardContext context)
    {
        var httpContext = context.GetHttpContext();

        // SECURITY: In production, only localhost can access (via SSH tunnel)
        // SSH tunnel provides authentication, so we trust localhost requests
        var env = httpContext.RequestServices.GetService(typeof(IWebHostEnvironment)) as IWebHostEnvironment;
        if (env != null && !env.IsDevelopment())
        {
            var remoteIp = httpContext.Connection.RemoteIpAddress;
            var isLocalhost = remoteIp != null && (
                IPAddress.IsLoopback(remoteIp) ||
                remoteIp.Equals(IPAddress.IPv6Loopback) ||
                remoteIp.ToString() == "::1" ||
                remoteIp.ToString() == "127.0.0.1");

            // In production: localhost = allowed (SSH tunnel), external = blocked
            return isLocalhost;
        }

        // In development, check for admin role authentication
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
