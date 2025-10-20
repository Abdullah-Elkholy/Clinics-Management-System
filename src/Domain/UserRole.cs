namespace Clinics.Domain
{
    // Static set of roles used across the system. Kept as enum for strong-typing in server code.
    public enum UserRole
    {
        PrimaryAdmin = 0,
        SecondaryAdmin = 1,
        Moderator = 2,
        User = 3
    }

    public static class UserRoleExtensions
    {
        public static string ToRoleName(this UserRole r)
        {
            return r switch
            {
                UserRole.PrimaryAdmin => "primary_admin",
                UserRole.SecondaryAdmin => "secondary_admin",
                UserRole.Moderator => "moderator",
                _ => "user",
            };
        }

        public static UserRole FromRoleName(string? name)
        {
            if (string.IsNullOrWhiteSpace(name)) return UserRole.User;
            return name switch
            {
                "primary_admin" => UserRole.PrimaryAdmin,
                "secondary_admin" => UserRole.SecondaryAdmin,
                "moderator" => UserRole.Moderator,
                _ => UserRole.User,
            };
        }
    }
}
