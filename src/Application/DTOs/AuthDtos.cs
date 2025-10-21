namespace Clinics.Application.DTOs.Auth
{
    /// <summary>
    /// DTO for authentication requests
    /// Separates presentation layer concerns from domain entities
    /// </summary>
    public class LoginRequestDto
    {
        public string Username { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
    }

    /// <summary>
    /// DTO for authentication responses
    /// Prevents exposing unnecessary user data
    /// </summary>
    public class LoginResponseDto
    {
        public bool Success { get; set; }
        public string? Token { get; set; }
        public string? RefreshToken { get; set; }
        public UserDto? User { get; set; }
        public string? Message { get; set; }
    }

    /// <summary>
    /// User data transfer object
    /// Only exposes necessary user information to client
    /// </summary>
    public class UserDto
    {
        public int Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public string FullName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string? Email { get; set; }
        public string? PhoneNumber { get; set; }
    }
}
