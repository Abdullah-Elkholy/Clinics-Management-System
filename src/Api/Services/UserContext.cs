using System;
using System.Security.Claims;

namespace Clinics.Api.Services
{
    /// <summary>
    /// Interface for extracting user context from HTTP claims.
    /// Unified access point for auth information across all controllers and services.
    /// </summary>
    public interface IUserContext
    {
        /// <summary>
        /// Get the current user's ID from claims (ClaimTypes.NameIdentifier or custom "userId").
        /// </summary>
        int GetUserId();

        /// <summary>
        /// Get the current user's role (from ClaimTypes.Role).
        /// </summary>
        string GetRole();

        /// <summary>
        /// Get the effective moderator ID for the current user.
        /// - If user is a moderator/admin: returns their own ID
        /// - If user is a regular user: returns their assigned ModeratorId
        /// </summary>
        int? GetModeratorId();

        /// <summary>
        /// Check if the current user is an admin (primary or secondary).
        /// </summary>
        bool IsAdmin();

        /// <summary>
        /// Check if the current user is a moderator.
        /// </summary>
        bool IsModerator();
    }

    /// <summary>
    /// Implementation of IUserContext.
    /// Extracts user information from HTTP request claims.
    /// </summary>
    public class UserContext : IUserContext
    {
        private readonly IHttpContextAccessor _httpContextAccessor;

        public UserContext(IHttpContextAccessor httpContextAccessor)
        {
            _httpContextAccessor = httpContextAccessor ?? throw new ArgumentNullException(nameof(httpContextAccessor));
        }

        public int GetUserId()
        {
            var user = _httpContextAccessor.HttpContext?.User;
            if (user == null)
                throw new InvalidOperationException("HttpContext or user is null");

            // Try ClaimTypes.NameIdentifier first (standard claim)
            var userIdClaim = user.FindFirst(ClaimTypes.NameIdentifier);
            if (userIdClaim != null && int.TryParse(userIdClaim.Value, out int userId))
                return userId;

            // Fallback to custom "userId" claim (for backward compatibility)
            userIdClaim = user.FindFirst("userId");
            if (userIdClaim != null && int.TryParse(userIdClaim.Value, out userId))
                return userId;

            throw new InvalidOperationException("User ID claim not found");
        }

        public string GetRole()
        {
            var user = _httpContextAccessor.HttpContext?.User;
            if (user == null)
                throw new InvalidOperationException("HttpContext or user is null");

            var roleClaim = user.FindFirst(ClaimTypes.Role);
            if (roleClaim == null)
                throw new InvalidOperationException("Role claim not found");

            return roleClaim.Value;
        }

        public int? GetModeratorId()
        {
            var user = _httpContextAccessor.HttpContext?.User;
            if (user == null)
                throw new InvalidOperationException("HttpContext or user is null");

            // Try custom "moderatorId" claim (set by auth service for non-admin users)
            var moderatorIdClaim = user.FindFirst("moderatorId");
            if (moderatorIdClaim != null && int.TryParse(moderatorIdClaim.Value, out int moderatorId))
                return moderatorId;

            // For moderators/admins, they are their own moderator
            var role = GetRole();
            if (role == "moderator" || role.Contains("admin"))
            {
                return GetUserId();
            }

            // For regular users, this should be set by auth service
            return null;
        }

        public bool IsAdmin()
        {
            var role = GetRole();
            return role == "primary_admin" || role == "secondary_admin";
        }

        public bool IsModerator()
        {
            var role = GetRole();
            return role == "moderator";
        }
    }
}
