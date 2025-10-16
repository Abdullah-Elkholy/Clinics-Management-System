using Clinics.Domain;
using System.Threading.Tasks;

namespace Clinics.Api.Services
{
    public interface IMessageSender
    {
        Task<(bool success, string? providerId, string? providerResponse)> SendAsync(Message msg);
    }

    public class SimulatedMessageSender : IMessageSender
    {
        public Task<(bool success, string? providerId, string? providerResponse)> SendAsync(Message msg)
        {
            // Simulate success/failure randomly for demo
            var rnd = System.Random.Shared.NextDouble();
            if (rnd < 0.85) // 85% success
            {
                return Task.FromResult<(bool, string?, string?)>((true, System.Guid.NewGuid().ToString(), "ok"));
            }
            else
            {
                return Task.FromResult<(bool, string?, string?)>((false, null, "simulated provider error"));
            }
        }
    }
}
