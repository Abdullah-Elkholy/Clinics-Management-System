using Microsoft.Extensions.DependencyInjection;
using Clinics.Application.Interfaces;
using Clinics.Application.Mappers;
using Clinics.Infrastructure.Persistence;
using Clinics.Infrastructure.Services;

namespace Clinics.Infrastructure.Extensions
{
    /// <summary>
    /// Dependency Injection Extension - Centralizes DI registration
    /// Follows the Composition Root pattern
    /// Makes Program.cs cleaner and more maintainable
    /// </summary>
    public static class DependencyInjectionExtensions
    {
        /// <summary>
        /// Register Application layer services
        /// </summary>
        public static IServiceCollection AddApplicationServices(this IServiceCollection services)
        {
            // Mappers
            services.AddScoped<IAuthMapper, AuthMapper>();

            return services;
        }

        /// <summary>
        /// Register Infrastructure layer services
        /// </summary>
        public static IServiceCollection AddInfrastructureServices(this IServiceCollection services)
        {
            // Unit of Work and Repositories
            services.AddScoped<IUnitOfWork, UnitOfWork>();

            // Services
            services.AddScoped<ITokenService, JwtTokenService>();
            services.AddScoped<IMessageProcessor, QueuedMessageProcessor>();

            return services;
        }
    }
}
