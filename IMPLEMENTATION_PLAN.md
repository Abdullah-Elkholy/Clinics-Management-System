# Clean Architecture Implementation Plan

## Overview
This document outlines the step-by-step refactoring plan to implement SOLID principles and Clean Architecture in the Clinics Management System.

---

## Phase 1: Foundation - Repository & Specification Patterns (Days 1-5)

### Step 1.1: Create Base Repository Interfaces (Day 1 - 2 hours)

**File**: `src/Infrastructure/Repositories/IRepository.cs`

```csharp
using System;
using System.Collections.Generic;
using System.Linq.Expressions;
using System.Threading.Tasks;

namespace Clinics.Infrastructure.Repositories
{
    /// <summary>
    /// Generic repository interface for all entities.
    /// Provides abstraction over data access layer.
    /// </summary>
    public interface IRepository<TEntity> where TEntity : class
    {
        // Read operations
        Task<TEntity?> GetByIdAsync(int id);
        Task<IEnumerable<TEntity>> GetAllAsync();
        Task<IEnumerable<TEntity>> FindAsync(Expression<Func<TEntity, bool>> predicate);
        Task<TEntity?> FirstOrDefaultAsync(Expression<Func<TEntity, bool>> predicate);
        Task<int> CountAsync(Expression<Func<TEntity, bool>> predicate);
        Task<bool> AnyAsync(Expression<Func<TEntity, bool>> predicate);

        // Write operations
        Task AddAsync(TEntity entity);
        Task AddRangeAsync(IEnumerable<TEntity> entities);
        void Update(TEntity entity);
        void Remove(TEntity entity);
        void RemoveRange(IEnumerable<TEntity> entities);

        // Related data loading
        IRepository<TEntity> Include(Expression<Func<TEntity, object>> navigationProperty);
        IRepository<TEntity> ThenInclude(Expression<Func<object, object>> navigationProperty);
    }
}
```

### Step 1.2: Create Generic Repository Implementation (Day 1 - 3 hours)

**File**: `src/Infrastructure/Repositories/Repository.cs`

```csharp
using Microsoft.EntityFrameworkCore;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Linq.Expressions;
using System.Threading.Tasks;

namespace Clinics.Infrastructure.Repositories
{
    public class Repository<TEntity> : IRepository<TEntity> where TEntity : class
    {
        protected readonly ApplicationDbContext _context;
        protected DbSet<TEntity> _dbSet;

        public Repository(ApplicationDbContext context)
        {
            _context = context;
            _dbSet = context.Set<TEntity>();
        }

        public virtual async Task<TEntity?> GetByIdAsync(int id)
            => await _dbSet.FindAsync(id);

        public virtual async Task<IEnumerable<TEntity>> GetAllAsync()
            => await _dbSet.ToListAsync();

        public virtual async Task<IEnumerable<TEntity>> FindAsync(Expression<Func<TEntity, bool>> predicate)
            => await _dbSet.Where(predicate).ToListAsync();

        public virtual async Task<TEntity?> FirstOrDefaultAsync(Expression<Func<TEntity, bool>> predicate)
            => await _dbSet.FirstOrDefaultAsync(predicate);

        public virtual async Task<int> CountAsync(Expression<Func<TEntity, bool>> predicate)
            => await _dbSet.CountAsync(predicate);

        public virtual async Task<bool> AnyAsync(Expression<Func<TEntity, bool>> predicate)
            => await _dbSet.AnyAsync(predicate);

        public virtual async Task AddAsync(TEntity entity)
            => await _dbSet.AddAsync(entity);

        public virtual async Task AddRangeAsync(IEnumerable<TEntity> entities)
            => await _dbSet.AddRangeAsync(entities);

        public virtual void Update(TEntity entity)
            => _dbSet.Update(entity);

        public virtual void Remove(TEntity entity)
            => _dbSet.Remove(entity);

        public virtual void RemoveRange(IEnumerable<TEntity> entities)
            => _dbSet.RemoveRange(entities);

        public virtual IRepository<TEntity> Include(Expression<Func<TEntity, object>> navigationProperty)
        {
            _dbSet = (DbSet<TEntity>)_dbSet.Include(navigationProperty);
            return this;
        }

        public virtual IRepository<TEntity> ThenInclude(Expression<Func<object, object>> navigationProperty)
        {
            // Implementation depends on Include being called first
            return this;
        }
    }
}
```

