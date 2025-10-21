# Clean Architecture Reference Guide

## Quick Navigation

This guide helps you understand and apply Clean Architecture and SOLID principles to the Clinics Management System.

---

## 📚 What is Clean Architecture?

Clean Architecture is an approach to software design that:

1. **Separates concerns** into distinct layers
2. **Minimizes dependencies** between layers
3. **Puts business logic** at the center
4. **Allows easy testing** of business rules independent of UI/DB
5. **Makes code maintainable** and flexible for changes

### The Concentric Circles

```
┌─────────────────────────────────────────────────┐
│                  FRAMEWORKS & UI                 │  (Controllers, Views)
├─────────────────────────────────────────────────┤
│              INTERFACE ADAPTERS                  │  (DTOs, Mappers, Presenters)
├─────────────────────────────────────────────────┤
│          APPLICATION BUSINESS RULES              │  (Use Cases, Services)
├─────────────────────────────────────────────────┤
│           ENTERPRISE BUSINESS RULES              │  (Entities, Domain Logic)
└─────────────────────────────────────────────────┘
```

**Key Rule**: The inner circles should NOT know about outer circles.

---

## 🏗️ Proposed Layered Architecture

### Layer 1: Domain (Innermost - No Dependencies)
**Location**: `src/Domain/`

**Responsibility**: Pure business logic and entities

