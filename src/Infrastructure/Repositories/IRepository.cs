using System;
using System.Collections.Generic;
using System.Linq.Expressions;
using System.Threading.Tasks;
using Clinics.Domain;

namespace Clinics.Infrastructure.Repositories
{
    /// <summary>
    /// Generic repository interface for CRUD operations with soft-delete support.
    /// </summary>
    /// <typeparam name="T">The entity type to manage</typeparam>
    public interface IRepository<T> where T : class
    {
        /// <summary>
        /// Returns a queryable for the entity, with soft-deleted entities excluded by default.
        /// Use Query(includeDeleted: true) to include soft-deleted entities.
        /// </summary>
        /// <param name="includeDeleted">Whether to include soft-deleted entities</param>
        /// <returns>IQueryable for manual filtering</returns>
        IQueryable<T> Query(bool includeDeleted = false);

        /// <summary>
        /// Get entity by primary key, excluding soft-deleted by default.
        /// </summary>
        Task<T?> GetAsync(int id, bool includeDeleted = false);

        /// <summary>
        /// Get all entities, excluding soft-deleted by default.
        /// </summary>
        Task<List<T>> GetAllAsync(bool includeDeleted = false);

        /// <summary>
        /// Get entities matching a predicate, excluding soft-deleted by default.
        /// </summary>
        Task<List<T>> GetByPredicateAsync(Expression<Func<T, bool>> predicate, bool includeDeleted = false);

        /// <summary>
        /// Add a new entity to the repository.
        /// </summary>
        Task<T> AddAsync(T entity);

        /// <summary>
        /// Update an existing entity.
        /// </summary>
        Task<T> UpdateAsync(T entity);

        /// <summary>
        /// Soft-delete an entity (marks IsDeleted = true, sets DeletedAt, DeletedBy).
        /// Does not remove from database; use PurgeAsync for permanent deletion.
        /// </summary>
        Task<T> SoftDeleteAsync(T entity, int? deletedBy = null);

        /// <summary>
        /// Restore a soft-deleted entity (marks IsDeleted = false, clears DeletedAt/DeletedBy, sets RestoredAt/RestoredBy/UpdatedAt/UpdatedBy).
        /// </summary>
        Task<T> RestoreAsync(T entity, int? restoredBy = null, DateTime? restoredAt = null);

        /// <summary>
        /// Permanently delete soft-deleted entities older than the specified days.
        /// DEPRECATED: No purge allowed by policy. This is a no-op and always returns 0.
        /// Soft-deleted records are kept indefinitely for traceability.
        /// </summary>
        [Obsolete("Purging is disabled by policy. Soft-deleted records are kept indefinitely for traceability.", false)]
        Task<int> PurgeAsync(int olderThanDays);

        /// <summary>
        /// Delete an entity completely (hard delete) - used only for non-audited entities.
        /// </summary>
        Task<bool> DeleteAsync(T entity);

        /// <summary>
        /// Save all pending changes to the database.
        /// </summary>
        Task<int> SaveChangesAsync();

        /// <summary>
        /// Check if an entity is soft-deletable (implements ISoftDeletable).
        /// </summary>
        bool IsSoftDeletable { get; }
    }

    /// <summary>
    /// Helper interface for querying soft-deleted entities with TTL (Time-To-Live) semantics.
    /// Soft-deleted records remain indefinitely but are only restorable/visible in Trash for 30 days.
    /// </summary>
    public interface ISoftDeleteTTLQueries<T> where T : class, ISoftDeletable
    {
        /// <summary>
        /// Get entities that are NOT soft-deleted (active records).
        /// </summary>
        /// <returns>IQueryable for active entities</returns>
        IQueryable<T> QueryActive();

        /// <summary>
        /// Get soft-deleted entities within the trash window (TTL days from DeletedAt).
        /// </summary>
        /// <param name="ttlDays">Number of days to keep in trash; defaults to 30</param>
        /// <returns>IQueryable for trash entities within TTL</returns>
        IQueryable<T> QueryTrash(int ttlDays = 30);

        /// <summary>
        /// Get soft-deleted entities older than the trash window (archived records).
        /// These are read-only and non-restorable.
        /// </summary>
        /// <param name="ttlDays">Number of days before a record is considered archived; defaults to 30</param>
        /// <returns>IQueryable for archived entities</returns>
        IQueryable<T> QueryArchived(int ttlDays = 30);

        /// <summary>
        /// Check if a soft-deleted entity is still within the restore window.
        /// </summary>
        /// <param name="entity">The soft-deleted entity</param>
        /// <param name="ttlDays">Number of days allowed for restore; defaults to 30</param>
        /// <returns>True if restore is allowed; false if TTL has expired</returns>
        bool IsRestoreAllowed(T entity, int ttlDays = 30);

        /// <summary>
        /// Get the number of days remaining until a soft-deleted entity expires from trash.
        /// Returns 0 if already expired.
        /// </summary>
        /// <param name="entity">The soft-deleted entity</param>
        /// <param name="ttlDays">TTL in days; defaults to 30</param>
        /// <returns>Days remaining (0 to ttlDays)</returns>
        int GetDaysRemainingInTrash(T entity, int ttlDays = 30);
    }

    /// <summary>
    /// Generic Unit of Work pattern for managing transactions across multiple repositories.
    /// Provides automatic repository creation and transactional support.
    /// Note: This is distinct from the entity-specific IUnitOfWork in Application.Interfaces.
    /// </summary>
    public interface IGenericUnitOfWork : IDisposable
    {
        /// <summary>
        /// Get or create a repository for the specified entity type.
        /// </summary>
        IRepository<T> Repository<T>() where T : class;

        /// <summary>
        /// Get or create a TTL-aware query helper for the specified soft-deletable entity type.
        /// </summary>
        ISoftDeleteTTLQueries<T> TTLQueries<T>() where T : class, ISoftDeletable;

        /// <summary>
        /// Begin a transaction to ensure atomic operations.
        /// </summary>
        Task BeginTransactionAsync();

        /// <summary>
        /// Commit the current transaction.
        /// </summary>
        Task CommitAsync();

        /// <summary>
        /// Rollback the current transaction.
        /// </summary>
        Task RollbackAsync();

        /// <summary>
        /// Save all pending changes across all repositories.
        /// </summary>
        Task<int> SaveChangesAsync();

        /// <summary>
        /// Execute a function within a transaction context.
        /// If the function succeeds, changes are committed; if it throws, changes are rolled back.
        /// </summary>
        Task<TResult> ExecuteInTransactionAsync<TResult>(Func<Task<TResult>> func);
    }
}
