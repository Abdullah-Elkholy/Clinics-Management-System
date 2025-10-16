using Microsoft.Extensions.Hosting;

// Minimal generic host entry for Workers project
var host = Host.CreateDefaultBuilder(args)
    .ConfigureServices((context, services) =>
    {
        // Worker-specific services can be registered here if needed.
    })
    .Build();

await host.RunAsync();
