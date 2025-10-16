using Xunit;
using Clinics.Api.Services;
using Microsoft.Extensions.Configuration;
using System.Collections.Generic;
using FluentAssertions;
using System;

namespace UnitTests;

public class TokenServiceEdgeTests
{
    [Fact]
    public void CreateToken_WithoutKey_UsesDefaultButProducesToken()
    {
        // No Jwt:Key provided
        IConfiguration config = new ConfigurationBuilder().Build();
        var svc = new TokenService(config);
        var token = svc.CreateToken(1, "bob", "user", "Bob");
        token.Should().NotBeNullOrWhiteSpace();
    }

    [Fact]
    public void CreateToken_WithShortKey_StillCreatesToken()
    {
        var dict = new Dictionary<string,string> { { "Jwt:Key", "short" } };
        IConfiguration config = new ConfigurationBuilder().AddInMemoryCollection(dict).Build();
        var svc = new TokenService(config);
        Action act = () => svc.CreateToken(1, "bob", "user", "Bob");
        // Even with a short key the code will create a token; ensure it's not empty
        act.Should().NotThrow();
        svc.CreateToken(1, "bob", "user", "Bob").Should().NotBeNullOrWhiteSpace();
    }
}