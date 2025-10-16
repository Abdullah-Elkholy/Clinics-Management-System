using Microsoft.AspNetCore.Identity;

Console.WriteLine("Enter password to hash:");
var pw = Console.ReadLine() ?? string.Empty;
var hasher = new PasswordHasher<object>();
var hash = hasher.HashPassword(null!, pw);
Console.WriteLine("HASH:");
Console.WriteLine(hash);