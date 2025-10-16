# Clinics Management System — Architecture

Last updated: 2025-10-14

This document is a single-source architecture and implementation guide for the Clinics Management System prototype you provided. It targets the following stack:

- Backend: .NET 8 (ASP.NET Core Web API)
- Frontend: Next.js (React) — Arabic RTL support
- Database: Microsoft SQL Server
- Background processing: .NET Worker Services / Hangfire / optional message broker
- Hosting: Azure (App Service/AKS + Azure SQL) or container platforms

The content below includes:
- High-level architecture and components
- Data model & full CREATE TABLE scripts for SQL Server (with indexes and seeds)
- API surface (endpoints, DTOs, auth rules) and OpenAPI guidance
- Background workers, message sending & WhatsApp integration options
- Next.js frontend organization and RTL considerations
- Dev environment: Docker Compose, CI/CD notes
- Testing, monitoring & observability
- Implementation plan with sprints, tasks and immediate next steps

---

## 1. High-level architecture

Components:

- Web client (Next.js): SPA/SSR where appropriate. RTL and Arabic localization. Uses JWT via secure cookies + refresh token flow.
- API Backend (ASP.NET Core .NET 8): Exposes RESTful endpoints for auth, users, queues, patients, messages, templates, management.
- SQL Server: Primary relational datastore for all entities, quotas and audit logs.
- Background Worker(s): Responsible for sending messages (WhatsApp/SMS), retrying failed tasks, rate limiting, and long running jobs.
- Message Broker (optional): RabbitMQ / Azure Service Bus for decoupling front-end triggered jobs and processing pipelines; recommended when scaling.
- Cache (optional): Redis for distributed locks, rate-limiting counters, and session caching.
- Monitoring & Logging: Application Insights / OpenTelemetry + Prometheus/Grafana and Serilog/Seq.
- External Provider(s): WhatsApp Business API (Meta Cloud), or third-party provider (Twilio, 360dialog, Vonage).

Textual diagram (data & control flow):

Client (Next.js) -> HTTPS -> API Gateway/ASP.NET Core -> SQL Server
                                          \-> Enqueue send-request -> Message Broker -> Worker -> WhatsApp Provider
                                          \-> Hangfire/BackgroundService runs scheduled jobs against DB

Security boundary: TLS everywhere, HttpOnly secure cookies for tokens, RBAC checks in backend, infrastructure network rules.

---

## 2. Data model (ER overview)

Core entities (conceptual):

- User (id, username, name, role, authentication data, profile)
- Role (predefined: primary_admin, secondary_admin, moderator, user)
- Queue (a doctor queue)
- Patient (a patient entry belonging to a queue/session)
- MessageTemplate (predefined templates with variables)
- Message (a single send attempt/record)
- FailedTask (failed send attempts metadata)
- Quota (per moderator messages/queues limits)
- Session (WhatsApp session metadata if using web session)
- AuditLog (application-level audit trail)

Relationships (high level):
- User 1..* Queue (creator/owner relationship via created_by)
- Queue 1..* Patient
- User 1..* MessageTemplate (createdBy)
- Message references Patient, Template, Queue, Sender

The SQL scripts below implement the schema with constraints and indexes suitable for fast lookups.

---

## 3. Full SQL Server CREATE TABLE scripts + indexes + seed

Notes before running:
- The scripts assume a new database `ClinicsDb`.
- Use a migration-based approach in production (EF Core Migrations recommended). The scripts are provided for clarity and initial seeds.

-- Create database (if needed)

```sql
IF DB_ID(N'ClinicsDb') IS NULL
BEGIN
    CREATE DATABASE ClinicsDb;
END
GO
USE ClinicsDb;
GO
```

-- Roles table

```sql
CREATE TABLE dbo.Roles (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Name NVARCHAR(50) NOT NULL UNIQUE,
    DisplayName NVARCHAR(100) NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
```

-- Users

