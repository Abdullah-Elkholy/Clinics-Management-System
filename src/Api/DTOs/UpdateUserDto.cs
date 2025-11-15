namespace Clinics.Api.DTOs
{
    public class UpdateUserRequest
    {
        public string? FirstName { get; set; }
        public string? LastName { get; set; }
        public string? Username { get; set; }
        public string? CurrentPassword { get; set; }
        public string? Password { get; set; }
    }
}
