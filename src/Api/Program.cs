using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.EntityFrameworkCore;
using Clinics.Infrastructure;
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

var builder = WebApplication.CreateBuilder(args);

// Add services
builder.Services.AddControllers().AddJsonOptions(opt =>
{
    // Keep property naming as-is on serialization but accept case-insensitive property names from clients
    opt.JsonSerializerOptions.PropertyNamingPolicy = null;
    opt.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// (DbContext registration will be configured after we resolve the connection string below)

// JWT Auth
builder.Services.AddScoped<ITokenService, TokenService>();
builder.Services.AddScoped<ISessionService, SessionService>();
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
}).AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = false,
        ValidateAudience = false,
        ValidateIssuerSigningKey = true,
        // Read signing key from configuration at runtime to allow test overrides
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"] ?? "ReplaceWithStrongKey_UseEnvOrConfig_ChangeThisToASecureValue!"))
    };
});

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        // When AllowCredentials() is used you must explicitly list allowed origins.
        policy.WithOrigins("http://localhost:3000")
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
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
builder.Services.AddHangfireServer();
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

// Seed sample data only when SEED_ADMIN=true (to avoid accidental production seeding)
try
{
    var seedFlag = app.Configuration["SEED_ADMIN"] ?? Environment.GetEnvironmentVariable("SEED_ADMIN");
    if (!string.IsNullOrEmpty(seedFlag) && seedFlag.ToLower() == "true")
    {
        using (var scope = app.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
                if (!db.Users.Any(u => u.Username == "admin"))
                {
                    var primaryRole = new Clinics.Domain.Role { Name = "primary_admin", DisplayName = "المدير الأساسي" };
                    var moderatorRole = new Clinics.Domain.Role { Name = "moderator", DisplayName = "المشرف" };
                    var userRole = new Clinics.Domain.Role { Name = "user", DisplayName = "مستخدم" };
                    db.Roles.Add(primaryRole);
                    db.Roles.Add(moderatorRole);
                    db.Roles.Add(userRole);
                    db.SaveChanges();

                    // Seed admin user with hashed password (development convenience).
                    var adminUser = new Clinics.Domain.User { Username = "admin", FullName = "المدير الأساسي", RoleId = primaryRole.Id };
                    var hasher = new Microsoft.AspNetCore.Identity.PasswordHasher<Clinics.Domain.User>();
                    var seedPw = app.Configuration["SEED_ADMIN_PASSWORD"] ?? Environment.GetEnvironmentVariable("SEED_ADMIN_PASSWORD") ?? "Admin123!";
                    adminUser.PasswordHash = hasher.HashPassword(adminUser, seedPw);
                    db.Users.Add(adminUser);

                    db.Queues.Add(new Clinics.Domain.Queue { DoctorName = "د. أحمد محمد", Description = "عيادة الصباح", CreatedBy = adminUser.Id, CurrentPosition = 1, EstimatedWaitMinutes = 15 });
                    db.Queues.Add(new Clinics.Domain.Queue { DoctorName = "د. فاطمة علي", Description = "عيادة الأطفال", CreatedBy = adminUser.Id, CurrentPosition = 2, EstimatedWaitMinutes = 20 });
                    db.Patients.Add(new Clinics.Domain.Patient { QueueId = 1, FullName = "أحمد محمد", PhoneNumber = "+966500000001", Position = 1 });
                    db.Patients.Add(new Clinics.Domain.Patient { QueueId = 1, FullName = "فاطمة علي", PhoneNumber = "+966500000002", Position = 2 });
                    db.SaveChanges();
                }
        }
    }
}
catch { }

// schedule hangfire recurring job every 15 seconds (demo)
try
{
    RecurringJob.AddOrUpdate<IMessageProcessor>("process-queued-messages", proc => proc.ProcessQueuedMessagesAsync(50), "*/15 * * * * *");
}
catch { }

app.Run();

// Expose Program class for integration testing (WebApplicationFactory)
public partial class Program { }