```sql
CREATE TABLE dbo.Users (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Username NVARCHAR(100) NOT NULL UNIQUE,
    PasswordHash NVARCHAR(512) NULL, -- store salted hash (use ASP.NET Identity or equivalent)
    Salt NVARCHAR(64) NULL,
    FullName NVARCHAR(200) NOT NULL,
    RoleId INT NOT NULL REFERENCES dbo.Roles(Id),
    PhoneNumber NVARCHAR(32) NULL,
    Email NVARCHAR(256) NULL,
    IsActive BIT NOT NULL DEFAULT 1,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    LastLoginAt DATETIME2 NULL
);
CREATE INDEX IX_Users_PhoneNumber ON dbo.Users(PhoneNumber);
```

-- Sessions (refresh tokens / whatsapp sessions)

```sql
CREATE TABLE dbo.Sessions (
    Id UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY,
    UserId INT NOT NULL REFERENCES dbo.Users(Id) ON DELETE CASCADE,
    RefreshToken NVARCHAR(512) NOT NULL,
    ExpiresAt DATETIME2 NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    IpAddress NVARCHAR(50) NULL,
    UserAgent NVARCHAR(512) NULL
);
CREATE INDEX IX_Sessions_UserId ON dbo.Sessions(UserId);
```

-- Queues (doctor queues)

```sql
CREATE TABLE dbo.Queues (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    DoctorName NVARCHAR(200) NOT NULL,
    Description NVARCHAR(1000) NULL,
    CreatedBy INT NOT NULL REFERENCES dbo.Users(Id),
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    IsActive BIT NOT NULL DEFAULT 1,
    CurrentPosition INT NOT NULL DEFAULT 0,
    EstimatedWaitMinutes INT NULL
);
CREATE INDEX IX_Queues_DoctorName ON dbo.Queues(DoctorName);
CREATE INDEX IX_Queues_CreatedBy ON dbo.Queues(CreatedBy);
```

-- Patients

```sql
CREATE TABLE dbo.Patients (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    QueueId INT NOT NULL REFERENCES dbo.Queues(Id) ON DELETE CASCADE,
    LocalId NVARCHAR(50) NULL, -- optional external id or clinic code
    FullName NVARCHAR(250) NOT NULL,
    PhoneNumber NVARCHAR(32) NOT NULL,
    NationalId NVARCHAR(50) NULL,
    Position INT NOT NULL, -- position in the queue
    Status NVARCHAR(50) NOT NULL DEFAULT N'waiting', -- waiting, in_service, served, cancelled
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    Metadata NVARCHAR(MAX) NULL
);
CREATE INDEX IX_Patients_QueueId_Position ON dbo.Patients(QueueId, Position);
CREATE INDEX IX_Patients_Phone ON dbo.Patients(PhoneNumber);
```

-- Message templates

```sql
CREATE TABLE dbo.MessageTemplates (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    Title NVARCHAR(200) NOT NULL,
    Content NVARCHAR(MAX) NOT NULL,
    CreatedBy INT NOT NULL REFERENCES dbo.Users(Id),
    Moderator NVARCHAR(200) NULL,
    IsShared BIT NOT NULL DEFAULT 0,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_MessageTemplates_CreatedBy ON dbo.MessageTemplates(CreatedBy);
```

-- Messages (send log)

```sql
CREATE TABLE dbo.Messages (
    Id BIGINT IDENTITY(1,1) PRIMARY KEY,
    PatientId INT NULL REFERENCES dbo.Patients(Id),
    TemplateId INT NULL REFERENCES dbo.MessageTemplates(Id),
    QueueId INT NULL REFERENCES dbo.Queues(Id),
    SenderUserId INT NULL REFERENCES dbo.Users(Id),
    ProviderMessageId NVARCHAR(200) NULL,
    Channel NVARCHAR(50) NOT NULL DEFAULT 'whatsapp', -- whatsapp, sms, etc.
    RecipientPhone NVARCHAR(32) NOT NULL,
    Content NVARCHAR(MAX) NOT NULL,
    Status NVARCHAR(50) NOT NULL DEFAULT 'queued', -- queued, sending, sent, failed
    Attempts INT NOT NULL DEFAULT 0,
    LastAttemptAt DATETIME2 NULL,
    SentAt DATETIME2 NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_Messages_Status_CreatedAt ON dbo.Messages(Status, CreatedAt);
CREATE INDEX IX_Messages_PatientId ON dbo.Messages(PatientId);
```

