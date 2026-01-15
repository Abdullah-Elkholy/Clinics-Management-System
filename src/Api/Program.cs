using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Serilog;
using Serilog.Events;
using Microsoft.EntityFrameworkCore;
using Clinics.Infrastructure;
using Clinics.Infrastructure.Repositories;
using Clinics.Infrastructure.Services;
using Clinics.Domain;
using System.Linq;
using Clinics.Api.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Hangfire;
using Hangfire.SqlServer;
using Hangfire.Dashboard;
using Hangfire.MemoryStorage;
using System.Security.Claims;

var builder = WebApplication.CreateBuilder(new WebApplicationOptions { Args = args });

// Configure Serilog to log to the same global folder as the service API
// This ensures all logs are in one place for easier monitoring.
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .CreateLogger();

builder.Host.UseSerilog();

// Add services
builder.Services.AddControllers().AddJsonOptions(opt =>
{
    // Use camelCase serialization so API responses match frontend and test expectations
    opt.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    opt.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
});
builder.Services.AddMemoryCache();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    var xmlFile = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
    {
        options.IncludeXmlComments(xmlPath, includeControllerXmlComments: true);
    }
    options.SchemaFilter<Clinics.Api.Swagger.OperatorSchemaFilter>();
});

// (DbContext registration will be configured after we resolve the connection string below)

// Services
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<ISessionService, SessionService>();
builder.Services.AddScoped<Clinics.Application.Interfaces.IQuotaService, QuotaService>();
builder.Services.AddScoped<QuotaService>(); // Also register concrete class for controllers that need extended methods
builder.Services.AddScoped<IUserContext, UserContext>();
builder.Services.AddScoped<IConditionValidationService, ConditionValidationService>();
builder.Services.AddScoped<IPatientPositionService, PatientPositionService>();  // Add missing service
builder.Services.AddScoped<IPhonePlaceholderService, PhonePlaceholderService>();  // Add phone placeholder service
builder.Services.AddScoped<IArabicErrorMessageService, ArabicErrorMessageService>();  // Arabic error message translation
builder.Services.AddScoped<IContentVariableResolver, ContentVariableResolver>();  // Template variable resolution
builder.Services.AddSingleton<IdempotencyService>();  // Idempotency service for request deduplication
builder.Services.AddSingleton<CircuitBreakerService>();  // Circuit breaker for WhatsApp service resilience
// Cascade services for soft-delete operations
builder.Services.AddScoped<IGenericUnitOfWork, GenericUnitOfWork>();
// IAuditService and AuditService REMOVED - deprecated
builder.Services.AddScoped<Clinics.Api.Services.IMessageSessionCascadeService, Clinics.Api.Services.MessageSessionCascadeService>();
builder.Services.AddScoped<Clinics.Api.Services.IQueueCascadeService, Clinics.Api.Services.QueueCascadeService>();
// Infrastructure.Services.IQueueCascadeService REMOVED - consolidated to Api.Services
builder.Services.AddScoped<Clinics.Api.Services.ITemplateCascadeService, Clinics.Api.Services.TemplateCascadeService>();
builder.Services.AddScoped<Clinics.Api.Services.IPatientCascadeService, Clinics.Api.Services.PatientCascadeService>();
builder.Services.AddScoped<Clinics.Api.Services.IUserCascadeService, Clinics.Api.Services.UserCascadeService>();
builder.Services.AddScoped<Clinics.Api.Services.IModeratorCascadeService, Clinics.Api.Services.ModeratorCascadeService>();

// Rate limiting service for message sending delays
builder.Services.AddScoped<Clinics.Api.Services.IRateLimitSettingsService, Clinics.Api.Services.RateLimitSettingsService>();