### Step 1.3: Create Unit of Work Interface (Day 1 - 2 hours)

**File**: `src/Infrastructure/UnitOfWork/IUnitOfWork.cs`

```csharp
using Clinics.Domain;
using Clinics.Infrastructure.Repositories;
using System;
using System.Threading.Tasks;

namespace Clinics.Infrastructure.UnitOfWork
{
    /// <summary>
    /// Unit of Work pattern implementation.
    /// Coordinates work with multiple repositories and manages transactions.
    /// </summary>
    public interface IUnitOfWork : IDisposable
    {
        // Repository properties
        IRepository<User> Users { get; }
        IRepository<Queue> Queues { get; }
        IRepository<Patient> Patients { get; }
        IRepository<Message> Messages { get; }
        IRepository<MessageTemplate> MessageTemplates { get; }
        IRepository<FailedTask> FailedTasks { get; }
        IRepository<Quota> Quotas { get; }
        IRepository<Session> Sessions { get; }
        IRepository<WhatsAppSession> WhatsAppSessions { get; }
        IRepository<MessageSession> MessageSessions { get; }

        // Transaction management
        Task<int> SaveChangesAsync();
        Task BeginTransactionAsync();
        Task CommitAsync();
        Task RollbackAsync();
    }
}
```

### Step 1.4: Create Unit of Work Implementation (Day 2 - 3 hours)

**File**: `src/Infrastructure/UnitOfWork/UnitOfWork.cs`

```csharp
using Clinics.Domain;
using Clinics.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore.Storage;
using System;
using System.Threading.Tasks;

namespace Clinics.Infrastructure.UnitOfWork
{
    public class UnitOfWork : IUnitOfWork
    {
        private readonly ApplicationDbContext _context;
        private IDbContextTransaction? _transaction;

        // Lazy-loaded repositories
        private IRepository<User>? _usersRepository;
        private IRepository<Queue>? _queuesRepository;
        private IRepository<Patient>? _patientsRepository;
        private IRepository<Message>? _messagesRepository;
        private IRepository<MessageTemplate>? _messageTemplatesRepository;
        private IRepository<FailedTask>? _failedTasksRepository;
        private IRepository<Quota>? _quotasRepository;
        private IRepository<Session>? _sessionsRepository;
        private IRepository<WhatsAppSession>? _whatsAppSessionsRepository;
        private IRepository<MessageSession>? _messageSessionsRepository;

        public UnitOfWork(ApplicationDbContext context)
        {
            _context = context ?? throw new ArgumentNullException(nameof(context));
        }

        public IRepository<User> Users => _usersRepository ??= new Repository<User>(_context);
        public IRepository<Queue> Queues => _queuesRepository ??= new Repository<Queue>(_context);
        public IRepository<Patient> Patients => _patientsRepository ??= new Repository<Patient>(_context);
        public IRepository<Message> Messages => _messagesRepository ??= new Repository<Message>(_context);
        public IRepository<MessageTemplate> MessageTemplates => _messageTemplatesRepository ??= new Repository<MessageTemplate>(_context);
        public IRepository<FailedTask> FailedTasks => _failedTasksRepository ??= new Repository<FailedTask>(_context);
        public IRepository<Quota> Quotas => _quotasRepository ??= new Repository<Quota>(_context);
        public IRepository<Session> Sessions => _sessionsRepository ??= new Repository<Session>(_context);
        public IRepository<WhatsAppSession> WhatsAppSessions => _whatsAppSessionsRepository ??= new Repository<WhatsAppSession>(_context);
        public IRepository<MessageSession> MessageSessions => _messageSessionsRepository ??= new Repository<MessageSession>(_context);

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
                await SaveChangesAsync();
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
```

### Step 1.5: Update Program.cs with Dependency Injection (Day 2 - 2 hours)

**File**: `src/Api/Program.cs`

Add after service registration section:
```csharp
// Infrastructure - Repositories & Unit of Work
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();
```

### Step 1.6: Create Specification Pattern Base (Day 2 - 3 hours)

**File**: `src/Domain/Specifications/ISpecification.cs`