-- Failed tasks (for admin retry UI)

```sql
CREATE TABLE dbo.FailedTasks (
    Id BIGINT IDENTITY(1,1) PRIMARY KEY,
    MessageId BIGINT NULL REFERENCES dbo.Messages(Id),
    PatientId INT NULL REFERENCES dbo.Patients(Id),
    QueueId INT NULL REFERENCES dbo.Queues(Id),
    Reason NVARCHAR(1000) NULL,
    ProviderResponse NVARCHAR(MAX) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    LastRetryAt DATETIME2 NULL,
    RetryCount INT NOT NULL DEFAULT 0
);
CREATE INDEX IX_FailedTasks_RetryCount ON dbo.FailedTasks(RetryCount);
```

-- Quotas

```sql
CREATE TABLE dbo.Quotas (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ModeratorUserId INT NOT NULL REFERENCES dbo.Users(Id) UNIQUE,
    MessagesQuota INT NOT NULL DEFAULT 0,
    ConsumedMessages INT NOT NULL DEFAULT 0,
    QueuesQuota INT NOT NULL DEFAULT 0,
    ConsumedQueues INT NOT NULL DEFAULT 0,
    UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_Quotas_ModeratorUserId ON dbo.Quotas(ModeratorUserId);
```

-- Audit logs

```sql
CREATE TABLE dbo.AuditLogs (
    Id BIGINT IDENTITY(1,1) PRIMARY KEY,
    UserId INT NULL REFERENCES dbo.Users(Id),
    Action NVARCHAR(200) NOT NULL,
    Entity NVARCHAR(200) NULL,
    EntityId NVARCHAR(100) NULL,
    Details NVARCHAR(MAX) NULL,
    IpAddress NVARCHAR(50) NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_AuditLogs_UserId ON dbo.AuditLogs(UserId);
```

-- Optional: WhatsApp session table for web-session management

```sql
CREATE TABLE dbo.WhatsAppSessions (
    Id INT IDENTITY(1,1) PRIMARY KEY,
    ModeratorUserId INT NOT NULL REFERENCES dbo.Users(Id),
    SessionName NVARCHAR(200) NULL,
    ProviderSessionId NVARCHAR(200) NULL,
    Status NVARCHAR(50) NULL, -- connected, disconnected
    LastSyncAt DATETIME2 NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
```

-- Seeds (roles + admin user sample)

```sql
INSERT INTO dbo.Roles (Name, DisplayName) VALUES
('primary_admin', N'المدير الأساسي'),
('secondary_admin', N'المدير الثانوي'),
('moderator', N'المشرف'),
('user', N'المستخدم');

-- Insert a sample admin user (password must be hashed in real app)
INSERT INTO dbo.Users (Username, PasswordHash, FullName, RoleId, PhoneNumber, Email, IsActive)
VALUES ('admin', 'REPLACE_WITH_HASH', N'المدير الأساسي', (SELECT Id FROM dbo.Roles WHERE Name='primary_admin'), '+966500000000', 'admin@example.com', 1);

-- Example queue
INSERT INTO dbo.Queues (DoctorName, Description, CreatedBy, CurrentPosition, EstimatedWaitMinutes)
VALUES (N'د. أحمد محمد', N'طابور العيادة A', 1, 1, 15);
```

Notes:
- Replace 'REPLACE_WITH_HASH' with a properly-generated password hash using the auth library you choose (ASP.NET Identity recommended).
- Use EF Core migrations instead of running raw scripts for schema evolution.

---

## 4. API surface (REST) — high level

Authentication: JWT short-lived access token + refresh token stored in an HttpOnly Secure SameSite cookie. Use HTTPS only. Access token contains claims: sub (user id), role, name, jti.

