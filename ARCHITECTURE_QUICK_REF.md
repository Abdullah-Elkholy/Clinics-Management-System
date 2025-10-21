# Quick Reference: Architecture & SOLID

## 📋 One-Page Reference

### Layer Responsibilities

```
LAYER               LOCATION              KNOWS ABOUT              CAN'T KNOW ABOUT
─────────────────────────────────────────────────────────────────────────────────
Presentation        src/Api/              Application, DTOs        Business Logic
Application         src/Application/      Domain, Validation       HTTP, Database
Domain              src/Domain/           Interfaces, Entities     Infrastructure
Infrastructure      src/Infrastructure/   Domain, DB               Controllers
```

---

### Dependency Direction (THE RULE)

```
Controllers → Services → Repositories → Database
    ↓            ↓             ↓
 (use)        (use)       (implement)
```

**Key**: Lower layers never import upper layers.

---

### SOLID Principles Quick Check

| Principle | Rule | Check |
|-----------|------|-------|
| **S**RP | One reason to change | Each class has ONE job ✅ |
| **O**CP | Open/Closed | Extend via interfaces, not modify ✅ |
| **L**SP | Substitutable | All implementations behave same ✅ |
| **I**SP | Fat-free interfaces | Use only methods you need ✅ |
| **D**IP | Invert dependencies | Depend on interfaces, not concretions ✅ |

---

### File Organization

```
src/
├── Domain/                    # ✅ Zero dependencies
│   ├── Entities.cs           # User, Queue, Patient, etc.
│   ├── Specifications/       # Query patterns
│   ├── Services/             # Domain services
│   └── Interfaces/           # IRepository, IMessageSender
│
├── Application/              # ✅ References Domain only
│   ├── Services/             # Use case implementations
│   ├── DTOs/                 # Data Transfer Objects
│   ├── Validators/           # FluentValidation rules
│   ├── Mappings/             # AutoMapper profiles
│   └── Commands/Queries/     # (Optional CQRS)
│
├── Infrastructure/           # ✅ Implements Domain interfaces
│   ├── Repositories/         # IRepository implementations
│   ├── UnitOfWork/           # Transaction management
│   ├── Persistence/          # ApplicationDbContext
│   └── Migrations/           # EF Core migrations
│
└── Api/ (Presentation)       # ✅ References Application
    ├── Controllers/          # HTTP endpoints
    ├── Middleware/           # Cross-cutting concerns
    └── Program.cs            # Dependency injection setup
```

---

### Dependency Injection Setup

```csharp
// Program.cs
var builder = WebApplicationBuilder.CreateBuilder(args);

// Infrastructure
builder.Services.AddScoped<IUnitOfWork, UnitOfWork>();
builder.Services.AddScoped(typeof(IRepository<>), typeof(Repository<>));

// Application Services
builder.Services.AddScoped<IQueueService, QueueService>();
builder.Services.AddScoped<IMessageService, MessageService>();

// Validation
builder.Services.AddValidatorsFromAssembly(typeof(Program).Assembly);

// AutoMapper
builder.Services.AddAutoMapper(AppDomain.CurrentDomain.GetAssemblies());

// Database
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
builder.Services.AddDbContext<ApplicationDbContext>(options =>
    options.UseSqlServer(connectionString));
```

---

### Service Template

```csharp
// ✅ Application Service - Proper Structure
namespace Clinics.Application.Services
{
    public interface IQueueService
    {
        Task<Result<QueueDto>> CreateQueueAsync(CreateQueueRequest request, int userId);
    }

    public class QueueService : IQueueService
    {
        private readonly IUnitOfWork _unitOfWork;           // Domain interface
        private readonly IValidator<CreateQueueRequest> _validator;
        private readonly ILogger<QueueService> _logger;

        public QueueService(
            IUnitOfWork unitOfWork,
            IValidator<CreateQueueRequest> validator,
            ILogger<QueueService> logger)
        {
            _unitOfWork = unitOfWork;
            _validator = validator;
            _logger = logger;
        }

        public async Task<Result<QueueDto>> CreateQueueAsync(
            CreateQueueRequest request, 
            int userId)
        {
            // 1. Validate
            var validation = await _validator.ValidateAsync(request);
            if (!validation.IsValid)
                return Result<QueueDto>.Failure(
                    validation.Errors.Select(e => e.ErrorMessage).ToList());

            // 2. Create domain entity
            var queue = new Queue 
            { 
                DoctorName = request.DoctorName,
                Description = request.Description,
                CreatedBy = userId
            };

            // 3. Persist via repository
            await _unitOfWork.Queues.AddAsync(queue);
            await _unitOfWork.SaveChangesAsync();

            _logger.LogInformation($"Queue created: {queue.Id}");

            // 4. Return DTO
            return Result<QueueDto>.Success(new QueueDto 
            { 
                Id = queue.Id,
                DoctorName = queue.DoctorName
            });
        }
    }
}
```