```csharp
using System;
using System.Collections.Generic;
using System.Linq.Expressions;

namespace Clinics.Domain.Specifications
{
    /// <summary>
    /// Specification pattern for encapsulating query logic.
    /// </summary>
    public interface ISpecification<TEntity> where TEntity : class
    {
        Expression<Func<TEntity, bool>>? Criteria { get; }
        List<Expression<Func<TEntity, object>>> Includes { get; }
        List<string> IncludeStrings { get; }
        Expression<Func<TEntity, object>>? OrderBy { get; }
        Expression<Func<TEntity, object>>? OrderByDescending { get; }
        int? Take { get; }
        int? Skip { get; }
        bool IsPagingEnabled { get; }
    }
}
```

**File**: `src/Domain/Specifications/BaseSpecification.cs`

```csharp
using System;
using System.Collections.Generic;
using System.Linq.Expressions;

namespace Clinics.Domain.Specifications
{
    public abstract class BaseSpecification<TEntity> : ISpecification<TEntity> where TEntity : class
    {
        public Expression<Func<TEntity, bool>>? Criteria { get; protected set; }
        public List<Expression<Func<TEntity, object>>> Includes { get; } = new();
        public List<string> IncludeStrings { get; } = new();
        public Expression<Func<TEntity, object>>? OrderBy { get; protected set; }
        public Expression<Func<TEntity, object>>? OrderByDescending { get; protected set; }
        public int? Take { get; protected set; }
        public int? Skip { get; protected set; }
        public bool IsPagingEnabled { get; protected set; }

        protected virtual void AddInclude(Expression<Func<TEntity, object>> includeExpression)
        {
            Includes.Add(includeExpression);
        }

        protected virtual void AddIncludeString(string includeString)
        {
            IncludeStrings.Add(includeString);
        }

        protected virtual void ApplyPaging(int skip, int take)
        {
            Skip = skip;
            Take = take;
            IsPagingEnabled = true;
        }

        protected virtual void ApplyOrderBy(Expression<Func<TEntity, object>> orderByExpression)
        {
            OrderBy = orderByExpression;
        }

        protected virtual void ApplyOrderByDescending(Expression<Func<TEntity, object>> orderByDescendingExpression)
        {
            OrderByDescending = orderByDescendingExpression;
        }
    }
}
```

### Step 1.7: Create Specification Evaluator (Day 2 - 2 hours)

**File**: `src/Infrastructure/Specifications/SpecificationEvaluator.cs`

```csharp
using Clinics.Domain.Specifications;
using Microsoft.EntityFrameworkCore;
using System.Linq;

namespace Clinics.Infrastructure.Specifications
{
    public class SpecificationEvaluator<TEntity> where TEntity : class
    {
        public static IQueryable<TEntity> GetQuery(IQueryable<TEntity> inputQuery, ISpecification<TEntity> spec)
        {
            var query = inputQuery;

            // Apply criteria
            if (spec.Criteria != null)
            {
                query = query.Where(spec.Criteria);
            }

            // Apply includes
            query = spec.Includes.Aggregate(query, (current, include) => current.Include(include));

            // Apply string-based includes
            query = spec.IncludeStrings.Aggregate(query, (current, include) => current.Include(include));

            // Apply ordering
            if (spec.OrderBy != null)
            {
                query = query.OrderBy(spec.OrderBy);
            }
            else if (spec.OrderByDescending != null)
            {
                query = query.OrderByDescending(spec.OrderByDescending);
            }

            // Apply paging
            if (spec.IsPagingEnabled)
            {
                if (spec.Skip.HasValue)
                {
                    query = query.Skip(spec.Skip.Value);
                }

                if (spec.Take.HasValue)
                {
                    query = query.Take(spec.Take.Value);
                }
            }

            return query;
        }
    }
}
```

### Step 1.8: Update Repository to Use Specifications (Day 3 - 2 hours)

Update `src/Infrastructure/Repositories/Repository.cs`:

```csharp
// Add this method to Repository class
public virtual async Task<IEnumerable<TEntity>> GetBySpecificationAsync(ISpecification<TEntity> spec)
{
    var query = SpecificationEvaluator<TEntity>.GetQuery(_dbSet.AsQueryable(), spec);
    return await query.ToListAsync();
}

public virtual async Task<TEntity?> GetBySpecificationFirstOrDefaultAsync(ISpecification<TEntity> spec)
{
    var query = SpecificationEvaluator<TEntity>.GetQuery(_dbSet.AsQueryable(), spec);
    return await query.FirstOrDefaultAsync();
}
```

