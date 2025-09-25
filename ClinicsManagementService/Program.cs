using ClinicsManagementService.Services;
using ClinicsManagementService.Services.Application;
using ClinicsManagementService.Services.Infrastructure;
using ClinicsManagementService.Services.Interfaces;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Register SOLID-based WhatsAppService and dependencies
builder.Services.AddSingleton<INotifier, ConsoleNotifier>();
builder.Services.AddScoped<IBrowserSession, PlaywrightBrowserSession>();
// here we tell DI how to create a Func<IBrowserSession> that resolves a new IBrowserSession each time it’s called.
builder.Services.AddScoped<Func<IBrowserSession>>(sp => () => sp.GetRequiredService<IBrowserSession>()); 
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

app.Run();
