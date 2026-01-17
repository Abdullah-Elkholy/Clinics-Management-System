using System;
using System.Threading.Tasks;
using Clinics.Domain;

namespace Clinics.Application.Interfaces
{
    /// <summary>
    /// Unit of Work pattern interface for transaction management
    /// Provides access to repositories and transaction control
    /// </summary>
    public interface IUnitOfWork : IDisposable
    {
        IRepository<Message> Messages { get; }
        IRepository<MessageSession> MessageSessions { get; }
        IRepository<WhatsAppSession> WhatsAppSessions { get; }

        Task BeginTransactionAsync();
        Task CommitAsync();
        Task RollbackAsync();
        Task<int> SaveChangesAsync();
    }
}