---

### Controller Template

```csharp
// ✅ Presentation Controller - Proper Structure
namespace Clinics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    [Authorize]
    public class QueuesController : ControllerBase
    {
        private readonly IQueueService _service;
        private readonly ILogger<QueuesController> _logger;

        public QueuesController(
            IQueueService service,
            ILogger<QueuesController> logger)
        {
            _service = service;
            _logger = logger;
        }

        [HttpPost]
        public async Task<ActionResult<ApiResponse<QueueDto>>> Create(
            [FromBody] CreateQueueRequest request)
        {
            var userId = GetUserId();
            var result = await _service.CreateQueueAsync(request, userId);

            if (result.Succeeded)
                return Ok(new ApiResponse<QueueDto> 
                { 
                    Success = true, 
                    Data = result.Data,
                    Message = result.Message
                });

            return BadRequest(new ApiResponse<QueueDto> 
            { 
                Success = false,
                Errors = result.Errors
            });
        }

        private int GetUserId()
        {
            var claim = User.FindFirst(ClaimTypes.NameIdentifier);
            return int.Parse(claim?.Value ?? "0");
        }
    }
}
```

---

### Repository Template

```csharp
// ✅ Infrastructure Repository - Implements Domain Interface
namespace Clinics.Infrastructure.Repositories
{
    public class QueueRepository : IQueueRepository  // From Domain
    {
        private readonly ApplicationDbContext _context;

        public QueueRepository(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<Queue?> GetByIdAsync(int id)
        {
            return await _context.Queues
                .Include(q => q.Patients)
                .FirstOrDefaultAsync(q => q.Id == id);
        }

        public async Task SaveAsync(Queue queue)
        {
            _context.Queues.Add(queue);
            await _context.SaveChangesAsync();
        }

        public async Task<bool> DeleteAsync(int id)
        {
            var queue = await GetByIdAsync(id);
            if (queue == null) return false;

            _context.Queues.Remove(queue);
            await _context.SaveChangesAsync();
            return true;
        }
    }
}
```

---

### DTO Template

```csharp
namespace Clinics.Application.DTOs
{
    public class QueueDto
    {
        public int Id { get; set; }
        public string DoctorName { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
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
    }
}
```

---

### Result Pattern Template

```csharp
namespace Clinics.Application
{
    public class Result
    {
        public bool Succeeded { get; set; }
        public string Message { get; set; } = string.Empty;
        public List<string> Errors { get; set; } = new();

        public static Result Success(string message = "Operation successful")
            => new() { Succeeded = true, Message = message };

        public static Result Failure(params string[] errors)
            => new() { Succeeded = false, Errors = new List<string>(errors) };
    }

    public class Result<T> : Result
    {
        public T? Data { get; set; }

        public static Result<T> Success(T data, string message = "Operation successful")
            => new() { Succeeded = true, Data = data, Message = message };

        public new static Result<T> Failure(params string[] errors)
            => new() { Succeeded = false, Errors = new List<string>(errors) };
    }
}
```

---

### Testing Template

```csharp
// ✅ Unit Test - Mock repository
[Fact]
public async Task CreateQueue_WithValidRequest_Succeeds()
{
    // Arrange
    var mockRepository = new Mock<IQueueRepository>();
    var mockValidator = new Mock<IValidator<CreateQueueRequest>>();
    var mockLogger = new Mock<ILogger<QueueService>>();

    var service = new QueueService(mockRepository.Object, mockValidator.Object, mockLogger.Object);
    var request = new CreateQueueRequest 
    { 
        DoctorName = "Dr. Ahmed",
        Description = "Test"
    };

    mockValidator
        .Setup(v => v.ValidateAsync(request, default))
        .ReturnsAsync(new ValidationResult());

    // Act
    var result = await service.CreateQueueAsync(request, 1);

    // Assert
    Assert.True(result.Succeeded);
    mockRepository.Verify(r => r.SaveAsync(It.IsAny<Queue>()), Times.Once);
}
```

---

### Anti-Patterns to Avoid

