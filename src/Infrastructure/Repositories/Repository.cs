using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading.Tasks;
using Clinics.Domain;
using Microsoft.EntityFrameworkCore;

namespace Clinics.Infrastructure.Repositories
{
    /// <summary>
    /// Generic repository implementation with soft-delete support.
    /// Automatically excludes soft-deleted entities from queries unless explicitly included.
    /// Maintains backward compatibility with existing methods.
    /// Implements both the new soft-delete aware IRepository and legacy IRepository interfaces.
    /// </summary>
    public class Repository<T> : IRepository<T>, Clinics.Application.Interfaces.IRepository<T> where T : class
    {
        protected readonly ApplicationDbContext Context;
        protected readonly DbSet<T> DbSet;
        private readonly bool _isSoftDeletable;

        public bool IsSoftDeletable => _isSoftDeletable;

        public Repository(ApplicationDbContext context)
        {
            Context = context ?? throw new ArgumentNullException(nameof(context));
            DbSet = context.Set<T>();
            _isSoftDeletable = typeof(ISoftDeletable).IsAssignableFrom(typeof(T));
        }

        public virtual IQueryable<T> Query(bool includeDeleted = false)
        {
            var query = DbSet.AsQueryable();

            // Filter out soft-deleted entities by default
            if (_isSoftDeletable && !includeDeleted)
            {
                query = query.Where(e => !EF.Property<bool>(e, "IsDeleted"));
            }

            return query;
        }

        public virtual async Task<T?> GetAsync(int id, bool includeDeleted = false)
        {
            var query = Query(includeDeleted);
            return await query.FirstOrDefaultAsync(e => EF.Property<int>(e, "Id") == id);
        }

        public virtual async Task<List<T>> GetAllAsync(bool includeDeleted = false)
        {
            return await Query(includeDeleted).ToListAsync();
        }

        public virtual async Task<List<T>> GetByPredicateAsync(Expression<Func<T, bool>> predicate, bool includeDeleted = false)
        {
            return await Query(includeDeleted).Where(predicate).ToListAsync();
        }

        public virtual async Task<T> AddAsync(T entity)
        {
            if (entity == null) throw new ArgumentNullException(nameof(entity));
            await DbSet.AddAsync(entity);
            return entity;
        }

        public virtual async Task<T> UpdateAsync(T entity)
        {
            if (entity == null) throw new ArgumentNullException(nameof(entity));
            DbSet.Update(entity);

            // Set UpdatedAt if entity implements IAuditable
            if (entity is IAuditable auditable)
            {
                auditable.UpdatedAt = DateTime.UtcNow;
            }

            return entity;
        }

        public virtual async Task<T> SoftDeleteAsync(T entity, int? deletedBy = null)
        {
            if (!_isSoftDeletable)
                throw new InvalidOperationException($"Entity type {typeof(T).Name} does not support soft delete.");

            if (entity is ISoftDeletable softDeleteable)
            {
                softDeleteable.IsDeleted = true;
                softDeleteable.DeletedAt = DateTime.UtcNow;
                softDeleteable.DeletedBy = deletedBy;
            }

            DbSet.Update(entity);
            return entity;
        }

        public virtual async Task<T> RestoreAsync(T entity, int? restoredBy = null, DateTime? restoredAt = null)
        {
            if (!_isSoftDeletable)
                throw new InvalidOperationException($"Entity type {typeof(T).Name} does not support restore.");

            // Capture operation snapshot timestamp for consistency
            var operationTimestamp = restoredAt ?? DateTime.UtcNow;

            if (entity is ISoftDeletable softDeleteable)
            {
                softDeleteable.IsDeleted = false;
                softDeleteable.DeletedAt = null;
                softDeleteable.DeletedBy = null;
                softDeleteable.RestoredAt = operationTimestamp;
                softDeleteable.RestoredBy = restoredBy;
            }

            // Set UpdatedBy and UpdatedAt if entity implements IAuditable
            if (entity is IAuditable auditable)
            {
                auditable.UpdatedAt = operationTimestamp;
                auditable.UpdatedBy = restoredBy;
            }

            DbSet.Update(entity);
            return entity;
        }

        public virtual async Task<int> PurgeAsync(int olderThanDays)
        {
            // Purging is disabled by policy. Soft-deleted records are kept indefinitely for traceability.
            // This method is a no-op to maintain backward compatibility.
            return 0;
        }

        public virtual async Task<bool> DeleteAsync(T entity)
        {
            if (entity == null) throw new ArgumentNullException(nameof(entity));
            DbSet.Remove(entity);
            return true;
        }

        public virtual async Task<int> SaveChangesAsync()
        {
            return await Context.SaveChangesAsync();
        }

        // Backward compatibility methods
        public async Task<T?> GetByIdAsync(int id)
        {
            return await GetAsync(id);
        }

        public async Task<IEnumerable<T>> GetAllAsync()
        {
            return await GetAllAsync(includeDeleted: false);
        }

        public async Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicate)
        {
            return await GetByPredicateAsync(predicate);
        }

        public async Task<T?> FirstOrDefaultAsync(Expression<Func<T, bool>> predicate)
        {
            return await Query().FirstOrDefaultAsync(predicate);
        }

        public async Task<bool> AnyAsync(Expression<Func<T, bool>> predicate)
        {
            return await Query().AnyAsync(predicate);
        }

        public async Task<int> CountAsync(Expression<Func<T, bool>>? predicate = null)
        {
            var query = Query();
            return predicate == null ? await query.CountAsync() : await query.CountAsync(predicate);
        }