Authorization: Role-based on claim `role`. Example policies:
- AdminPolicy -> primary_admin only
- SecondaryAdminPolicy -> secondary_admin or primary_admin
- ModeratorOrAbove -> moderator, secondary_admin, primary_admin
- UserPolicy -> authenticated user

Common headers:
- Authorization: Bearer <access-token>
- X-Correlation-Id: <uuid> (for tracing)

Error format (consistent envelope):

```json
{
  "success": false,
  "errors": [
    { "code": "InvalidCredentials", "message": "..." }
  ],
  "traceId": "<trace-id>"
}
```

Successful standard response envelope example:

```json
{
  "success": true,
  "data": { ... }
}
```

---

### 4.1 Auth

- POST /api/auth/login
  - Request: { username, password }
  - Response (200): { accessToken (JWT), expiresIn, user: { id, username, fullName, role } }
  - Side effect: sets refresh token cookie
- POST /api/auth/refresh
  - Uses refresh cookie, returns new accessToken
- POST /api/auth/logout
  - Invalidates refresh token, clears cookie

### 4.2 Users & Account

- GET /api/users/me
  - Response: user's profile
- PUT /api/users/me
  - Update profile, fields: fullName, phone, email
- PUT /api/users/me/change-password
  - Request: { currentPassword, newPassword }

Admin endpoints (role-protected):
- GET /api/users?role={role}&page=1&pageSize=50
- POST /api/users (create) — admin creates user
- PUT /api/users/{id} — edit
- DELETE /api/users/{id}
- POST /api/users/{id}/reset-password

DTO examples (create user):

```json
{ "username": "mod1", "fullName": "المشرف الاول", "role":"moderator", "phone":"+9665..." }
```

### 4.3 Queues

- GET /api/queues?page&pageSize&createdBy&active
- GET /api/queues/{id}
- POST /api/queues (moderator or user roles)
- PUT /api/queues/{id}
- DELETE /api/queues/{id} (admins)
- POST /api/queues/{id}/positions (update currentPosition/estimatedTime)

Queue details should include counts and simple stats.

### 4.4 Patients

- GET /api/queues/{queueId}/patients?page&pageSize&status
- POST /api/queues/{queueId}/patients (single)
- POST /api/queues/{queueId}/patients/bulk (bulk add via JSON or file upload)
- PUT /api/patients/{id}
- DELETE /api/patients/{id}
- POST /api/patients/reorder
  - Request: { patientId, targetPosition }
- POST /api/patients/bulk-upload -> returns preview and staging results

### 4.5 Messages & Templates

Templates (CRUD):
- GET /api/templates
- GET /api/templates/{id}
- POST /api/templates
- PUT /api/templates/{id}
- DELETE /api/templates/{id}

Messaging operations:
- POST /api/messages/send
  - Request: { templateId, patientIds: [], customContent?, channel?: 'whatsapp' }
  - Response: queued items count
- POST /api/messages/send-preview
  - returns rendered previews for each patient
- GET /api/messages?status=&queueId=&from=&to=&page=
- GET /api/messages/{id}

Failed tasks & retry UI:
- GET /api/tasks/failed
- POST /api/tasks/{taskId}/retry
- POST /api/tasks/retry (bulk)
- DELETE /api/tasks/{taskId}

### 4.6 Quota & Management

- GET /api/quotas (for admin)
- PUT /api/quotas/{moderatorId} (add messages or queues)

---

## 5. DTOs (selected)

AuthLoginRequest
```json
{ "username":"string", "password":"string" }
```

AuthLoginResponse
```json
{ "accessToken":"string", "expiresIn":3600, "user":{"id":1,"username":"admin","fullName":"...","role":"primary_admin"} }
```

QueueDto
```json
{ "id":1, "doctorName":"د. احمد", "patientCount":15, "currentPosition":3, "estimatedWaitMinutes":20 }
```

PatientDto
```json
{ "id": 123, "queueId": 1, "fullName":"أحمد محمد", "phoneNumber":"+9665...", "position":5, "status":"waiting" }
```