**Contains**:
- Entity definitions (classes that represent business concepts)
- Domain services (business logic that doesn't fit in a single entity)
- Value objects (immutable domain concepts)
- Domain events (things that happened)
- Specifications (query patterns)
- Interfaces (contracts defined here, implemented in outer layers)

**Example**:
```csharp
// ✅ Domain Layer - Pure business logic
namespace Clinics.Domain
{
    public class Queue  // Entity
    {
        public int Id { get; set; }
        public string DoctorName { get; set; }
        
        // Domain logic - not database logic
        public int GetWaitingPatientCount() => Patients.Count();
        public bool CanAddPatient() => GetWaitingPatientCount() < MaxPatients;
    }

    public interface IQueueRepository  // Interface defined in domain
    {
        Task<Queue?> GetByIdAsync(int id);
        Task SaveAsync(Queue queue);
    }
}
```

**Important**: Domain does NOT reference:
- ❌ Clinics.Infrastructure
- ❌ Clinics.Api
- ❌ Database libraries
- ❌ HTTP libraries

---

### Layer 2: Application (Use Cases & Services)
**Location**: `src/Application/`

**Responsibility**: Orchestrate business logic and define use cases

**Contains**:
- Application services (use case implementations)
- DTOs (Data Transfer Objects)
- Commands/Queries (if using CQRS)
- Validators
- Mappers
- Repository interfaces (calls interfaces defined in Domain)

**Example**:
```csharp
// ✅ Application Layer - Use case orchestration
namespace Clinics.Application.Services
{
    public interface IQueueService
    {
        Task<Result<QueueDto>> CreateQueueAsync(CreateQueueRequest request, int userId);
        Task<Result<QueueDto>> GetQueueAsync(int id);
    }

    public class QueueService : IQueueService
    {
        private readonly IQueueRepository _repository;  // Depends on interface from Domain
        private readonly IValidator<CreateQueueRequest> _validator;
        private readonly ILogger<QueueService> _logger;

        public QueueService(
            IQueueRepository repository,
            IValidator<CreateQueueRequest> validator,
            ILogger<QueueService> logger)
        {
            _repository = repository;
            _validator = validator;
            _logger = logger;
        }

        public async Task<Result<QueueDto>> CreateQueueAsync(CreateQueueRequest request, int userId)
        {
            // Validation
            var validationResult = await _validator.ValidateAsync(request);
            if (!validationResult.IsValid)
                return Result<QueueDto>.Failure(validationResult.Errors.Select(e => e.ErrorMessage).ToList());

            // Business logic (calls domain entities/services)
            var queue = new Queue 
            { 
                DoctorName = request.DoctorName,
                Description = request.Description,
                CreatedBy = userId
            };

            // Persistence (uses repository)
            await _repository.SaveAsync(queue);
            
            _logger.LogInformation($"Queue created: {queue.Id}");

            // Return DTO (not entity)
            return Result<QueueDto>.Success(new QueueDto 
            { 
                Id = queue.Id, 
                DoctorName = queue.DoctorName 
            });
        }
    }
}
```

**Application Layer Dependencies**:
- ✅ References Domain
- ✅ Uses Repository interfaces (defined in Domain)
- ✅ Uses DTOs
- ❌ Does NOT reference Infrastructure directly
- ❌ Does NOT reference Controllers/API

---

### Layer 3: Infrastructure (Data Access & External Services)
**Location**: `src/Infrastructure/`

**Responsibility**: Implement abstractions from Domain/Application

**Contains**:
- Repository implementations (IRepository implementations)
- DbContext and EF Core configuration
- External service integrations
- Unit of Work implementations
- Database migrations

**Example**:
```csharp
// ✅ Infrastructure Layer - Data access implementation
namespace Clinics.Infrastructure.Repositories
{
    public class QueueRepository : IQueueRepository  // Implements interface from Domain
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
    }
}
```

**Infrastructure Layer Dependencies**:
- ✅ References Domain (for interfaces and entities)
- ✅ References Application (for services it implements)
- ✅ Uses Entity Framework Core
- ✅ Knows about databases

---

### Layer 4: Presentation (API)
**Location**: `src/Api/`

**Responsibility**: Handle HTTP requests and responses

**Contains**:
- Controllers
- Model binding attributes
- Middleware
- Filters
- ApiResponse wrappers

**Example**:
```csharp
// ✅ Presentation Layer - HTTP handling
namespace Clinics.Api.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class QueuesController : ControllerBase
    {
        private readonly IQueueService _service;  // Depends on application service

        public QueuesController(IQueueService service)
        {
            _service = service;
        }

        [HttpPost]
        public async Task<ActionResult<ApiResponse<QueueDto>>> Create([FromBody] CreateQueueRequest request)
        {
            // Get user from claims
            var userId = int.Parse(User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "0");

            // Call application service
            var result = await _service.CreateQueueAsync(request, userId);

            // Return HTTP response
            if (result.Succeeded)
                return Ok(new ApiResponse<QueueDto> { Data = result.Data, Success = true });
            
            return BadRequest(new ApiResponse<QueueDto> { Errors = result.Errors, Success = false });
        }
    }
}
```

**Presentation Layer Dependencies**:
- ✅ References Application (services)
- ✅ Uses DTOs
- ✅ Handles HTTP
- ❌ Does NOT contain business logic
- ❌ Does NOT directly access repositories

---

## 🔄 Dependency Flow (THE GOLDEN RULE)

```
Controllers
    ↓ (depends on)
Application Services
    ↓ (depends on)
Domain Interfaces & Entities
    ↑ (implements)
Infrastructure Repositories
```

**Key Points**:
- ✅ Outer layers depend on inner layers
- ❌ Inner layers NEVER depend on outer layers
- ✅ Repositories implement interfaces from Domain
- ✅ Controllers call services from Application
- ✅ Services use repositories via Domain interfaces

---

## 💎 SOLID Principles Explained

### 1️⃣ Single Responsibility Principle (SRP)

**Rule**: A class should have only ONE reason to change.

**❌ Bad Example (Violates SRP)**:
```csharp
public class QueueService
{
    public async Task CreateQueue(CreateQueueRequest request)
    {
        // Validation
        if (string.IsNullOrEmpty(request.DoctorName))
            throw new Exception("Invalid");
        
        // Database operation
        var queue = new Queue { ... };
        using (var context = new ApplicationDbContext())
        {
            context.Queues.Add(queue);
            await context.SaveChangesAsync();
        }
        
        // HTTP response formatting
        return new { success = true, data = new { id = queue.Id } };
    }
}
```

**✅ Good Example (Follows SRP)**:
```csharp
// Service: Only orchestrates (1 reason to change = business logic)
public class QueueService : IQueueService
{
    private readonly IQueueRepository _repository;
    private readonly IValidator<CreateQueueRequest> _validator;

    public async Task<Result<QueueDto>> CreateQueueAsync(CreateQueueRequest request, int userId)
    {
        var validation = await _validator.ValidateAsync(request);
        if (!validation.IsValid)
            return Result<QueueDto>.Failure(validation.Errors.Select(e => e.ErrorMessage).ToList());

        var queue = new Queue { DoctorName = request.DoctorName, CreatedBy = userId };
        await _repository.SaveAsync(queue);
        
        return Result<QueueDto>.Success(new QueueDto { Id = queue.Id });
    }
}

// Validator: Only validates (1 reason to change = validation rules)
public class CreateQueueRequestValidator : AbstractValidator<CreateQueueRequest>
{
    public CreateQueueRequestValidator()
    {
        RuleFor(x => x.DoctorName).NotEmpty();
    }
}

// Repository: Only does data access (1 reason to change = data storage)
public class QueueRepository : IQueueRepository
{
    private readonly ApplicationDbContext _context;

    public async Task SaveAsync(Queue queue)
    {
        _context.Queues.Add(queue);
        await _context.SaveChangesAsync();
    }
}

// Controller: Only handles HTTP (1 reason to change = API requirements)
public class QueuesController : ControllerBase
{
    private readonly IQueueService _service;

    [HttpPost]
    public async Task<ActionResult<ApiResponse<QueueDto>>> Create([FromBody] CreateQueueRequest request)
    {
        var result = await _service.CreateQueueAsync(request, GetUserId());
        return Ok(new ApiResponse<QueueDto> { Data = result.Data });
    }
}
```

**Benefit**: Each class has ONE reason to change, making code maintainable.

---

### 2️⃣ Open/Closed Principle (OCP)

**Rule**: Software should be OPEN for extension but CLOSED for modification.

**❌ Bad Example (Violates OCP)**:
```csharp
public class MessageService
{
    public async Task SendMessage(Message message)
    {
        // Hard-coded for WhatsApp only
        if (message.Type == "whatsapp")
        {
            // WhatsApp specific logic
            await _whatsappClient.SendAsync(message);
        }
        else if (message.Type == "sms")
        {
            // SMS specific logic
            await _smsClient.SendAsync(message);
        }
        // If we add new channel, we must modify this method!
    }
}
```

**✅ Good Example (Follows OCP)**:
```csharp
// Define abstraction
public interface IMessageSender
{
    Task SendAsync(Message message);
}

// Implement for each channel (OPEN for extension)
public class WhatsAppMessageSender : IMessageSender
{
    public async Task SendAsync(Message message) => await _whatsappClient.SendAsync(message);
}

public class SmsMessageSender : IMessageSender
{
    public async Task SendAsync(Message message) => await _smsClient.SendAsync(message);
}

// Use abstraction (CLOSED for modification)
public class MessageService
{
    private readonly IMessageSender _sender;

    public async Task SendMessageAsync(Message message)
    {
        await _sender.SendAsync(message);  // Works for any channel!
    }
}

// Add new channel without modifying existing code
public class EmailMessageSender : IMessageSender
{
    public async Task SendAsync(Message message) => await _emailClient.SendAsync(message);
}
```

**Benefit**: Add new channels without changing existing code.

---

### 3️⃣ Liskov Substitution Principle (LSP)

**Rule**: Derived classes must be substitutable for base classes.

**❌ Bad Example (Violates LSP)**:
```csharp
public interface IMessageSender
{
    Task SendAsync(Message message);
}

public class WhatsAppSender : IMessageSender
{
    public async Task SendAsync(Message message)
    {
        if (message.PhoneNumber.Length != 10)
            throw new Exception("WhatsApp requires 10-digit numbers");
        await _api.SendAsync(message);
    }
}

// Using different implementations causes errors
IMessageSender sender = new WhatsAppSender();
await sender.SendAsync(message);  // Throws exception with unexpected format
```

**✅ Good Example (Follows LSP)**:
```csharp
public interface IMessageSender
{
    Task<Result> SendAsync(Message message);  // Returns result instead of throwing
}

public class WhatsAppSender : IMessageSender
{
    public async Task<Result> SendAsync(Message message)
    {
        if (message.PhoneNumber.Length != 10)
            return Result.Failure("Invalid phone number format");
        
        await _api.SendAsync(message);
        return Result.Success();
    }
}

// Now any IMessageSender can be used interchangeably
IMessageSender sender = new WhatsAppSender();
var result = await sender.SendAsync(message);
if (!result.Succeeded)
    // Handle error consistently
```

**Benefit**: Can swap implementations without breaking code.

---

### 4️⃣ Interface Segregation Principle (ISP)

**Rule**: Clients should not depend on interfaces they don't use.

**❌ Bad Example (Violates ISP)**:
```csharp
// Fat interface - implementations must implement all methods
public interface IDataAccess
{
    Task<User> GetUserAsync(int id);
    Task<Queue> GetQueueAsync(int id);
    Task<Message> GetMessageAsync(int id);
    Task<Patient> GetPatientAsync(int id);
    Task SaveUserAsync(User user);
    Task SaveQueueAsync(Queue queue);
    // ... 50 more methods
}

// Must implement everything, even if only need 2 methods
public class UserService : IDataAccess
{
    public async Task<User> GetUserAsync(int id) => ...
    public async Task<Queue> GetQueueAsync(int id) => throw new NotImplementedException();
    // 50+ stub implementations
}
```

**✅ Good Example (Follows ISP)**:
```csharp
// Segregated interfaces - use only what you need
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

// Implement only what's needed
public class UserService
{
    private readonly IUserRepository _userRepository;
    public UserService(IUserRepository userRepository) => _userRepository = userRepository;
}

public class QueueService
{
    private readonly IQueueRepository _queueRepository;
    public QueueService(IQueueRepository queueRepository) => _queueRepository = queueRepository;
}
```

**Benefit**: Classes only depend on methods they actually use.

---

### 5️⃣ Dependency Inversion Principle (DIP)

**Rule**: High-level modules should NOT depend on low-level modules. Both should depend on abstractions.

**❌ Bad Example (Violates DIP)**:
```csharp
// High-level service depends on low-level database directly
public class QueueService
{
    private readonly ApplicationDbContext _context;  // Direct dependency!

    public async Task<Queue> GetQueueAsync(int id)
    {
        return await _context.Queues.FirstOrDefaultAsync(q => q.Id == id);
    }
}

// Can't test without database
// Can't swap database implementation
```

**✅ Good Example (Follows DIP)**:
```csharp
// Define abstraction (in Domain)
public interface IQueueRepository
{
    Task<Queue?> GetByIdAsync(int id);
}

// High-level service depends on abstraction
public class QueueService
{
    private readonly IQueueRepository _repository;  // Depends on interface!

    public QueueService(IQueueRepository repository)
    {
        _repository = repository;
    }

    public async Task<Queue?> GetQueueAsync(int id)
    {
        return await _repository.GetByIdAsync(id);
    }
}

// Low-level implementation
public class QueueRepository : IQueueRepository
{
    private readonly ApplicationDbContext _context;

    public async Task<Queue?> GetByIdAsync(int id)
    {
        return await _context.Queues.FirstOrDefaultAsync(q => q.Id == id);
    }
}

// Easy to test with mock
var mockRepository = new Mock<IQueueRepository>();
mockRepository.Setup(r => r.GetByIdAsync(1)).ReturnsAsync(new Queue { Id = 1 });
var service = new QueueService(mockRepository.Object);
```

**Benefit**: Easy to test, swap implementations, maintain code.

---

## 🎯 Common Patterns

### Repository Pattern

**What**: Abstraction for data access

**When**: Always - separates data access from business logic

```csharp
public interface IRepository<T>
{
    Task<T?> GetByIdAsync(int id);
    Task<IEnumerable<T>> GetAllAsync();
    Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicate);
    Task AddAsync(T entity);
    Task UpdateAsync(T entity);
    Task RemoveAsync(int id);
    Task<int> SaveChangesAsync();
}
```

---

### Unit of Work Pattern

**What**: Manages multiple repositories and transactions

**When**: When you have multiple entities that need to work together

```csharp
public interface IUnitOfWork
{
    IRepository<Queue> Queues { get; }
    IRepository<Patient> Patients { get; }
    IRepository<Message> Messages { get; }
    Task SaveAsync();
}
```

---

### Specification Pattern

**What**: Encapsulates query logic in objects

**When**: When queries are complex or reused

```csharp
public class GetActiveQueuesSpecification : BaseSpecification<Queue>
{
    public GetActiveQueuesSpecification()
    {
        Criteria = q => q.IsActive;
        AddInclude(q => q.Patients);
        AddOrderBy(q => q.DoctorName);
    }
}

// Usage
var spec = new GetActiveQueuesSpecification();
var queues = await _repository.GetBySpecificationAsync(spec);
```

---

### Result Pattern

**What**: Standardized response from operations

**When**: When you need to communicate success/failure

```csharp
public class Result<T>
{
    public bool Succeeded { get; set; }
    public T? Data { get; set; }
    public List<string> Errors { get; set; } = new();

    public static Result<T> Success(T data) 
        => new() { Succeeded = true, Data = data };

    public static Result<T> Failure(params string[] errors)
        => new() { Succeeded = false, Errors = new List<string>(errors) };
}

// Usage
var result = Result<QueueDto>.Success(dto);
if (!result.Succeeded)
    return BadRequest(result.Errors);
```

---

## 🧪 Testing Strategy with Clean Architecture

### Unit Testing Services

```csharp
[Fact]
public async Task CreateQueue_WithValidRequest_ReturnsSuccess()
{
    // Arrange
    var mockRepository = new Mock<IQueueRepository>();
    var mockValidator = new Mock<IValidator<CreateQueueRequest>>();
    var mockLogger = new Mock<ILogger<QueueService>>();
    
    var service = new QueueService(mockRepository.Object, mockValidator.Object, mockLogger.Object);
    var request = new CreateQueueRequest { DoctorName = "Dr. Ahmed", Description = "Test" };

    mockValidator.Setup(v => v.ValidateAsync(request, default))
        .ReturnsAsync(new ValidationResult());

    // Act
    var result = await service.CreateQueueAsync(request, 1);

    // Assert
    Assert.True(result.Succeeded);
    mockRepository.Verify(r => r.SaveAsync(It.IsAny<Queue>()), Times.Once);
}
```

### Integration Testing

```csharp
[Fact]
public async Task CreateQueue_Integration_SavesToDatabase()
{
    // Arrange
    var options = new DbContextOptionsBuilder<ApplicationDbContext>()
        .UseInMemoryDatabase("TestDb")
        .Options;

    using var context = new ApplicationDbContext(options);
    var repository = new QueueRepository(context);
    var service = new QueueService(repository, ...);

    // Act
    var result = await service.CreateQueueAsync(
        new CreateQueueRequest { DoctorName = "Dr. Ahmed" }, 
        1);

    // Assert
    Assert.True(result.Succeeded);
    var saved = await context.Queues.FirstOrDefaultAsync(q => q.DoctorName == "Dr. Ahmed");
    Assert.NotNull(saved);
}
```

---

## 📋 Checklist for Clean Architecture

Before committing code, ask:

- [ ] Does Domain layer have zero external dependencies?
- [ ] Do Application services use repository interfaces?
- [ ] Are repositories defined in Domain but implemented in Infrastructure?
- [ ] Do Controllers only call Application services?
- [ ] Are DTOs used for API responses?
- [ ] Is business logic in Domain/Application, not Controllers?
- [ ] Can I test the service without Database/HTTP?
- [ ] Does each class have one reason to change?
- [ ] Can I substitute implementations without changing other code?
- [ ] Are interfaces focused (ISP)?

---

## 🚀 Quick Start Checklist

1. ✅ **Read this entire guide** (20 min)
2. ✅ **Review ARCHITECTURE_ISSUES.md** (15 min)
3. ✅ **Follow IMPLEMENTATION_PLAN.md** (20 days)
4. ✅ **Maintain 88.2% test pass rate** (continuous)
5. ✅ **Document as you refactor** (daily)

---

## 📚 Additional Resources

- [Clean Architecture by Robert Martin](https://www.amazon.com/Clean-Architecture-Craftsmans-Software-Structure/dp/0134494164)
- [Microsoft's Clean Architecture](https://docs.microsoft.com/en-us/dotnet/architecture/clean-code/)
- [SOLID Principles in C#](https://www.pluralsight.com/courses/csharp-solid-principles)
- [Repository Pattern](https://docs.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/infrastructure-persistence-layer-design)
- [Unit of Work Pattern](https://martinfowler.com/eaaCatalog/unitOfWork.html)

---

## Questions?

Refer back to:
1. ARCHITECTURE_ISSUES.md - What's wrong
2. IMPLEMENTATION_PLAN.md - How to fix it
3. This guide - Why it matters

**Remember**: Clean Architecture makes code maintainable, testable, and flexible for future changes.