**Example Specification Usage** (Day 3 - create in `src/Domain/Specifications/Queues/`):

```csharp
public class GetActiveQueuesSpecification : BaseSpecification<Queue>
{
    public GetActiveQueuesSpecification()
    {
        Criteria = q => q.IsActive == true;
        AddOrderBy(q => q.DoctorName);
        AddInclude(q => q.Patients);
    }
}

public class GetQueueWithPatientsSpecification : BaseSpecification<Queue>
{
    public GetQueueWithPatientsSpecification(int queueId)
    {
        Criteria = q => q.Id == queueId;
        AddInclude(q => q.Patients);
    }
}
```

---

## Phase 2: Application Services & Use Cases (Days 6-10)

### Step 2.1: Create Application Service Interfaces (Day 6 - 2 hours)

**File**: `src/Application/Services/IQueueService.cs`

```csharp
using Clinics.Application.DTOs;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Clinics.Application.Services
{
    public interface IQueueService
    {
        Task<Result<QueueDto>> CreateQueueAsync(CreateQueueRequest request, int userId);
        Task<Result<QueueDto>> GetQueueAsync(int id);
        Task<Result<IEnumerable<QueueDto>>> GetAllQueuesAsync();
        Task<Result<bool>> DeleteQueueAsync(int id, int userId);
        Task<Result<QueueDto>> UpdateQueueAsync(int id, UpdateQueueRequest request, int userId);
    }
}
```

### Step 2.2: Create Result Pattern (Day 6 - 3 hours)

**File**: `src/Application/Common/Result.cs`

```csharp
using System;
using System.Collections.Generic;

namespace Clinics.Application
{
    public class Result
    {
        public bool Succeeded { get; set; }
        public List<string> Errors { get; set; } = new();
        public string Message { get; set; } = string.Empty;

        public static Result Success(string message = "Operation successful")
            => new() { Succeeded = true, Message = message };

        public static Result Failure(params string[] errors)
            => new() { Succeeded = false, Errors = new List<string>(errors) };

        public static Result Failure(List<string> errors)
            => new() { Succeeded = false, Errors = errors };
    }

    public class Result<T> : Result
    {
        public T? Data { get; set; }

        public static Result<T> Success(T data, string message = "Operation successful")
            => new() { Succeeded = true, Data = data, Message = message };

        public new static Result<T> Failure(params string[] errors)
            => new() { Succeeded = false, Errors = new List<string>(errors) };

        public new static Result<T> Failure(List<string> errors)
            => new() { Succeeded = false, Errors = errors };
    }
}
```

### Step 2.3: Create Validation Layer (Day 7 - 3 hours)

**File**: `src/Application/Validators/CreateQueueRequestValidator.cs`

```csharp
using Clinics.Application.DTOs;
using FluentValidation;

namespace Clinics.Application.Validators
{
    public class CreateQueueRequestValidator : AbstractValidator<CreateQueueRequest>
    {
        public CreateQueueRequestValidator()
        {
            RuleFor(x => x.DoctorName)
                .NotEmpty().WithMessage("Doctor name is required")
                .Length(3, 100).WithMessage("Doctor name must be between 3 and 100 characters");

            RuleFor(x => x.Description)
                .NotEmpty().WithMessage("Description is required")
                .Length(5, 500).WithMessage("Description must be between 5 and 500 characters");

            RuleFor(x => x.EstimatedWaitMinutes)
                .GreaterThan(0).WithMessage("Estimated wait time must be greater than 0");
        }
    }
}
```

### Step 2.4: Implement Application Service (Day 7 - 4 hours)

**File**: `src/Application/Services/QueueService.cs`