// JWT Auth
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
}).AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;

    var useTestKey = builder.Configuration["USE_TEST_KEY"] == "true";
    var baseKey = useTestKey
        ? "TestKey_ThisIsALongerKeyForHmacSha256_ReplaceInProduction_123456"
        : (builder.Configuration["Jwt:Key"] ?? "ReplaceWithStrongKey_UseEnvOrConfig_ChangeThisToASecureValue!");

    byte[] signingKeyBytes;
    using (var sha = System.Security.Cryptography.SHA256.Create())
    {
        signingKeyBytes = sha.ComputeHash(Encoding.UTF8.GetBytes(baseKey));
    }

    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = false,
        ValidateAudience = false,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(signingKeyBytes),
        // For tests, we can relax clock skew
        ClockSkew = TimeSpan.FromSeconds(30)
    };

    // Validate that user is not soft-deleted on each request
    options.Events = new Microsoft.AspNetCore.Authentication.JwtBearer.JwtBearerEvents
    {
        OnTokenValidated = async context =>
        {
            var dbContext = context.HttpContext.RequestServices.GetRequiredService<ApplicationDbContext>();

            // Extract user ID from claims
            var userIdClaim = context.Principal?.Claims.FirstOrDefault(c =>
                c.Type == System.Security.Claims.ClaimTypes.NameIdentifier ||
                c.Type == "sub" ||
                c.Type == "userId");

            if (userIdClaim != null && int.TryParse(userIdClaim.Value, out int userId))
            {
                var user = await dbContext.Users.FirstOrDefaultAsync(u => u.Id == userId);

                // Reject token if user is deleted or doesn't exist
                if (user == null || user.IsDeleted)
                {
                    context.Fail("User account has been deleted");
                    return;
                }
            }
        }
    };
});

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        // When AllowCredentials() is used you must explicitly list allowed origins.
        // Cannot use AllowAnyOrigin() with AllowCredentials() - specify exact origins
        policy.WithOrigins(
                  "http://localhost:3000",
                  "http://127.0.0.1:3000",
                  "https://localhost:3000",
                  "https://127.0.0.1:3000"
              )
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials(); // Required for HttpOnly cookies and SignalR
    });

    // Separate policy for browser extensions (they don't need credentials for pairing)
    options.AddPolicy("ExtensionPolicy", policy =>
    {
        policy.SetIsOriginAllowed(origin =>
                origin.StartsWith("chrome-extension://") ||
                origin.StartsWith("moz-extension://") ||
                origin.StartsWith("http://localhost") ||
                origin.StartsWith("https://localhost"))
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

// Add SignalR services for real-time updates
builder.Services.AddSignalR(options =>
{
    // Configure SignalR options
    options.EnableDetailedErrors = builder.Environment.IsDevelopment();
    options.KeepAliveInterval = TimeSpan.FromSeconds(15);
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(30);
    options.HandshakeTimeout = TimeSpan.FromSeconds(15);
});

// Register the ChangeNotificationInterceptor as a scoped service
builder.Services.AddScoped<Clinics.Api.Interceptors.ChangeNotificationInterceptor>();
builder.Services.AddScoped<Clinics.Api.Interceptors.AuditFieldsInterceptor>();

// Resolve connection string (prefer configured DefaultConnection). Only use LocalSqlServer fallback when USE_LOCAL_SQL=true.
var defaultConn = builder.Configuration.GetConnectionString("DefaultConnection") ?? builder.Configuration["ConnectionStrings:Default"];
var useLocalSql = (builder.Configuration["USE_LOCAL_SQL"] ?? Environment.GetEnvironmentVariable("USE_LOCAL_SQL")) == "true";
if (string.IsNullOrEmpty(defaultConn) && useLocalSql)
{
    defaultConn = builder.Configuration["LocalSqlServer"] ?? "Server=BODYELKHOLY\\SQL2022;Database=ClinicsDb;User Id=sa;Password=123456;TrustServerCertificate=True;";
}

// Configure ApplicationDbContext: prefer SQL Server when we have a connection string, otherwise use InMemory for quick demo
if (!string.IsNullOrEmpty(defaultConn))
{
    builder.Services.AddDbContext<ApplicationDbContext>((serviceProvider, options) =>
    {
        options.UseSqlServer(defaultConn);
        // Add interceptors: SignalR notifications and audit fields auto-population
        options.AddInterceptors(
            serviceProvider.GetRequiredService<Clinics.Api.Interceptors.AuditFieldsInterceptor>(),
            serviceProvider.GetRequiredService<Clinics.Api.Interceptors.ChangeNotificationInterceptor>()
        );
    });
    // Configure Hangfire to use SQL Server storage (persistent job storage)
    builder.Services.AddHangfire(config => config.UseSqlServerStorage(defaultConn));
}
else
{
    builder.Services.AddDbContext<ApplicationDbContext>((serviceProvider, options) =>
    {
        options.UseInMemoryDatabase("ClinicsDemoDb");
        // Add interceptors: SignalR notifications and audit fields auto-population
        options.AddInterceptors(
            serviceProvider.GetRequiredService<Clinics.Api.Interceptors.AuditFieldsInterceptor>(),
            serviceProvider.GetRequiredService<Clinics.Api.Interceptors.ChangeNotificationInterceptor>()
        );
    });
    builder.Services.AddHangfire(config => config.UseMemoryStorage());
}

// Only add Hangfire server in non-test environments
// In tests, server startup causes timeout issues during cleanup
if (!builder.Environment.IsEnvironment("Test"))
{
    builder.Services.AddHangfireServer();
}

// Register legacy sender (fallback)
builder.Services.AddScoped<IMessageSender, SimulatedMessageSender>();

// message processor (uses extension provider directly)
builder.Services.AddScoped<IMessageProcessor, MessageProcessor>();
builder.Services.AddScoped<ProcessQueuedMessagesJob>(); // Wrapper job with [DisableConcurrentExecution]

// Extension Runner services for browser extension-based WhatsApp automation
builder.Services.Configure<Clinics.Api.Services.Extension.WhatsAppProviderOptions>(
    builder.Configuration.GetSection(Clinics.Api.Services.Extension.WhatsAppProviderOptions.SectionName));
builder.Services.AddScoped<Clinics.Api.Services.Extension.IExtensionPairingService, Clinics.Api.Services.Extension.ExtensionPairingService>();
builder.Services.AddScoped<Clinics.Api.Services.Extension.IExtensionLeaseService, Clinics.Api.Services.Extension.ExtensionLeaseService>();
builder.Services.AddScoped<Clinics.Api.Services.Extension.IExtensionCommandService, Clinics.Api.Services.Extension.ExtensionCommandService>();
builder.Services.AddScoped<Clinics.Api.Services.Extension.IWhatsAppProvider, Clinics.Api.Services.Extension.ExtensionRunnerProvider>();
builder.Services.AddScoped<Clinics.Api.Services.Extension.IWhatsAppProviderFactory, Clinics.Api.Services.Extension.WhatsAppProviderFactory>();
builder.Services.AddScoped<Clinics.Api.Services.Extension.ICheckWhatsAppService, Clinics.Api.Services.Extension.CheckWhatsAppService>();

// Authorization policies
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy => policy.RequireRole("primary_admin", "secondary_admin"));
    options.AddPolicy("ModeratorOrAbove", policy => policy.RequireRole("moderator", "secondary_admin", "primary_admin"));
    options.AddPolicy("AuthenticatedUser", policy => policy.RequireAuthenticatedUser());
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Protect Hangfire dashboard: only Admin roles should access
app.UseHangfireDashboard("/hangfire", new DashboardOptions
{
    Authorization = new[] { new DashboardAuthorizationFilter() }
});

// Middleware ordering: Routing -> CORS -> Auth -> Map controllers
app.UseRouting();
app.UseCors();
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();
// Cookie policy for refresh token (HttpOnly cookie usage planned)
app.UseCookiePolicy();
app.MapControllers();

// Map SignalR hub endpoint
app.MapHub<Clinics.Api.Hubs.DataUpdateHub>("/dataUpdateHub");

// Map Extension SignalR hub endpoint for browser extension communication
app.MapHub<Clinics.Api.Hubs.ExtensionHub>("/extensionHub");

// Lightweight health endpoint for CI/CD readiness and Playwright waits
// Returns 200 OK when the application has started routing/middleware.
// Does not require authentication.
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));


// Seed sample data and apply migrations automatically on startup
try
{
    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        // Apply any pending migrations (including seeded data in migration)
        db.Database.Migrate();
    }
}
catch (Exception ex)
{
    app.Services.GetRequiredService<ILogger<Program>>().LogError(ex, "Error during migration");
}


// schedule hangfire recurring job every 15 seconds (demo)
// P0.1: Using ProcessQueuedMessagesJob wrapper with [DisableConcurrentExecution] attribute
// This ensures only one processor runs at a time, preventing duplicate message sends
try
{
    RecurringJob.AddOrUpdate<ProcessQueuedMessagesJob>("process-queued-messages", job => job.ExecuteAsync(), "*/15 * * * * *");
}
catch { }

app.Run();

// Expose Program class for integration testing (WebApplicationFactory)
public partial class Program { }
