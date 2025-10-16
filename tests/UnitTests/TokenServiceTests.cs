using Xunit;
using Microsoft.Extensions.Configuration;
using Clinics.Api.Services;
using FluentAssertions;
using System.Collections.Generic;

namespace UnitTests;

public class TokenServiceTests
{
    [Fact]
    public void CreateToken_Returns_NonEmptyString()
    {
        var inMemorySettings = new Dictionary<string, string> {
            { "Jwt:Key", "TestKey_ThisIsALongerKeyForHmacSha256_ReplaceInProduction_123456" }
        };
        IConfiguration config = new ConfigurationBuilder().AddInMemoryCollection(inMemorySettings).Build();
        var svc = new TokenService(config);
        var token = svc.CreateToken(1, "bob", "user", "Bob Test");
        token.Should().NotBeNullOrWhiteSpace();
    }
}