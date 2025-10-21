using System;
using System.Threading.Tasks;
using Clinics.Domain;

namespace Clinics.Application.Interfaces
{
    /// <summary>
    /// Unit of Work Pattern - Coordinates multiple repositories as a single transaction
    /// Follows Single Responsibility Principle (SRP)
    /// </summary>
    public interface IUnitOfWork : IDisposable
    {
        // Repository instances
        IRepository<User> Users { get; }
        IRepository<Queue> Queues { get; }
        IRepository<Patient> Patients { get; }
        IRepository<Message> Messages { get; }
        IRepository<MessageTemplate> MessageTemplates { get; }
        IRepository<FailedTask> FailedTasks { get; }
        IRepository<Session> Sessions { get; }
        IRepository<Quota> Quotas { get; }
        IRepository<WhatsAppSession> WhatsAppSessions { get; }
        IRepository<MessageSession> MessageSessions { get; }

        // Transaction management
        Task<int> SaveChangesAsync();
        Task BeginTransactionAsync();
        Task CommitAsync();
        Task RollbackAsync();
    }
}
