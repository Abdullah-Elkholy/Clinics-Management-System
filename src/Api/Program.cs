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

// Configure Serilog early so startup logs are captured
Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Debug()
    .MinimumLevel.Override("Microsoft", LogEventLevel.Information)
    .Enrich.FromLogContext()
    .WriteTo.File("logs/clinics-.log", rollingInterval: RollingInterval.Day, retainedFileCountLimit: 14)
    .CreateLogger();

var builder = WebApplication.CreateBuilder(new WebApplicationOptions { Args = args });
builder.Host.UseSerilog();

// Add services
builder.Services.AddControllers().AddJsonOptions(opt =>
{
    // Use camelCase serialization so API responses match frontend and test expectations
    opt.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    opt.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
});
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
builder.Services.AddScoped<QuotaService>();
builder.Services.AddScoped<IUserContext, UserContext>();
builder.Services.AddScoped<IConditionValidationService, ConditionValidationService>();
builder.Services.AddScoped<IPatientPositionService, PatientPositionService>();  // Add missing service
builder.Services.AddScoped<IPhonePlaceholderService, PhonePlaceholderService>();  // Add phone placeholder service
// Cascade services for soft-delete operations
builder.Services.AddScoped<IGenericUnitOfWork, GenericUnitOfWork>();
builder.Services.AddScoped<IAuditService, AuditService>();
builder.Services.AddScoped<Clinics.Api.Services.IQueueCascadeService, Clinics.Api.Services.QueueCascadeService>();
// Also register the Infrastructure QueueCascadeService for QuotaService which depends on it
builder.Services.AddScoped<Clinics.Infrastructure.Services.IQueueCascadeService, Clinics.Infrastructure.Services.QueueCascadeService>();
builder.Services.AddScoped<Clinics.Api.Services.ITemplateCascadeService, Clinics.Api.Services.TemplateCascadeService>();
builder.Services.AddScoped<Clinics.Api.Services.IPatientCascadeService, Clinics.Api.Services.PatientCascadeService>();
builder.Services.AddScoped<Clinics.Api.Services.IUserCascadeService, Clinics.Api.Services.UserCascadeService>();
builder.Services.AddScoped<IModeratorCascadeService, ModeratorCascadeService>();

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
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

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
    builder.Services.AddDbContext<ApplicationDbContext>(options => options.UseSqlServer(defaultConn));
    // Configure Hangfire to use SQL Server storage (persistent job storage)
    builder.Services.AddHangfire(config => config.UseSqlServerStorage(defaultConn));
}
else
{
    builder.Services.AddDbContext<ApplicationDbContext>(options => options.UseInMemoryDatabase("ClinicsDemoDb"));
    builder.Services.AddHangfire(config => config.UseMemoryStorage());
}

// Only add Hangfire server in non-test environments
// In tests, server startup causes timeout issues during cleanup
if (!builder.Environment.IsEnvironment("Test"))
{
    builder.Services.AddHangfireServer();
}

// message sender and processor
builder.Services.AddScoped<IMessageSender, SimulatedMessageSender>();
builder.Services.AddScoped<IMessageProcessor, MessageProcessor>();

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
try
{
    RecurringJob.AddOrUpdate<IMessageProcessor>("process-queued-messages", proc => proc.ProcessQueuedMessagesAsync(50), "*/15 * * * * *");
}
catch { }

app.Run();

// Expose Program class for integration testing (WebApplicationFactory)
public partial class Program { }
