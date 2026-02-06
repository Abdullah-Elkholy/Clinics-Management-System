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
using Hangfire.PostgreSql;
using Hangfire.Dashboard;
using Hangfire.MemoryStorage;
using System.Security.Claims;
using Clinics.Api.Services.Telemetry;
using Clinics.Api.Middleware;
using System.Globalization;
using Microsoft.AspNetCore.DataProtection;

var builder = WebApplication.CreateBuilder(new WebApplicationOptions { Args = args });

// Configure Serilog to log to the same global folder as the service API
// This ensures all logs are in one place for easier monitoring.
static bool IsBusinessLogEvent(Serilog.Events.LogEvent logEvent)
    => logEvent.MessageTemplate.Text.StartsWith("[Business]", StringComparison.Ordinal);

var mainLogPath = builder.Configuration["LogPaths:Main"] ?? "logs/main-.log";
var businessLogPath = builder.Configuration["LogPaths:Business"] ?? "logs/business-.log";

var mainOutputTemplate = "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {Message:lj}{NewLine}{Exception}";

Log.Logger = new LoggerConfiguration()
    // Read MinimumLevel + Enrich from configuration (WriteTo is intentionally empty in config)
    .ReadFrom.Configuration(builder.Configuration)

    // Non-business logs: console + main file
    .WriteTo.Logger(lc => lc
        .Filter.ByExcluding(IsBusinessLogEvent)
        .WriteTo.Console())
    .WriteTo.Logger(lc => lc
        .Filter.ByExcluding(IsBusinessLogEvent)
        .WriteTo.File(
            path: mainLogPath,
            rollingInterval: RollingInterval.Day,
            rollOnFileSizeLimit: true,
            fileSizeLimitBytes: 10 * 1024 * 1024,
            retainedFileCountLimit: 30,
            encoding: new UTF8Encoding(encoderShouldEmitUTF8Identifier: false),
            outputTemplate: mainOutputTemplate))

    // Business logs: UTF-8 file only (keeps Arabic safe and avoids console "???")
    .WriteTo.Logger(lc => lc
        .Filter.ByIncludingOnly(IsBusinessLogEvent)
        .WriteTo.File(
            path: businessLogPath,
            rollingInterval: RollingInterval.Day,
            rollOnFileSizeLimit: true,
            fileSizeLimitBytes: 10 * 1024 * 1024,
            retainedFileCountLimit: 30,
            encoding: new UTF8Encoding(encoderShouldEmitUTF8Identifier: false),
            outputTemplate: mainOutputTemplate))
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

