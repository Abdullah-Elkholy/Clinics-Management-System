using ClinicsManagementService.Services;
using ClinicsManagementService.Services.Application;
using ClinicsManagementService.Services.Infrastructure;
using ClinicsManagementService.Services.Interfaces;
using ClinicsManagementService.Services.Domain;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Register SOLID-based services and dependencies
builder.Services.AddSingleton<INotifier, ConsoleNotifier>();

// Domain Services
builder.Services.AddScoped<INetworkService, NetworkService>();
builder.Services.AddScoped<IScreenshotService, ScreenshotService>();
builder.Services.AddScoped<IRetryService, RetryService>();
builder.Services.AddScoped<IWhatsAppUIService, WhatsAppUIService>();
builder.Services.AddScoped<IValidationService, ValidationService>();

// Infrastructure Services
builder.Services.AddScoped<IBrowserSession, PlaywrightBrowserSession>();
// here we tell DI how to create a Func<IBrowserSession> that resolves a new IBrowserSession each time it's called.
builder.Services.AddScoped<Func<IBrowserSession>>(sp => () => sp.GetRequiredService<IBrowserSession>()); 
builder.Services.AddScoped<IWhatsAppSessionManager, WhatsAppSessionManager>();

// Application Services
builder.Services.AddScoped<IWhatsAppService, WhatsAppService>();
builder.Services.AddScoped<IMessageSender, WhatsAppMessageSender>();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

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
        // Explicitly dispose session manager
        sessionManager.DisposeSessionAsync().GetAwaiter().GetResult();
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"Error during shutdown: {ex.Message}");
    }
});

app.Run();