```csharp
// ❌ DON'T: Controller with business logic
[HttpPost]
public IActionResult Create([FromBody] Queue queue)
{
    if (queue.DoctorName.Length < 3)  // ← Business logic in controller
        return BadRequest();
    
    _context.Queues.Add(queue);  // ← Direct database access
    _context.SaveChanges();
    
    return Ok(queue);  // ← Entity returned to API
}

// ❌ DON'T: Service that directly uses DbContext
public class QueueService
{
    private readonly ApplicationDbContext _context;  // ← Tight coupling
    
    public Queue CreateQueue(Queue queue)
    {
        _context.Queues.Add(queue);
        _context.SaveChanges();
        return queue;
    }
}

// ❌ DON'T: Repository that has business logic
public class QueueRepository
{
    public Queue GetAvailableQueue()
    {
        // 30 lines of complex business logic  ← Should be in domain service
    }
}

// ❌ DON'T: Fat interfaces
public interface IDataService
{
    Task<User> GetUserAsync(int id);
    Task<Queue> GetQueueAsync(int id);
    Task<Patient> GetPatientAsync(int id);
    Task SaveUserAsync(User user);
    Task SaveQueueAsync(Queue queue);
    // 50+ more methods
}
```

---

### Good Patterns to Use

```csharp
// ✅ DO: Service layer separates concerns
[HttpPost]
public async Task<ActionResult<ApiResponse<QueueDto>>> Create([FromBody] CreateQueueRequest request)
{
    var result = await _queueService.CreateQueueAsync(request, GetUserId());
    return HandleResult(result);
}

// ✅ DO: Service uses repositories via interfaces
public class QueueService : IQueueService
{
    private readonly IQueueRepository _repository;
    private readonly IValidator<CreateQueueRequest> _validator;
    
    public async Task<Result<QueueDto>> CreateQueueAsync(CreateQueueRequest request, int userId)
    {
        var validation = await _validator.ValidateAsync(request);
        if (!validation.IsValid)
            return Result<QueueDto>.Failure(validation.Errors.Select(e => e.ErrorMessage).ToList());
        
        var queue = new Queue { /* ... */ };
        await _repository.SaveAsync(queue);
        
        return Result<QueueDto>.Success(MapToDto(queue));
    }
}

// ✅ DO: Repository interfaces defined in Domain
public interface IQueueRepository
{
    Task<Queue?> GetByIdAsync(int id);
    Task SaveAsync(Queue queue);
    Task<bool> DeleteAsync(int id);
}

// ✅ DO: Lean interfaces
public interface IUserRepository
{
    Task<User?> GetByIdAsync(int id);
    Task SaveAsync(User user);
}

public interface IQueueRepository
{
    Task<Queue?> GetByIdAsync(int id);
    Task SaveAsync(Queue queue);
}
```

---

### Refactoring Checklist

**For Each Controller**:
- [ ] Move logic to Application service
- [ ] Return DTOs, not entities
- [ ] Use Result<T> pattern
- [ ] Handle errors consistently

**For Each Service**:
- [ ] Use repository interfaces from Domain
- [ ] Implement ONE use case
- [ ] Inject dependencies (no direct DbContext)
- [ ] Add validation

**For Each Repository**:
- [ ] Implement interface from Domain
- [ ] Only data access logic
- [ ] No business logic
- [ ] Use IRepository<T> base

**For Each DTO**:
- [ ] Not the same as entity
- [ ] Only what API needs
- [ ] Clear naming

---

## 📚 Docs Available

1. **ARCHITECTURE_ISSUES.md** - What's wrong with current code
2. **IMPLEMENTATION_PLAN.md** - Step-by-step refactoring guide (20 days)
3. **CLEAN_ARCHITECTURE_GUIDE.md** - Detailed explanations & examples
4. **ARCHITECTURE_QUICK_REF.md** - This file (templates & quick snippets)

---

## 🚀 Getting Started

1. Read **CLEAN_ARCHITECTURE_GUIDE.md** (understand why)
2. Review **ARCHITECTURE_ISSUES.md** (understand what's wrong)
3. Follow **IMPLEMENTATION_PLAN.md** (implement step by step)
4. Use **ARCHITECTURE_QUICK_REF.md** (copy templates)

---

## Status

- ✅ Analysis Complete
- ✅ Plan Created
- ✅ Documentation Ready
- ⏳ Implementation: Ready to Start (see IMPLEMENTATION_PLAN.md)
- ✅ Test Pass Rate: 375/425 (88.2%)

**Next Step**: Open IMPLEMENTATION_PLAN.md and start Phase 1 Day 1