```csharp
using Clinics.Application.DTOs;
using Clinics.Domain;
using Clinics.Infrastructure.UnitOfWork;
using FluentValidation;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

namespace Clinics.Application.Services
{
    public class QueueService : IQueueService
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IValidator<CreateQueueRequest> _createValidator;
        private readonly IValidator<UpdateQueueRequest> _updateValidator;
        private readonly ILogger<QueueService> _logger;

        public QueueService(
            IUnitOfWork unitOfWork,
            IValidator<CreateQueueRequest> createValidator,
            IValidator<UpdateQueueRequest> updateValidator,
            ILogger<QueueService> logger)
        {
            _unitOfWork = unitOfWork ?? throw new ArgumentNullException(nameof(unitOfWork));
            _createValidator = createValidator ?? throw new ArgumentNullException(nameof(createValidator));
            _updateValidator = updateValidator ?? throw new ArgumentNullException(nameof(updateValidator));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        public async Task<Result<QueueDto>> CreateQueueAsync(CreateQueueRequest request, int userId)
        {
            try
            {
                // Validate input
                var validationResult = await _createValidator.ValidateAsync(request);
                if (!validationResult.IsValid)
                {
                    return Result<QueueDto>.Failure(validationResult.Errors.Select(e => e.ErrorMessage).ToList());
                }

                // Check quota
                var user = await _unitOfWork.Users.GetByIdAsync(userId);
                if (user == null)
                    return Result<QueueDto>.Failure("User not found");

                // Create entity
                var queue = new Queue
                {
                    DoctorName = request.DoctorName,
                    Description = request.Description,
                    CreatedBy = userId,
                    CurrentPosition = 1,
                    EstimatedWaitMinutes = request.EstimatedWaitMinutes
                };

                await _unitOfWork.Queues.AddAsync(queue);
                await _unitOfWork.SaveChangesAsync();

                _logger.LogInformation($"Queue created with ID {queue.Id} by user {userId}");

                return Result<QueueDto>.Success(MapToDto(queue), "Queue created successfully");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error creating queue");
                return Result<QueueDto>.Failure("An error occurred while creating the queue");
            }
        }

        public async Task<Result<QueueDto>> GetQueueAsync(int id)
        {
            var queue = await _unitOfWork.Queues.GetByIdAsync(id);
            if (queue == null)
                return Result<QueueDto>.Failure("Queue not found");

            return Result<QueueDto>.Success(MapToDto(queue));
        }

        public async Task<Result<IEnumerable<QueueDto>>> GetAllQueuesAsync()
        {
            var queues = await _unitOfWork.Queues.GetAllAsync();
            return Result<IEnumerable<QueueDto>>.Success(queues.Select(MapToDto));
        }

        public async Task<Result<bool>> DeleteQueueAsync(int id, int userId)
        {
            var queue = await _unitOfWork.Queues.GetByIdAsync(id);
            if (queue == null)
                return Result<bool>.Failure("Queue not found");

            _unitOfWork.Queues.Remove(queue);
            await _unitOfWork.SaveChangesAsync();

            _logger.LogInformation($"Queue {id} deleted by user {userId}");
            return Result<bool>.Success(true, "Queue deleted successfully");
        }

        public async Task<Result<QueueDto>> UpdateQueueAsync(int id, UpdateQueueRequest request, int userId)
        {
            var validationResult = await _updateValidator.ValidateAsync(request);
            if (!validationResult.IsValid)
            {
                return Result<QueueDto>.Failure(validationResult.Errors.Select(e => e.ErrorMessage).ToList());
            }

            var queue = await _unitOfWork.Queues.GetByIdAsync(id);
            if (queue == null)
                return Result<QueueDto>.Failure("Queue not found");

            queue.DoctorName = request.DoctorName ?? queue.DoctorName;
            queue.Description = request.Description ?? queue.Description;
            queue.EstimatedWaitMinutes = request.EstimatedWaitMinutes ?? queue.EstimatedWaitMinutes;

            _unitOfWork.Queues.Update(queue);
            await _unitOfWork.SaveChangesAsync();

            return Result<QueueDto>.Success(MapToDto(queue), "Queue updated successfully");
        }

        private QueueDto MapToDto(Queue queue)
        {
            return new QueueDto
            {
                Id = queue.Id,
                DoctorName = queue.DoctorName,
                Description = queue.Description,
                CreatedBy = queue.CreatedBy,
                CurrentPosition = queue.CurrentPosition,
                EstimatedWaitMinutes = queue.EstimatedWaitMinutes,
                PatientCount = 0 // Will be loaded separately or use AutoMapper
            };
        }
    }
}
```

### Step 2.5: Register Services in Program.cs (Day 8 - 2 hours)

Update `src/Api/Program.cs`:

```csharp
// Application Services
builder.Services.AddScoped<IQueueService, QueueService>();
builder.Services.AddScoped<IMessageService, MessageService>();
builder.Services.AddScoped<IPatientService, PatientService>();
// ... other services

// Validation
builder.Services.AddValidatorsFromAssembly(typeof(CreateQueueRequestValidator).Assembly);

// AutoMapper
builder.Services.AddAutoMapper(AppDomain.CurrentDomain.GetAssemblies());
```

---

## Phase 3: Refactor Controllers (Days 9-15)

### Step 3.1: Refactor QueueController (Day 9 - 3 hours)

**File**: `src/Api/Controllers/QueuesController.cs`

```csharp
using Microsoft.AspNetCore.Mvc;
using Clinics.Application.Services;
using Clinics.Application.DTOs;
using Microsoft.AspNetCore.Authorization;
using System.Security.Claims;

namespace Clinics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class QueuesController : ControllerBase
    {
        private readonly IQueueService _queueService;
        private readonly ILogger<QueuesController> _logger;

        public QueuesController(
            IQueueService queueService,
            ILogger<QueuesController> logger)
        {
            _queueService = queueService ?? throw new ArgumentNullException(nameof(queueService));
            _logger = logger ?? throw new ArgumentNullException(nameof(logger));
        }

        [HttpGet]
        public async Task<ActionResult<ApiResponse<IEnumerable<QueueDto>>>> GetAll()
        {
            var result = await _queueService.GetAllQueuesAsync();
            return HandleResult(result);
        }

        [HttpGet("{id}")]
        public async Task<ActionResult<ApiResponse<QueueDto>>> Get(int id)
        {
            var result = await _queueService.GetQueueAsync(id);
            return HandleResult(result);
        }

        [HttpPost]
        [Authorize(Roles = "primary_admin,secondary_admin,moderator,user")]
        public async Task<ActionResult<ApiResponse<QueueDto>>> Create([FromBody] CreateQueueRequest request)
        {
            var userId = GetUserId();
            var result = await _queueService.CreateQueueAsync(request, userId);
            return HandleResult(result);
        }

        [HttpPut("{id}")]
        [Authorize(Roles = "primary_admin,secondary_admin,moderator")]
        public async Task<ActionResult<ApiResponse<QueueDto>>> Update(int id, [FromBody] UpdateQueueRequest request)
        {
            var userId = GetUserId();
            var result = await _queueService.UpdateQueueAsync(id, request, userId);
            return HandleResult(result);
        }

        [HttpDelete("{id}")]
        [Authorize(Roles = "primary_admin,secondary_admin")]
        public async Task<ActionResult<ApiResponse<bool>>> Delete(int id)
        {
            var userId = GetUserId();
            var result = await _queueService.DeleteQueueAsync(id, userId);
            return HandleResult(result);
        }

        private ActionResult<ApiResponse<T>> HandleResult<T>(Result<T> result)
        {
            if (result.Succeeded)
            {
                return Ok(new ApiResponse<T>
                {
                    Success = true,
                    Data = result.Data,
                    Message = result.Message
                });
            }

            _logger.LogWarning($"Operation failed: {string.Join(", ", result.Errors)}");
            return BadRequest(new ApiResponse<T>
            {
                Success = false,
                Errors = result.Errors,
                Message = "Operation failed"
            });
        }

        private int GetUserId()
        {
            var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
            return int.Parse(userIdClaim?.Value ?? "0");
        }
    }
}
```

---

## DTOs & Mapping Setup (Day 8 - 3 hours)

### Create DTOs

**File**: `src/Application/DTOs/QueueDtos.cs`

```csharp
namespace Clinics.Application.DTOs
{
    public class QueueDto
    {
        public int Id { get; set; }
        public string DoctorName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public int CreatedBy { get; set; }
        public int CurrentPosition { get; set; }
        public int EstimatedWaitMinutes { get; set; }
        public int PatientCount { get; set; }
    }

    public class CreateQueueRequest
    {
        public string DoctorName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public int EstimatedWaitMinutes { get; set; }
    }

    public class UpdateQueueRequest
    {
        public string? DoctorName { get; set; }
        public string? Description { get; set; }
        public int? EstimatedWaitMinutes { get; set; }
    }
}
```

### Create AutoMapper Profile