SendMessageRequest
```json
{ "templateId": 1, "patientIds": [123,124], "channel": "whatsapp", "overrideContent": null }
```

API error example
```json
{ "success": false, "errors": [{"code":"ValidationError","message":"Phone number required"}], "traceId":"..." }
```

---

## 6. OpenAPI / Swagger guidance (for .NET 8)

- Add `Swashbuckle.AspNetCore` and configure with OAuth2 and JWT bearer support.
- Use `AddMicrosoftIdentityWebApi` only if integrating with Azure AD. Otherwise use `JwtBearer` with proper validation.
- Annotate controllers with `[ApiController]` and `[Authorize(Roles = "moderator,secondary_admin,primary_admin")]` where applicable.
- Produce operation summary and examples for key endpoints.
- Generate client SDKs (OpenAPI generator) for Next.js if desired.

---

## 7. Background processing & message pipeline

Goals:
- Reliable message delivery with retries and backoff
- Rate limiting per provider and per moderator quotas
- Visibility for failed tasks and requeueing

Architecture options:

1) Hangfire + SQL Server storage
- Pros: simple to add scheduled and background jobs; integrates with ASP.NET Core; uses SQL Server for storage
- Cons: single point; limited multi-instance coordination unless using distributed lock

2) .NET Worker Service + Message Broker (recommended for scale)
- Flow: API enqueues `SendMessage` job into RabbitMQ/Azure Service Bus -> Worker consumes -> Worker sends via provider -> updates Messages table and Quotas -> on failure -> pushes to Dead Letter or FailedTasks table
- Pros: scalable, decoupled, robust
- Cons: more infra

Retry strategy:
- Immediate retries up to N times with exponential backoff
- After N attempts, mark as failed and create FailedTask record
- Provide manual retry UI that enqueues message again

Rate limiting & quotas:
- Maintain counters in Redis (sliding window) keyed per provider and per moderator (moderatorId)
- Before enqueueing, check moderator's consumed messages vs quota and decrement atomically on send success

Idempotency:
- Use idempotency key (message intended id or request hash) to avoid duplicate sends on retries

WhatsApp integration options:
- Official Meta Cloud API (WhatsApp Business Platform): production-grade; requires business verification; supports templates, media; use for scale
- Third-party providers: Twilio, 360dialog, Vonage — they wrap provider features and often easier to integrate
- Web automation (puppeteer / WA Web JS): fragile and not recommended for production

Provider webhook handling:
- Implement a webhook endpoint to receive delivery receipts and update `Messages` status and `ProviderMessageId`
- Secure webhooks with HMAC signature validation

Hangfire quick-start (recommended for small deployments)
--------------------------------------------------
If you prefer a simple, fast way to run background jobs without introducing a message broker, Hangfire is a pragmatic choice. It stores job state in SQL Server and integrates directly with ASP.NET Core.

Key steps to get started with Hangfire:

1. Add packages

```powershell
dotnet add src/Api package Hangfire.Core
dotnet add src/Api package Hangfire.AspNetCore
dotnet add src/Api package Hangfire.SqlServer
```

2. Configure Hangfire in `Program.cs`

```csharp
using Hangfire;
using Hangfire.SqlServer;

builder.Services.AddHangfire(config => config
  .UseSqlServerStorage(builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services.AddHangfireServer();

var app = builder.Build();
app.UseHangfireDashboard("/hangfire", new DashboardOptions { Authorization = new[]{ new MyHangfireAuthFilter() } });

// Enqueue a job example
BackgroundJob.Enqueue(() => Console.WriteLine("Hello from Hangfire job"));

// Recurring job example
RecurringJob.AddOrUpdate("process-messages", () => Console.WriteLine("Process queued messages"), Cron.Minutely);
```

3. Implement jobs

- Create an injectable service (e.g., `IMessageProcessor`) and call it from your jobs. Hangfire will resolve scoped services when executing.

4. Security & scaling notes