// Configure Data Protection to persist keys to a specific directory
// This prevents "No XML encryptor configured" warnings and keeps keys safe across restarts/deployments
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(builder.Environment.ContentRootPath, "DataProtection-Keys")));

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
    var allowedOrigins = (builder.Configuration["AllowedOrigins"] ?? "")
                            .Split(new[] { ';', ',' }, StringSplitOptions.RemoveEmptyEntries)
                            .Select(o => o.Trim())
                            .ToList();

    // In Development, ensure localhost is allowed for easier testing
    if (builder.Environment.IsDevelopment())
    {
        allowedOrigins.Add("http://localhost:3000");
        allowedOrigins.Add("https://localhost:3000");
        allowedOrigins.Add("http://127.0.0.1:3000");
        allowedOrigins.Add("https://127.0.0.1:3000");
    }

    options.AddDefaultPolicy(policy =>
    {
        var originList = allowedOrigins.Distinct().ToArray();
        if (originList.Any())
        {
            policy.WithOrigins(originList)
                  .AllowAnyMethod()
                  .AllowAnyHeader()
                  .AllowCredentials();
        }
    });

    // Separate policy for browser extensions
    var extensionOrigins = (builder.Configuration["ExtensionOrigins"] ?? "")
                            .Split(new[] { ';', ',' }, StringSplitOptions.RemoveEmptyEntries)
                            .Select(o => o.Trim())
                            .ToList();

    options.AddPolicy("ExtensionPolicy", policy =>
    {
        if (builder.Environment.IsDevelopment())
        {
            // In Dev, allow any extension scheme to facilitate debugging
            policy.SetIsOriginAllowed(origin =>
               origin.StartsWith("chrome-extension://") ||
               origin.StartsWith("moz-extension://"))
              .AllowAnyMethod()
              .AllowAnyHeader();
        }
        else
        {
            // In Prod, usually strictly limit to the specific extension ID
            var extOriginList = extensionOrigins.Distinct().ToArray();
            if (extOriginList.Any())
            {
                policy.WithOrigins(extOriginList)
                      .AllowAnyMethod()
                      .AllowAnyHeader();
            }
            else
            {
                // Fallback if no specific extension ID provided in prod configuration
                policy.SetIsOriginAllowed(origin =>
                   origin.StartsWith("chrome-extension://") ||
                   origin.StartsWith("moz-extension://"))
                  .AllowAnyMethod()
                  .AllowAnyHeader();
            }
        }
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

// Determine database provider: "PostgreSQL" for production, "SqlServer" for development (default)
var databaseProvider = builder.Configuration["DatabaseProvider"] ?? Environment.GetEnvironmentVariable("DATABASE_PROVIDER") ?? "SqlServer";
var isPostgreSQL = databaseProvider.Equals("PostgreSQL", StringComparison.OrdinalIgnoreCase);

// Configure ApplicationDbContext: supports SQL Server, PostgreSQL, or InMemory fallback
if (!string.IsNullOrEmpty(defaultConn))
{
    builder.Services.AddDbContext<ApplicationDbContext>((serviceProvider, options) =>
    {
        if (isPostgreSQL)
        {
            options.UseNpgsql(defaultConn);
        }
        else
        {
            options.UseSqlServer(defaultConn);
        }
        // Add interceptors: SignalR notifications and audit fields auto-population
        options.AddInterceptors(
            serviceProvider.GetRequiredService<Clinics.Api.Interceptors.AuditFieldsInterceptor>(),
            serviceProvider.GetRequiredService<Clinics.Api.Interceptors.ChangeNotificationInterceptor>()
        );
    });

    // Configure Hangfire storage based on database provider
    if (isPostgreSQL)
    {
        builder.Services.AddHangfire(config => config.UsePostgreSqlStorage(opts => opts.UseNpgsqlConnection(defaultConn)));
    }
    else
    {
        builder.Services.AddHangfire(config => config.UseSqlServerStorage(defaultConn));
    }
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
builder.Services.AddScoped<CpuMonitorJob>(); // Security: CPU monitoring for detecting cryptominers

// Extension Runner services for browser extension-based WhatsApp automation
builder.Services.Configure<Clinics.Api.Services.Extension.WhatsAppProviderOptions>(
    builder.Configuration.GetSection(Clinics.Api.Services.Extension.WhatsAppProviderOptions.SectionName));
builder.Services.AddScoped<Clinics.Api.Services.Extension.IExtensionPairingService, Clinics.Api.Services.Extension.ExtensionPairingService>();
builder.Services.AddScoped<Clinics.Api.Services.Extension.IExtensionLeaseService, Clinics.Api.Services.Extension.ExtensionLeaseService>();
builder.Services.AddScoped<Clinics.Api.Services.Extension.IExtensionCommandService, Clinics.Api.Services.Extension.ExtensionCommandService>();
builder.Services.AddScoped<Clinics.Api.Services.Extension.IWhatsAppProvider, Clinics.Api.Services.Extension.ExtensionRunnerProvider>();
builder.Services.AddScoped<Clinics.Api.Services.Extension.IWhatsAppProviderFactory, Clinics.Api.Services.Extension.WhatsAppProviderFactory>();
builder.Services.AddScoped<Clinics.Api.Services.Extension.ICheckWhatsAppService, Clinics.Api.Services.Extension.CheckWhatsAppService>();
builder.Services.AddScoped<Clinics.Api.Services.Extension.ExtensionCommandCleanupService>(); // DEF-007/008/009: Cleanup orphaned commands and messages

// Telemetry provider for system performance monitoring
builder.Services.AddHttpClient<ITelemetryProvider, TelemetryProvider>();

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

// System diagnostics middleware for performance monitoring
app.UseMiddleware<SystemDiagnosticsMiddleware>();

// DEBUG: Verify routing works
app.MapGet("/api/test", () => Results.Text("API Routing Works", "text/plain"));

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

        // Apply migrations automatically (EnsureCreated does not work with Migrations)
        db.Database.Migrate();

        var utcNow = DateTime.UtcNow;

        // Seed required default users if Users table is empty or contains only the root user
        var existingUserCount = db.Users.Count();
        var onlyRootExists = existingUserCount == 1 && db.Users.All(u => u.Username == "root" && u.Role == "primary_admin");
        if (existingUserCount == 0 || onlyRootExists)
        {
            // If only root exists, remove it first so seeding re-creates all users with correct IDs
            if (onlyRootExists)
            {
                db.Users.RemoveRange(db.Users);
                db.SaveChanges();
            }
            var root = new User
            {
                Id = 1,
                Username = "root",
                PasswordHash = "AQAAAAIAAYagAAAAEOVl/Goh0ms6V7NLVmQCGR+EdEBstXbq5tARgYqkjcBvrR/Gx5YJ+FOtr4lFlV7ylg==",
                FirstName = "عمدة",
                LastName = "الكل ف الكل",
                Role = "primary_admin",
                ModeratorId = null,
                CreatedAt = utcNow,
                UpdatedAt = null,
                UpdatedBy = null,
                LastLogin = null,
                IsDeleted = false,
                DeletedAt = null,
                DeletedBy = null,
                RestoredAt = null,
                RestoredBy = null
            };
            //Username: admin Password: admin123
            var admin = new User
            {
                Id = 2,
                Username = "admin",
                PasswordHash = "AQAAAAIAAYagAAAAEFis02t8W90rJ6Pkqw6wwD45hx6QI2ArKLqW8tl77SnIidCWW43DLldUP2G1BhxkXw==",
                FirstName = "عمدة",
                LastName = "الكل ف الكل",
                Role = "primary_admin",
                ModeratorId = null,
                CreatedAt = utcNow,
                UpdatedAt = null,
                UpdatedBy = null,
                LastLogin = null,
                IsDeleted = false,
                DeletedAt = null,
                DeletedBy = null,
                RestoredAt = null,
                RestoredBy = null
            };

            //Username: admin2 Password: admin123
            var admin2 = new User
            {
                Id = 3,
                Username = "admin2",
                PasswordHash = "AQAAAAIAAYagAAAAEFmtEKOGKA5/ficlHNopu3+fZ1ly0ocuBAvJgl59wxjRQgGSFDlPgKNa+KR2a8vpTA==",
                FirstName = "عمدة",
                LastName = "المدير الاستبن",
                Role = "secondary_admin",
                ModeratorId = null,
                CreatedAt = utcNow,
                UpdatedAt = null,
                UpdatedBy = null,
                LastLogin = null,
                IsDeleted = false,
                DeletedAt = null,
                DeletedBy = null,
                RestoredAt = null,
                RestoredBy = null
            };

            //Username: mod1 Password: mod123
            var mod1 = new User
            {
                Id = 4,
                Username = "mod1",
                PasswordHash = "AQAAAAIAAYagAAAAED2rs9SjaX3pu2CTEnn+zQ7BZmyYeHWYnD6QLOnwpthfMlk96bElhUhm7ElTbIDKlQ==",
                FirstName = "عمدة",
                LastName = "المشرف",
                Role = "moderator",
                ModeratorId = null,
                CreatedAt = utcNow,
                UpdatedAt = null,
                UpdatedBy = null,
                LastLogin = null,
                IsDeleted = false,
                DeletedAt = null,
                DeletedBy = null,
                RestoredAt = null,
                RestoredBy = null
            };

            //Username: user1 Password: user123
            var user1 = new User
            {
                Id = 5,
                Username = "user1",
                PasswordHash = "AQAAAAIAAYagAAAAEAl24nxVIY22QRB5OdNaWSlDWAVFL0NJRq5VxIpS2ReFYDg3Vh1KbnJbsNOnQPC/kw==",
                FirstName = "عمدة",
                LastName = "المستخدم",
                Role = "user",
                ModeratorId = 4,
                CreatedAt = utcNow,
                UpdatedAt = null,
                UpdatedBy = null,
                LastLogin = null,
                IsDeleted = false,
                DeletedAt = null,
                DeletedBy = null,
                RestoredAt = null,
                RestoredBy = null
            };

            // Force explicit IDs: requires special handling per provider
            if (!string.IsNullOrEmpty(defaultConn) && !isPostgreSQL)
            {
                // SQL Server: IDENTITY_INSERT must be ON for explicit IDs
                using var transaction = db.Database.BeginTransaction();
                db.Database.ExecuteSqlRaw("SET IDENTITY_INSERT [Users] ON");
                db.Users.AddRange(root, admin, admin2, mod1, user1);
                db.SaveChanges();
                db.Database.ExecuteSqlRaw("SET IDENTITY_INSERT [Users] OFF");
                transaction.Commit();
            }
            else
            {
                db.Users.AddRange(root, admin, admin2, mod1, user1);
                db.SaveChanges();

                if (isPostgreSQL)
                {
                    // Reset identity sequence so next auto-generated ID won't conflict
                    db.Database.ExecuteSqlRaw(
                        @"SELECT setval(pg_get_serial_sequence('""Users""', 'Id'), (SELECT COALESCE(MAX(""Id""), 1) FROM ""Users""))");
                }
            }

            // Seed demo queue for mod1 (moderator)
            if (!db.Queues.Any())
            {
                var demoQueue = new Queue
                {
                    DoctorName = "عيادة ميدتاون",
                    ModeratorId = 4, // mod1's ID
                    CreatedAt = utcNow,
                    UpdatedAt = null,
                    CreatedBy = 4,
                    UpdatedBy = null,
                    IsDeleted = false
                };

                db.Queues.Add(demoQueue);
                db.SaveChanges();

                // Seed DEFAULT message template with condition
                var defaultCondition = new MessageCondition
                {
                    TemplateId = null, // Will be set after template is created
                    QueueId = demoQueue.Id,
                    Operator = "DEFAULT",
                    Value = null,
                    MinValue = null,
                    MaxValue = null,
                    CreatedAt = utcNow,
                    UpdatedAt = null,
                    CreatedBy = 4,
                    UpdatedBy = null
                };
                var equalCondition = new MessageCondition
                {
                    TemplateId = null, // Will be set after template is created
                    QueueId = demoQueue.Id,
                    Operator = "EQUAL",
                    Value = 4,
                    MinValue = null,
                    MaxValue = null,
                    CreatedAt = utcNow,
                    UpdatedAt = null,
                    CreatedBy = 4,
                    UpdatedBy = null
                };
                var lessThanCondition = new MessageCondition
                {
                    TemplateId = null, // Will be set after template is created
                    QueueId = demoQueue.Id,
                    Operator = "LESS",
                    Value = 2,
                    MinValue = null,
                    MaxValue = null,
                    CreatedAt = utcNow,
                    UpdatedAt = null,
                    CreatedBy = 4,
                    UpdatedBy = null
                };
                var rangeCondition = new MessageCondition
                {
                    TemplateId = null, // Will be set after template is created
                    QueueId = demoQueue.Id,
                    Operator = "RANGE",
                    Value = null,
                    MinValue = 2,
                    MaxValue = 3,
                    CreatedAt = utcNow,
                    UpdatedAt = null,
                    CreatedBy = 4,
                    UpdatedBy = null
                };
                var greaterThanCondition = new MessageCondition
                {
                    TemplateId = null, // Will be set after template is created
                    QueueId = demoQueue.Id,
                    Operator = "GREATER",
                    Value = 5,
                    MinValue = null,
                    MaxValue = null,
                    CreatedAt = utcNow,
                    UpdatedAt = null,
                    CreatedBy = 4,
                    UpdatedBy = null
                };
                var noCondition = new MessageCondition
                {
                    TemplateId = null, // Will be set after template is created
                    QueueId = demoQueue.Id,
                    Operator = "UNCONDITIONED",
                    Value = null,
                    MinValue = null,
                    MaxValue = null,
                    CreatedAt = utcNow,
                    UpdatedAt = null,
                    CreatedBy = 4,
                    UpdatedBy = null
                };

                db.Set<MessageCondition>().Add(defaultCondition);
                db.Set<MessageCondition>().Add(equalCondition);
                db.Set<MessageCondition>().Add(lessThanCondition);
                db.Set<MessageCondition>().Add(rangeCondition);
                db.Set<MessageCondition>().Add(greaterThanCondition);
                db.Set<MessageCondition>().Add(noCondition);
                db.SaveChanges();

                var defaultTemplate = new Clinics.Domain.MessageTemplate
                {
                    Title = "رسالة الترحيب الافتراضية",
                    Content = @"بص ياكبير انت معادك بعد {ETR}
احلى مسا عليك يا{PN}
ورقمك هو {PQP}, والرقم اللي عليه الدور دلوقتي هو {CQP}
الرسالة دي هتيجي للمريض رقم 4 في الدور ودي الرسالة الافتراضية للي ملوش شرط معين",
                    ModeratorId = 4,
                    QueueId = demoQueue.Id,
                    MessageConditionId = defaultCondition.Id,
                    CreatedAt = utcNow,
                    UpdatedAt = null,
                    CreatedBy = 4,
                    UpdatedBy = null,
                    IsDeleted = false
                };
                var lessThanTemplate = new Clinics.Domain.MessageTemplate
                {
                    Title = "رسالة الترحيب للي أقل من اتنين",
                    Content = "بنجرب الشرط اللي بيعمل أقل من 2",
                    ModeratorId = 4,
                    QueueId = demoQueue.Id,
                    MessageConditionId = lessThanCondition.Id,
                    CreatedAt = utcNow,
                    UpdatedAt = null,
                    CreatedBy = 4,
                    UpdatedBy = null,
                    IsDeleted = false
                };
                var rangeTemplate = new Clinics.Domain.MessageTemplate
                {
                    Title = "رسالة الترحيب للي بين اتنين وتلاتة",
                    Content = "بنجرب الشرط اللي بيعمل بين 2 و3",
                    ModeratorId = 4,
                    QueueId = demoQueue.Id,
                    MessageConditionId = rangeCondition.Id,
                    CreatedAt = utcNow,
                    UpdatedAt = null,
                    CreatedBy = 4,
                    UpdatedBy = null,
                    IsDeleted = false
                };
                var greaterThanTemplate = new Clinics.Domain.MessageTemplate
                {
                    Title = "رسالة الترحيب للي أكبر من خمسة",
                    Content = "بنجرب الشرط اللي بيعمل أكبر من 5",
                    ModeratorId = 4,
                    QueueId = demoQueue.Id,
                    MessageConditionId = greaterThanCondition.Id,
                    CreatedAt = utcNow,
                    UpdatedAt = null,
                    CreatedBy = 4,
                    UpdatedBy = null,
                    IsDeleted = false
                };
                var equalTemplate = new Clinics.Domain.MessageTemplate
                {
                    Title = "رسالة الترحيب للي يساوي أربعة",
                    Content = "بنجرب الشرط اللي بيعمل يساوي 4",
                    ModeratorId = 4,
                    QueueId = demoQueue.Id,
                    MessageConditionId = equalCondition.Id,
                    CreatedAt = utcNow,
                    UpdatedAt = null,
                    CreatedBy = 4,
                    UpdatedBy = null,
                    IsDeleted = false
                };
                var noConditionTemplate = new Clinics.Domain.MessageTemplate
                {
                    Title = "رسالة الترحيب بدون شرط",
                    Content = "مفيش شرط هنا ف الرسالة دي مش هتتبعت خالص",
                    ModeratorId = 4,
                    QueueId = demoQueue.Id,
                    MessageConditionId = noCondition.Id,
                    CreatedAt = utcNow,
                    UpdatedAt = null,
                    CreatedBy = 4,
                    UpdatedBy = null,
                    IsDeleted = false
                };

                db.MessageTemplates.AddRange(defaultTemplate, equalTemplate, lessThanTemplate, rangeTemplate, greaterThanTemplate, noConditionTemplate);
                db.SaveChanges();

                // Update condition with TemplateId
                defaultCondition.TemplateId = defaultTemplate.Id;
                equalCondition.TemplateId = equalTemplate.Id;
                lessThanCondition.TemplateId = lessThanTemplate.Id;
                rangeCondition.TemplateId = rangeTemplate.Id;
                greaterThanCondition.TemplateId = greaterThanTemplate.Id;
                noCondition.TemplateId = noConditionTemplate.Id;
                db.Set<MessageCondition>().Update(defaultCondition);
                db.Set<MessageCondition>().Update(equalCondition);
                db.Set<MessageCondition>().Update(lessThanCondition);
                db.Set<MessageCondition>().Update(rangeCondition);
                db.Set<MessageCondition>().Update(greaterThanCondition);
                db.Set<MessageCondition>().Update(noCondition);
                db.SaveChanges();

                // Seed sample patients
                var samplePatients = new List<Patient>
                {
                    new Patient
                    {
                        FullName = "عبدالله الخولي",
                        PhoneNumber = "1018542431",
                        CountryCode = "+20",
                        Position = 1,
                        QueueId = demoQueue.Id,
                        CreatedAt = utcNow,
                        UpdatedAt = null,
                        CreatedBy = 4,
                        UpdatedBy = null,
                        IsDeleted = false
                    },
                    new Patient
                    {
                        FullName = "اي اسم برقمي تاني",
                        PhoneNumber = "1018542431",
                        CountryCode = "+20",
                        Position = 2,
                        QueueId = demoQueue.Id,
                        CreatedAt = utcNow,
                        UpdatedAt = null,
                        CreatedBy = 4,
                        UpdatedBy = null,
                        IsDeleted = false
                    },
                    new Patient
                    {
                        FullName = "مريم أحمد متسجلة برقمي برضو",
                        PhoneNumber = "1018542431",
                        CountryCode = "+20",
                        Position = 3,
                        QueueId = demoQueue.Id,
                        CreatedAt = utcNow,
                        UpdatedAt = null,
                        CreatedBy = 4,
                        UpdatedBy = null,
                        IsDeleted = false
                    },
                    new Patient
                    {
                        FullName = "رقم غلط",
                        PhoneNumber = "1018542433",
                        CountryCode = "+20",
                        Position = 4,
                        QueueId = demoQueue.Id,
                        CreatedAt = utcNow,
                        UpdatedAt = null,
                        CreatedBy = 4,
                        UpdatedBy = null,
                        IsDeleted = false
                    },
                    new Patient
                    {
                        FullName = "رقم صح",
                        PhoneNumber = "1018542430",
                        CountryCode = "+20",
                        Position = 5,
                        QueueId = demoQueue.Id,
                        CreatedAt = utcNow,
                        UpdatedAt = null,
                        CreatedBy = 4,
                        UpdatedBy = null,
                        IsDeleted = false
                    },
                    new Patient
                    {
                        FullName = "رقم صح تو",
                        PhoneNumber = "1018542432",
                        CountryCode = "+20",
                        Position = 6,
                        QueueId = demoQueue.Id,
                        CreatedAt = utcNow,
                        UpdatedAt = null,
                        CreatedBy = 4,
                        UpdatedBy = null,
                        IsDeleted = false
                    },
                    new Patient
                    {
                        FullName = "رقم غلط زيادة عشان نجرب",
                        PhoneNumber = "1018542433",
                        CountryCode = "+20",
                        Position = 7,
                        QueueId = demoQueue.Id,
                        CreatedAt = utcNow,
                        UpdatedAt = null,
                        CreatedBy = 4,
                        UpdatedBy = null,
                        IsDeleted = false
                    },
                    new Patient
                    {
                        FullName = "آخر رقم غلط عشان نجرب صح",
                        PhoneNumber = "1018542430",
                        CountryCode = "+20",
                        Position = 8,
                        QueueId = demoQueue.Id,
                        CreatedAt = utcNow,
                        UpdatedAt = null,
                        CreatedBy = 4,
                        UpdatedBy = null,
                        IsDeleted = false
                    },
                };

                db.Patients.AddRange(samplePatients);
                db.SaveChanges();
            }
        }
        if (!db.Users.Where(u => u.Username == "root" && u.Role == "primary_admin" && u.IsDeleted == false).Any())
        {
            var root = new User
            {
                Id = 1,
                Username = "root",
                PasswordHash = "AQAAAAIAAYagAAAAEOVl/Goh0ms6V7NLVmQCGR+EdEBstXbq5tARgYqkjcBvrR/Gx5YJ+FOtr4lFlV7ylg==",
                FirstName = "المدير",
                LastName = "الأساسي",
                Role = "primary_admin",
                ModeratorId = null,
                CreatedAt = utcNow,
                UpdatedAt = null,
                UpdatedBy = null,
                LastLogin = null,
                IsDeleted = false,
                DeletedAt = null,
                DeletedBy = null,
                RestoredAt = null,
                RestoredBy = null
            };

            db.Users.Add(root);
            db.SaveChanges();
        }


        // Seed default system settings if missing (covers scenarios where migration seeding is bypassed)
        var settingsToAdd = new List<SystemSettings>();
        if (!db.SystemSettings.Any(s => s.Key == SystemSettingKeys.RateLimitEnabled))
        {
            settingsToAdd.Add(new SystemSettings
            {
                Key = SystemSettingKeys.RateLimitEnabled,
                Value = "true",
                Description = "تفعيل تحديد معدل الإرسال بين الرسائل",
                Category = "RateLimit",
                CreatedAt = utcNow,
                UpdatedAt = null,
                UpdatedBy = null
            });
        }

        if (!db.SystemSettings.Any(s => s.Key == SystemSettingKeys.RateLimitMinSeconds))
        {
            settingsToAdd.Add(new SystemSettings
            {
                Key = SystemSettingKeys.RateLimitMinSeconds,
                Value = "3",
                Description = "الحد الأدنى للتأخير بين الرسائل (بالثواني)",
                Category = "RateLimit",
                CreatedAt = utcNow,
                UpdatedAt = null,
                UpdatedBy = null
            });
        }

        if (!db.SystemSettings.Any(s => s.Key == SystemSettingKeys.RateLimitMaxSeconds))
        {
            settingsToAdd.Add(new SystemSettings
            {
                Key = SystemSettingKeys.RateLimitMaxSeconds,
                Value = "7",
                Description = "الحد الأقصى للتأخير بين الرسائل (بالثواني)",
                Category = "RateLimit",
                CreatedAt = utcNow,
                UpdatedAt = null,
                UpdatedBy = null
            });
        }

        if (settingsToAdd.Count > 0)
        {
            db.SystemSettings.AddRange(settingsToAdd);
            db.SaveChanges();
        }

        // Ensure every moderator has a Quota and WhatsAppSession (idempotent)
        var moderatorIds = db.Users
            .Where(u => u.Role == "moderator" && !u.IsDeleted)
            .Select(u => u.Id)
            .ToList();

        var quotasToAdd = new List<Quota>();
        var sessionsToAdd = new List<WhatsAppSession>();

        foreach (var moderatorId in moderatorIds)
        {
            if (!db.Quotas.Any(q => q.ModeratorUserId == moderatorId))
            {
                quotasToAdd.Add(new Quota
                {
                    ModeratorUserId = moderatorId,
                    MessagesQuota = -1,
                    ConsumedMessages = 0,
                    QueuesQuota = -1,
                    ConsumedQueues = 0,
                    CreatedAt = utcNow,
                    CreatedBy = moderatorId,
                    UpdatedAt = utcNow,
                    UpdatedBy = moderatorId,
                    IsDeleted = false
                });
            }

            if (!db.WhatsAppSessions.Any(s => s.ModeratorUserId == moderatorId))
            {
                sessionsToAdd.Add(new WhatsAppSession
                {
                    ModeratorUserId = moderatorId,
                    Status = "disconnected",
                    CreatedAt = utcNow,
                    CreatedByUserId = moderatorId,
                    LastActivityUserId = moderatorId,
                    LastActivityAt = utcNow,
                    IsPaused = true,
                    PauseReason = "Extension not connected",
                    IsDeleted = false
                });
            }
        }

        if (quotasToAdd.Count > 0)
        {
            db.Quotas.AddRange(quotasToAdd);
        }

        if (sessionsToAdd.Count > 0)
        {
            db.WhatsAppSessions.AddRange(sessionsToAdd);
        }

        if (quotasToAdd.Count > 0 || sessionsToAdd.Count > 0)
        {
            db.SaveChanges();
        }
    }
}
catch (Exception ex)
{
    app.Services.GetRequiredService<ILogger<Program>>().LogError(ex, "Error during migration");
}


// HYBRID MESSAGE PROCESSING: Event-driven + per-moderator recurring + global safety net
// - Event-driven: MessagesController triggers immediate processing after queueing
// - Per-moderator recurring: Safety net catches orphaned messages (60s interval)
// - Global recurring: ExpireTimedOutCommandsAsync + messages without moderator (60s interval)
try
{
    // GLOBAL SAFETY NET: Handles cleanup and edge cases
    // - ExpireTimedOutCommandsAsync (global operation)
    // - Messages without ModeratorId (edge case)
    RecurringJob.AddOrUpdate<ProcessQueuedMessagesJob>(
        "process-queued-messages-global", 
        job => job.ExecuteAsync(), 
        "*/60 * * * * *");  // Reduced from 15s to 60s

    // PER-MODERATOR RECURRING JOBS: Safety net for each active moderator
    using (var scope = app.Services.CreateScope())
    {
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        
        var moderatorIds = db.Users
            .Where(u => u.Role == "moderator" && !u.IsDeleted)
            .Select(u => u.Id)
            .ToList();

        foreach (var moderatorId in moderatorIds)
        {
            RecurringJob.AddOrUpdate<ProcessQueuedMessagesJob>(
                $"process-messages-mod-{moderatorId}",
                job => job.ExecuteForModeratorAsync(moderatorId),
                "*/60 * * * * *");  // Every 60 seconds as safety net
        }

        logger.LogInformation(
            "Registered {Count} per-moderator message processing jobs (safety net, 60s interval)", 
            moderatorIds.Count);
    }

    // Security: Monitor CPU usage every 5 minutes to detect cryptominers
    RecurringJob.AddOrUpdate<CpuMonitorJob>("cpu-security-monitor", job => job.ExecuteAsync(), "*/5 * * * *");

    // DEF-007/008/009: Clean up orphaned extension commands and messages
    RecurringJob.AddOrUpdate<Clinics.Api.Services.Extension.ExtensionCommandCleanupService>(
        "extension-command-cleanup",
        service => service.RunCleanupAsync(),
        "*/60 * * * * *");
}
catch (Exception ex)
{
    app.Services.GetRequiredService<ILogger<Program>>()
        .LogError(ex, "Error registering Hangfire recurring jobs");
}

app.Run();

// Expose Program class for integration testing (WebApplicationFactory)
public partial class Program { }