**File**: `src/Application/Mappings/MappingProfile.cs`

```csharp
using AutoMapper;
using Clinics.Application.DTOs;
using Clinics.Domain;

namespace Clinics.Application.Mappings
{
    public class MappingProfile : Profile
    {
        public MappingProfile()
        {
            // Queue mappings
            CreateMap<Queue, QueueDto>();
            CreateMap<CreateQueueRequest, Queue>();
            CreateMap<UpdateQueueRequest, Queue>().ReverseMap();

            // Add other entity mappings here
        }
    }
}
```

---

## Testing Strategy (Days 16-20)

### Create Unit Tests for Services

**File**: `tests/UnitTests/Application/Services/QueueServiceTests.cs`

```csharp
using Xunit;
using Moq;
using Clinics.Application.Services;
using Clinics.Infrastructure.UnitOfWork;
using Clinics.Domain;

namespace Clinics.Tests.Application.Services
{
    public class QueueServiceTests
    {
        private readonly Mock<IUnitOfWork> _mockUnitOfWork;
        private readonly Mock<ILogger<QueueService>> _mockLogger;
        private readonly QueueService _service;

        public QueueServiceTests()
        {
            _mockUnitOfWork = new Mock<IUnitOfWork>();
            _mockLogger = new Mock<ILogger<QueueService>>();
            _service = new QueueService(_mockUnitOfWork.Object, _mockLogger.Object);
        }

        [Fact]
        public async Task CreateQueueAsync_WithValidRequest_ReturnsSuccess()
        {
            // Arrange
            var request = new CreateQueueRequest 
            { 
                DoctorName = "Dr. Ahmed", 
                Description = "Test Queue",
                EstimatedWaitMinutes = 15
            };

            // Act
            var result = await _service.CreateQueueAsync(request, 1);

            // Assert
            Assert.True(result.Succeeded);
            Assert.NotNull(result.Data);
        }

        [Fact]
        public async Task GetQueueAsync_WithInvalidId_ReturnsFailure()
        {
            // Arrange
            _mockUnitOfWork.Setup(x => x.Queues.GetByIdAsync(999))
                .ReturnsAsync((Queue?)null);

            // Act
            var result = await _service.GetQueueAsync(999);

            // Assert
            Assert.False(result.Succeeded);
        }
    }
}
```

---

## Integration Tests

**File**: `tests/IntegrationTests/Controllers/QueuesControllerTests.cs`

```csharp
using Xunit;
using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Clinics.Tests.Integration.Controllers
{
    public class QueuesControllerTests
    {
        private readonly WebApplicationFactory<Program> _factory;

        public QueuesControllerTests()
        {
            _factory = new WebApplicationFactory<Program>();
        }

        [Fact]
        public async Task GetQueues_ReturnsOkStatus()
        {
            // Arrange
            var client = _factory.CreateClient();
            var token = GenerateTestToken();
            client.DefaultRequestHeaders.Authorization = new("Bearer", token);

            // Act
            var response = await client.GetAsync("/api/queues");

            // Assert
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
    }
}
```

---

## Timeline Summary

| Phase | Duration | Tasks | Files Created |
|-------|----------|-------|---------------|
| Phase 1 | Days 1-5 | Repository, UnitOfWork, Specifications | 6 files |
| Phase 2 | Days 6-10 | Services, DTOs, Validation, Mapping | 8 files |
| Phase 3 | Days 9-15 | Controller Refactoring | 12 refactored files |
| Phase 4 | Days 16-20 | Testing, Documentation | Test files |

**Total: 20 days of dedicated refactoring work**

---

## Monitoring & Validation

After each phase:
1. ✅ Verify test pass rate (target: maintain 88.2%+)
2. ✅ Run integration tests
3. ✅ Check code coverage
4. ✅ Review commit history
5. ✅ Validate backward compatibility

---

## Rollback Strategy

Each phase is independent. If issues arise:
- Git branches per phase
- Tag working states before each phase
- Can rollback to previous stable state

---

## Resources & Learning

- Clean Architecture in ASP.NET Core: https://docs.microsoft.com/en-us/dotnet/architecture/modern-web-apps-azure/common-web-application-architectures
- Repository Pattern: https://docs.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/infrastructure-persistence-layer-design
- SOLID Principles: https://en.wikipedia.org/wiki/SOLID