        public async Task AddRangeAsync(IEnumerable<T> entities)
        {
            if (entities == null) throw new ArgumentNullException(nameof(entities));
            await DbSet.AddRangeAsync(entities);
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var entity = await GetByIdAsync(id);
            if (entity == null) return false;

            DbSet.Remove(entity);
            return true;
        }

        public async Task<int> DeleteAsync(Expression<Func<T, bool>> predicate)
        {
            var entities = await DbSet.Where(predicate).ToListAsync();
            if (entities.Count == 0) return 0;

            DbSet.RemoveRange(entities);
            return entities.Count;
        }

        public async Task DeleteRangeAsync(IEnumerable<T> entities)
        {
            if (entities == null) throw new ArgumentNullException(nameof(entities));
            DbSet.RemoveRange(entities);
            await Task.CompletedTask;
        }

        public async Task<(IEnumerable<T> Items, int Total)> GetPagedAsync(
            int pageNumber,
            int pageSize,
            Expression<Func<T, bool>>? predicate = null)
        {
            if (pageNumber < 1) pageNumber = 1;
            if (pageSize < 1) pageSize = 10;

            var query = predicate == null ? Query().AsQueryable() : Query().Where(predicate);
            var total = await query.CountAsync();
            var items = await query
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .ToListAsync();

            return (items, total);
        }
    }

    /// <summary>
    /// Generic Unit of Work implementation for managing transactions and multiple repositories.
    /// </summary>
    public class GenericUnitOfWork : IGenericUnitOfWork
    {
        private readonly ApplicationDbContext _context;
        private readonly Dictionary<Type, object> _repositories;

        public GenericUnitOfWork(ApplicationDbContext context)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
            _repositories = new Dictionary<Type, object>();
        }

        public IRepository<T> Repository<T>() where T : class
        {
            var type = typeof(T);
            if (!_repositories.ContainsKey(type))
            {
                _repositories[type] = new Repository<T>(_context);
            }

            return (IRepository<T>)_repositories[type];
        }

        public ISoftDeleteTTLQueries<T> TTLQueries<T>() where T : class, ISoftDeletable
        {
            return new SoftDeleteTTLQueries<T>(_context.Set<T>());
        }

        public async Task BeginTransactionAsync()
        {
            await _context.Database.BeginTransactionAsync();
        }

        public async Task CommitAsync()
        {
            try
            {
                await _context.SaveChangesAsync();
                await _context.Database.CommitTransactionAsync();
            }
            catch
            {
                await RollbackAsync();
                throw;
            }
        }

        public async Task RollbackAsync()
        {
            try
            {
                await _context.Database.RollbackTransactionAsync();
            }
            catch
            {
                // Transaction already rolled back or not active
            }
        }

        public async Task<int> SaveChangesAsync()
        {
            return await _context.SaveChangesAsync();
        }

        public async Task<TResult> ExecuteInTransactionAsync<TResult>(Func<Task<TResult>> func)
        {
            await BeginTransactionAsync();
            try
            {
                var result = await func();
                await CommitAsync();
                return result;
            }
            catch
            {
                await RollbackAsync();
                throw;
            }
        }

        public void Dispose()
        {
            _context?.Dispose();
        }
    }

    /// <summary>
    /// Concrete implementation of TTL (Time-To-Live) query helpers for soft-deleted entities.
    /// Provides simplified queries for active, trash, and archived records.
    /// </summary>
    public class SoftDeleteTTLQueries<T> : ISoftDeleteTTLQueries<T> where T : class, ISoftDeletable
    {
        private readonly DbSet<T> _dbSet;

        public SoftDeleteTTLQueries(DbSet<T> dbSet)
        {
            _dbSet = dbSet ?? throw new ArgumentNullException(nameof(dbSet));
        }

        /// <summary>
        /// Get entities that are NOT soft-deleted (active records).
        /// </summary>
        public IQueryable<T> QueryActive()
        {
            return _dbSet.Where(e => !e.IsDeleted);
        }

        /// <summary>
        /// Get soft-deleted entities within the trash window (TTL days from DeletedAt).
        /// </summary>
        public IQueryable<T> QueryTrash(int ttlDays = 30)
        {
            var cutoffDate = DateTime.UtcNow.AddDays(-ttlDays);
            return _dbSet.Where(e => e.IsDeleted && e.DeletedAt >= cutoffDate);
        }

        /// <summary>
        /// Get soft-deleted entities older than the trash window (archived records).
        /// These are read-only and non-restorable.
        /// </summary>
        public IQueryable<T> QueryArchived(int ttlDays = 30)
        {
            var cutoffDate = DateTime.UtcNow.AddDays(-ttlDays);
            return _dbSet.Where(e => e.IsDeleted && e.DeletedAt < cutoffDate);
        }

        /// <summary>
        /// Check if a soft-deleted entity is still within the restore window.
        /// </summary>
        public bool IsRestoreAllowed(T entity, int ttlDays = 30)
        {
            if (entity == null)
                return false;

            if (!entity.IsDeleted || !entity.DeletedAt.HasValue)
                return false;

            var cutoffDate = DateTime.UtcNow.AddDays(-ttlDays);
            return entity.DeletedAt >= cutoffDate;
        }

        /// <summary>
        /// Get the number of days remaining until a soft-deleted entity expires from trash.
        /// Returns 0 if already expired.
        /// </summary>
        public int GetDaysRemainingInTrash(T entity, int ttlDays = 30)
        {
            if (entity == null || !entity.IsDeleted || !entity.DeletedAt.HasValue)
                return 0;

            var expiryDate = entity.DeletedAt.Value.AddDays(ttlDays);
            var now = DateTime.UtcNow;

            if (now >= expiryDate)
                return 0;

            return (int)Math.Ceiling((expiryDate - now).TotalDays);
        }
    }
}

