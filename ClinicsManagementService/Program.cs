var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Register SOLID-based WhatsAppService and dependencies
builder.Services.AddSingleton<INotifier, ConsoleNotifier>();
builder.Services.AddTransient<IBrowserSession>(sp => new PlaywrightBrowserSession("whatsapp-session"));
// this line tells DI how to create a Func<IBrowserSession> that resolves a new IBrowserSession each time it’s called.
builder.Services.AddTransient<Func<IBrowserSession>>(sp => () => sp.GetRequiredService<IBrowserSession>());
builder.Services.AddTransient<IMessageSender, WhatsAppService>();
// builder.Services.AddTransient<WhatsAppService>();
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
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
