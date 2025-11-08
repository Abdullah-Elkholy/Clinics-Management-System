namespace Clinics.Api.DTOs
{
    public class CreateUserRequest
    {
        public string Username { get; set; } = null!;
        public string FirstName { get; set; } = null!;
        public string? LastName { get; set; }
        public string Role { get; set; } = "user";
        public string? Password { get; set; }
        public int? ModeratorId { get; set; }
    }
}