- Hangfire Dashboard should be protected (use app authentication). In production, restrict access to admins.
- Hangfire scales by running multiple worker processes connecting to the same SQL Server. For very large scale, consider a broker-based worker architecture instead.

When to use Hangfire
- Quick to add and great for MVPs and small production systems.
- Easier operationally because it relies only on SQL Server (no extra infrastructure).

When to prefer a broker
- If you need high throughput, complex routing, or multi-language workers, use RabbitMQ/Azure Service Bus + Worker Services.

---

## 8. Next.js frontend architecture (RTL/Arabic)

Structure (suggested):

/ (root)
- apps/
  - web/ (Next.js app)
    - app/ (or pages/ depending on Next.js version)
    - components/
      - ui/ (buttons, inputs)
      - layout/ (RTL header/sidebar)
      - queues/, patients/, messages/, management/
    - lib/ (api clients, auth)
    - hooks/ (useAuth, useQueues)
    - i18n/ (translation files)
    - styles/ (Tailwind config)

State & data fetching:
- Use TanStack Query (React Query) for caching server state, background refresh and optimistic updates.
- Use Axios for HTTP with an auth interceptor that injects tokens from cookie or uses a refresh flow.

Auth & token handling:
- Store refresh token in secure HttpOnly cookie set by backend; store access token in-memory (React context) to avoid XSS exposure.
- On 401, call /api/auth/refresh to rotate token.

RTL + Tailwind:
- Tailwind supports RTL via plugin or conditional direction attribute on <html dir="rtl">.
- Use a global Layout that sets dir="rtl" and includes proper <meta>.

Accessibility & i18n:
- Use semantic HTML and aria-* attributes.
- Use next-i18next or next-translate for translations.

UI flows to implement (based on prototype):
- Login screen
- Dashboard: queues list + quick stats
- Queue details: patients table, tabs (dashboard, ongoing, failed), action buttons
- Modals: add queue, add patients, upload file, message selection, preview
- Management screens: users, quotas, failed tasks

---

## 9. Dev environment & deployment

Local Docker Compose (recommended services):
- api (dotnet)
- web (nextjs)
- db (mcr.microsoft.com/mssql/server:2019-latest)
- redis (optional)
- rabbitmq (optional)

Sample `docker-compose.yml` (trimmed):

```yaml
version: '3.8'
services:
  sqlserver:
    image: mcr.microsoft.com/mssql/server:2019-latest
    environment:
      SA_PASSWORD: 'YourStrong!Passw0rd'
      ACCEPT_EULA: 'Y'
    ports:
      - '1433:1433'
    volumes:
      - sqlserverdata:/var/opt/mssql

  redis:
    image: redis:7
    ports:
      - '6379:6379'

  rabbitmq:
    image: rabbitmq:3-management
    ports:
      - '5672:5672'
      - '15672:15672'

  api:
    build: ./src/Api
    environment:
      - ConnectionStrings__Default=Server=sqlserver,1433;Database=ClinicsDb;User Id=sa;Password=YourStrong!Passw0rd;
      - ASPNETCORE_ENVIRONMENT=Development
    depends_on:
      - sqlserver
      - redis
      - rabbitmq
    ports:
      - '5000:80'

  web:
    build: ./apps/web
    environment:
      - NEXT_PUBLIC_API_BASE_URL=http://localhost:5000
    ports:
      - '3000:3000'
    depends_on:
      - api

volumes:
  sqlserverdata:
```

Run locally (PowerShell):

```powershell
# from project root
docker-compose up --build
```

CI/CD suggestions (GitHub Actions):
- Pipeline: lint -> build -> test -> build/push docker images -> deploy to staging -> deploy to prod
- Use multi-stage Dockerfiles
- Store secrets in GitHub Secrets or use Azure Key Vault in production

Hosting choices:
- Azure App Service + Azure SQL: easiest to get started. Use managed identity for DB access via Azure AD where possible.
- Azure Kubernetes Service (AKS): recommended for scale; use Azure SQL or Managed Instance; deploy workers as separate deployments.
- Consider container registry: ACR

