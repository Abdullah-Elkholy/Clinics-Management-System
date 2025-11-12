using Clinics.Application.DTOs.Auth;
using Clinics.Domain;

namespace Clinics.Application.Mappers
{
    /// <summary>
    /// Mapper interface following the Interface Segregation Principle (ISP)
    /// Separates mapping concerns for different entities
    /// </summary>
    public interface IAuthMapper
    {
        UserDto MapToUserDto(User user);
        User MapToUserEntity(LoginRequestDto request);
    }

    /// <summary>
    /// Auth Mapper Implementation
    /// Handles conversion between User entity and UserDto
    /// </summary>
    public class AuthMapper : IAuthMapper
    {
        public UserDto MapToUserDto(User user)
        {
            return new UserDto
            {
                Id = user.Id,
                Username = user.Username,
                FirstName = user.FirstName,
                LastName = user.LastName,
                Role = user.Role
            };
        }

        public User MapToUserEntity(LoginRequestDto request)
        {
            return new User
            {
                Username = request.Username,
            };
        }
    }
}
