using System;
using System.Threading.Tasks;
using Clinics.Application.Interfaces;
using Clinics.Domain;
using Clinics.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Clinics.Infrastructure.Persistence
{
    /// <summary>
    /// Unit of Work Implementation - Coordinates all repositories as a single transaction
    /// Provides transaction management and ensures data consistency
    /// Implements Facade Pattern to simplify complex repository interactions
    /// </summary>
    public class UnitOfWork : IUnitOfWork
    {
        private readonly ApplicationDbContext _context;
        private IDbContextTransaction? _transaction;

        private IRepository<User>? _users;
        private IRepository<Queue>? _queues;
        private IRepository<Patient>? _patients;
        private IRepository<Message>? _messages;
        private IRepository<MessageTemplate>? _messageTemplates;
        private IRepository<FailedTask>? _failedTasks;
        private IRepository<Session>? _sessions;
        private IRepository<Quota>? _quotas;
        private IRepository<WhatsAppSession>? _whatsAppSessions;
        private IRepository<MessageSession>? _messageSessions;

        public UnitOfWork(ApplicationDbContext context)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
        }

        // Lazy-loaded repositories
        public IRepository<User> Users =>
            _users ??= new Repository<User>(_context);

        public IRepository<Queue> Queues =>
            _queues ??= new Repository<Queue>(_context);

        public IRepository<Patient> Patients =>
            _patients ??= new Repository<Patient>(_context);

        public IRepository<Message> Messages =>
            _messages ??= new Repository<Message>(_context);

        public IRepository<MessageTemplate> MessageTemplates =>
            _messageTemplates ??= new Repository<MessageTemplate>(_context);

        public IRepository<FailedTask> FailedTasks =>
            _failedTasks ??= new Repository<FailedTask>(_context);

        public IRepository<Session> Sessions =>
            _sessions ??= new Repository<Session>(_context);

        public IRepository<Quota> Quotas =>
            _quotas ??= new Repository<Quota>(_context);

        public IRepository<WhatsAppSession> WhatsAppSessions =>
            _whatsAppSessions ??= new Repository<WhatsAppSession>(_context);

        public IRepository<MessageSession> MessageSessions =>
            _messageSessions ??= new Repository<MessageSession>(_context);

        public async Task<int> SaveChangesAsync()
        {
            return await _context.SaveChangesAsync();
        }

        public async Task BeginTransactionAsync()
        {
            _transaction = await _context.Database.BeginTransactionAsync();
        }

        public async Task CommitAsync()
        {
            try
            {
                await _context.SaveChangesAsync();
                if (_transaction != null)
                {
                    await _transaction.CommitAsync();
                }
            }
            catch
            {
                await RollbackAsync();
                throw;
            }
            finally
            {
                if (_transaction != null)
                {
                    await _transaction.DisposeAsync();
                    _transaction = null;
                }
            }
        }

        public async Task RollbackAsync()
        {
            try
            {
                if (_transaction != null)
                {
                    await _transaction.RollbackAsync();
                }
            }
            finally
            {
                if (_transaction != null)
                {
                    await _transaction.DisposeAsync();
                    _transaction = null;
                }
            }
        }

        public void Dispose()
        {
            _transaction?.Dispose();
            _context?.Dispose();
        }
    }
}