Secrets & keys:
- Store provider keys (WhatsApp, Twilio) in Key Vault and inject at runtime.
- Use environment variables for non-sensitive config, don't commit secrets.

---

## 10. Testing, monitoring & observability

Testing:
- Backend unit tests: xUnit, Moq, FluentAssertions
- Integration tests: EF Core InMemory or Testcontainers with SQL Server
- E2E: Playwright (recommended) for UI flows (RTL checks)
- Contract tests: use OpenAPI-generated clients in integration tests

Monitoring & Logging:
- Structured logging with Serilog -> sink to Seq or Application Insights
- Instrumentation: OpenTelemetry for traces and metrics
- Metrics: Prometheus + Grafana for worker/queue metrics

Alerting:
- Alert on queue depth growth, failed tasks > threshold, worker crash loops
- Use built-in Azure Monitor or Prometheus Alertmanager

Tracing:
- Propagate correlation id across HTTP requests and background jobs
- Capture spans for send attempts and provider latency

---

## 11. Security & privacy

- Use TLS (HTTPS) for all endpoints
- Protect API using JWT with short-lived access tokens and refresh token rotation
- Store refresh token in secure, HttpOnly cookie to mitigate XSS
- CSRF: use SameSite cookies + anti-forgery tokens on form POSTs if using cookie auth
- Input validation and rate limiting
- Secure webhook endpoints
- PII handling: mask logs and restrict who can see phone numbers in UI

GDPR / Data retention:
- Allow retention policies for messages and audit logs (e.g., purge older than N months)

---

## 12. Implementation plan & milestones (MVP-first)

Assumptions: 2-week sprints, small team (2-3 devs). Priorities focus on delivering a usable MVP matching the prototype.

Sprint 0 (setup, 1 week)
- Scaffold solution: `src/Api`, `src/Workers`, `apps/web`
- Setup Docker Compose and Dev SQL
- Configure CI pipeline basic
- Implement EF Core project and baseline migrations
- Seed roles and sample admin

Sprint 1 (Auth, users, queues core, 2 weeks)
- Implement auth (login, refresh, logout)
- Users: me/profile endpoints
- Queues CRUD and list
- Basic Next.js login and queues list page
- Unit tests for auth and queue services

Sprint 2 (Patients & Messages MVP, 2 weeks)
- Patients CRUD, reordering, bulk add
- Message templates CRUD
- Send message flow (API -> enqueue -> worker processes) with simple simulated provider
- UI: queue details, patients table, single-message send, preview modal

Sprint 3 (Retries, failed tasks, quotas, 2 weeks)
- Failed tasks store + retry endpoints
- Quota enforcement and admin UI
- WhatsApp provider integration (sandbox) or mock provider
- Observability setup (Serilog + App Insights)

Sprint 4 (Harden, file upload, polish, 2 weeks)
- File upload parsing and validation
- Add pagination and search to UI
- Add RBAC for management screens
- E2E tests and load test basics

Post-MVP
- Integrate real WhatsApp Business API provider
- Scale workers with message broker
- Add analytics and advanced reporting

Estimates: each sprint assumes 2 devs; adjust based on resources.

Immediate next steps (what I can do for you now):
- Create project scaffolding for .NET 8 solution + Next.js app
- Generate EF Core models from the SQL schema and add initial migrations
- Implement auth endpoints and seed admin user
- Create a basic Next.js app that authenticates and lists queues using the API

Tell me which of the immediate next steps you want me to implement first; I can scaffold code and create files in your workspace (controllers, models, initial migrations, or the Next.js skeleton).

---

## Appendix: Useful implementation notes

- Use ASP.NET Core Minimal APIs or Controllers; Controllers + DTO-based design is recommended for large apps.
- Prefer EF Core 8 with code-first migrations; create indexes via migrations.
- For Hangfire: prefer Hangfire.Core and Hangfire.SqlServer for quick start.
- For Worker services + RabbitMQ: use MassTransit or Raw RabbitMQ client.
- For consuming provider webhooks: validate payer signatures and store provider message id consistently.

---

End of document.
