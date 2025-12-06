using ClinicsManagementService.Services;
using ClinicsManagementService.Services.Application;
using ClinicsManagementService.Services.Infrastructure;
using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.Services.Domain;
using Microsoft.EntityFrameworkCore;
using Clinics.Infrastructure;
using System.Text.Json.Serialization;
using Serilog;

var builder = WebApplication.CreateBuilder(args);
// Configure Serilog to log to the same global folder as the main API
// This ensures all logs are in one place for easier monitoring.
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .CreateLogger();

builder.Host.UseSerilog();

// Add services to the container.

builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        // Serialize enums as strings instead of numbers
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
    });

// Add Database Context
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("Default")));

// Register SOLID-based services and dependencies
builder.Services.AddSingleton<INotifier, ConsoleNotifier>();

// Infrastructure Services - Session Sync
builder.Services.AddScoped<IWhatsAppSessionSyncService, WhatsAppSessionSyncService>();

// Domain Services
builder.Services.AddScoped<INetworkService, NetworkService>();
builder.Services.AddScoped<IScreenshotService, ScreenshotService>();
builder.Services.AddScoped<IBrowserExceptionService, BrowserExceptionService>();
builder.Services.AddScoped<IWhatsAppUIService, WhatsAppUIService>();
builder.Services.AddScoped<IValidationService, ValidationService>();

// Infrastructure Services
// Register factory that creates PlaywrightBrowserSession with moderatorId parameter
builder.Services.AddScoped<Func<int, IBrowserSession>>(sp => 
{
    return (moderatorId) => new PlaywrightBrowserSession(moderatorId);
});
builder.Services.AddScoped<IWhatsAppSessionManager, WhatsAppSessionManager>();
builder.Services.AddScoped<IWhatsAppSessionOptimizer, WhatsAppSessionOptimizer>();

// Application Services
builder.Services.AddScoped<IWhatsAppService, WhatsAppService>();
builder.Services.AddScoped<IMessageSender, WhatsAppMessageSender>();

// HTTP client for SignalR notifications
builder.Services.AddHttpClient();
builder.Services.AddScoped<ISignalRNotificationService, SignalRNotificationService>();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Add CORS support to allow requests from the frontend
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// Enable CORS (must be before UseAuthorization)
app.UseCors();

app.UseAuthorization();

app.MapControllers();

// Graceful shutdown handling
var lifetime = app.Services.GetRequiredService<IHostApplicationLifetime>();
lifetime.ApplicationStopping.Register(() => 
{
    // Get all active scopes and cleanup
    using var scope = app.Services.CreateScope();
    var whatsAppService = scope.ServiceProvider.GetRequiredService<IWhatsAppService>();
    var sessionManager = scope.ServiceProvider.GetRequiredService<IWhatsAppSessionManager>();
    
    try 
    {
        // Dispose WhatsAppService which will cleanup browser sessions
        (whatsAppService as IDisposable)?.Dispose();
        // Dispose all active moderator sessions (handles multiple moderators)
        sessionManager.DisposeAllSessionsAsync().GetAwaiter().GetResult();
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"Error during shutdown: {ex.Message}");
    }
});

app.Run();
