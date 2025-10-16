# WhatsApp Messaging Automated System

A **.NET 8.0 Web API** for automating WhatsApp message delivery using [Playwright](https://playwright.dev/). This project follows **SOLID principles**, **Clean Architecture**, and **OOP best practices** to provide a robust, maintainable, and scalable solution for WhatsApp automation.

---

## 🏗️ Architecture Overview

This project implements **Clean Architecture** with clear separation of concerns:

- **Controllers** - API endpoints and request handling
- **Application Services** - Business logic orchestration
- **Domain Services** - Core business logic and rules
- **Infrastructure** - External dependencies (Playwright, browser sessions)
- **Models** - Data transfer objects and domain models
- **Configuration** - Centralized configuration and constants

### SOLID Principles Implementation

- **Single Responsibility Principle (SRP)**: Each service has a single, well-defined responsibility
- **Open/Closed Principle (OCP)**: Services are open for extension but closed for modification
- **Liskov Substitution Principle (LSP)**: Interfaces allow for proper substitution of implementations
- **Interface Segregation Principle (ISP)**: Small, focused interfaces for specific functionality
- **Dependency Inversion Principle (DIP)**: High-level modules depend on abstractions, not concretions

---

## 🚀 Features

- **RESTful API** for WhatsApp message automation
- **Single and Bulk messaging** with intelligent throttling
- **Robust error handling** with retry mechanisms
- **Session management** with QR code authentication
- **Screenshot capture** for debugging and monitoring
- **Input validation** with comprehensive business rules
- **Dependency Injection** for testability and maintainability
- **Clean Architecture** following SOLID principles
- **Comprehensive logging** and notification system
- **API documentation** via Swagger/OpenAPI

---

## 📦 Prerequisites

1. **.NET 8.0 SDK**  
   [Download](https://dotnet.microsoft.com/en-us/download/dotnet/8.0)
   ```sh
   dotnet --version
   ```
1. **.NET 8.0 SDK**  
   [Download](https://dotnet.microsoft.com/en-us/download/dotnet/8.0)
   ```sh
   dotnet --version
   ```

2. **Node.js** (required for Playwright)  
   [Download](https://nodejs.org/)
   ```sh
   node -v
   npm -v
   ```
2. **Node.js** (required for Playwright)  
   [Download](https://nodejs.org/)
   ```sh
   node -v
   npm -v
   ```

3. **Playwright**  
   Install Playwright and browsers:
   ```sh
   dotnet tool install --global Microsoft.Playwright.CLI
   playwright install
   ```
   Or, if using NuGet:
   ```sh
   dotnet build
   pwsh bin/Debug/net8.0/playwright.ps1 install
   ```
3. **Playwright**  
   Install Playwright and browsers:
   ```sh
   dotnet tool install --global Microsoft.Playwright.CLI
   playwright install
   ```
   Or, if using NuGet:
   ```sh
   dotnet build
   pwsh bin/Debug/net8.0/playwright.ps1 install
   ```

4. **Git**  
   [Download](https://git-scm.com/downloads)
4. **Git**  
   [Download](https://git-scm.com/downloads)

---

## ⚙️ Setup & Run

1. **Clone the repository**
   ```sh
   git clone https://github.com/Abdullah-Elkholy/ClinicsManagementSln.git
   cd ClinicsManagementSln/ClinicsManagementService
   ```
   ```

2. **Restore dependencies**
   ```sh
2. **Restore dependencies**
   ```sh
   dotnet restore
   ```

3. **Build the project**
   ```sh
   ```sh
   dotnet build
   ```

4. **Install Playwright browsers**
   ```sh
   ```sh
   playwright install
   # or
   # or
   pwsh bin/Debug/net8.0/playwright.ps1 install
   ```

5. **Configure appsettings.json**  
   Edit `appsettings.json` for logging and allowed hosts.
5. **Configure appsettings.json**  
   Edit `appsettings.json` for logging and allowed hosts.

6. **Run the Web API**
   ```sh
   ```sh
   dotnet run
   ```

7. **Test the API**  
   Use Swagger UI (`/swagger`), Postman, Insomnia, or `curl`.
7. **Test the API**  
   Use Swagger UI (`/swagger`), Postman, Insomnia, or `curl`.

---

## 📚 API Endpoints

| Method | Endpoint                          | Description                                 |
|--------|-----------------------------------|---------------------------------------------|
| POST   | `/Messaging/send`                 | Send a single message (query params)        |
| POST   | `/BulkMessaging/send-single`      | Send a single message (JSON body)           |
| POST   | `/BulkMessaging/send-bulk`        | Send bulk messages (JSON body, throttling)  |
| Method | Endpoint                          | Description                                 |
|--------|-----------------------------------|---------------------------------------------|
| POST   | `/Messaging/send`                 | Send a single message (query params)        |
| POST   | `/BulkMessaging/send-single`      | Send a single message (JSON body)           |
| POST   | `/BulkMessaging/send-bulk`        | Send bulk messages (JSON body, throttling)  |

### Example Requests

**Single Message (Query)**
```sh
curl -X POST "http://localhost:5185/Messaging/send?phone=+1234567890&message=Hello%20from%20API!"
```

**Single Message (Body)**
```sh
curl -X POST "http://localhost:5185/BulkMessaging/send-single" \
  -H "Content-Type: application/json" \
  -d '{"Phone": "+1234567890", "Message": "Hello"}'
```

**Single Message (Query)**
```sh
curl -X POST "http://localhost:5185/Messaging/send?phone=+1234567890&message=Hello%20from%20API!"
```

**Single Message (Body)**
```sh
curl -X POST "http://localhost:5185/BulkMessaging/send-single" \
  -H "Content-Type: application/json" \
  -d '{"Phone": "+1234567890", "Message": "Hello"}'
```

**Bulk Messaging**
```sh
curl -X POST "http://localhost:5185/BulkMessaging/send-bulk?minDelayMs=1000&maxDelayMs=3000" \
  -H "Content-Type: application/json" \
  -d '{"Items":[{"Phone":"+1234567890","Message":"Hello"},{"Phone":"+1987654321","Message":"Hi"}]}'
```

---

## 🏛️ Project Structure

```
ClinicsManagementService/
├── Configuration/           # Centralized configuration
│   └── WhatsAppConfiguration.cs
├── Controllers/             # API controllers
│   ├── BulkMessagingController.cs
│   └── MessageController.cs
├── Models/                 # Data models and DTOs
│   ├── PhoneMessageDto.cs
│   ├── BulkPhoneMessageDto.cs
│   ├── MessageSendResult.cs
│   ├── WhatsAppModels.cs
│   └── MessageStatus.cs
├── Services/              # Service layer
│   ├── Application/       # Application services
│   │   └── WhatsAppMessageSender.cs
│   ├── Domain/           # Domain services (SOLID)
│   │   ├── IWhatsAppDomainServices.cs
│   │   ├── NetworkService.cs
│   │   ├── ScreenshotService.cs
│   │   ├── RetryService.cs
│   │   ├── WhatsAppAuthenticationService.cs
│   │   ├── WhatsAppUIService.cs
│   │   └── ValidationService.cs
│   ├── Infrastructure/    # Infrastructure services
│   │   ├── ConsoleNotifier.cs
│   │   ├── PlaywrightBrowserSession.cs
│   │   └── WhatsAppService.cs
│   └── Interfaces/       # Service interfaces
│       ├── IBrowserSession.cs
│       ├── IMessageSender.cs
│       ├── INotifier.cs
│       └── IWhatsAppService.cs
├── Screenshots/          # Debugging images
├── whatsapp-session/     # Persistent browser session data
└── Program.cs           # Application entry point
```

---

## 🔧 Key Components

### Domain Services (SOLID Implementation)

- **`NetworkService`** - Handles internet connectivity checks
- **`ScreenshotService`** - Manages screenshot capture for debugging
- **`RetryService`** - Implements retry logic with exponential backoff
- **`WhatsAppAuthenticationService`** - Manages QR code authentication
- **`WhatsAppUIService`** - Handles UI interactions and element detection
- **`ValidationService`** - Input validation and business rules

### Application Services

- **`WhatsAppMessageSender`** - Orchestrates message sending operations
- **`WhatsAppService`** - Main service coordinating domain services

### Infrastructure Services

- **`PlaywrightBrowserSession`** - Browser automation wrapper
- **`ConsoleNotifier`** - Logging and notification system

---

## 🛠 Troubleshooting

- **Playwright browsers not installed**: Rerun `playwright install`
- **WhatsApp session expired**: Scan QR code when prompted
- **Screenshots for debugging**: Check `Screenshots/` directory
- **Console output**: Monitor for detailed error information
- **Port conflicts**: Ensure required ports are available
- **Network issues**: Check internet connectivity and WhatsApp Web availability

---

## 🧪 Testing

The refactored architecture makes the system highly testable:

- **Unit Tests**: Each domain service can be tested in isolation
- **Integration Tests**: Test service interactions
- **Mocking**: Easy to mock dependencies using interfaces
- **Dependency Injection**: Supports test-specific configurations

---

## 🔄 Refactoring Benefits

### Before Refactoring
- ❌ Monolithic `WhatsAppService` (696 lines)
- ❌ Mixed responsibilities
- ❌ Hard-coded values
- ❌ Complex nested logic
- ❌ Difficult to test and maintain

### After Refactoring
- ✅ **Single Responsibility**: Each service has one clear purpose
- ✅ **Dependency Injection**: Easy to test and extend
- ✅ **Configuration Management**: Centralized constants
- ✅ **Clean Code**: Readable, maintainable methods
- ✅ **Error Handling**: Consistent patterns
- ✅ **Validation**: Comprehensive input validation
- ✅ **Testability**: Highly testable architecture

---

## 🤝 Contributing

Pull requests are welcome! For major changes, open an issue first to discuss.

### Development Guidelines
- Follow SOLID principles
- Write unit tests for new features
- Use dependency injection
- Maintain clean architecture
- Document public APIs

---

## 📄 License

This project is licensed under the MIT License.

---

## 🏆 Acknowledgments

- [Playwright](https://playwright.dev/) for browser automation
- [.NET 8.0](https://dotnet.microsoft.com/) for the robust framework
- Clean Architecture principles for maintainable code

---

## Running the full stack locally (quick)

This repository contains three main runnable parts:

- Backend API: `src/Api` (runs on http://localhost:5000)
- WhatsApp service: `ClinicsManagementService` (runs on http://localhost:5100)
- Frontend: `apps/web` (Next.js, runs on http://localhost:3000)

Recommended quick start (PowerShell):

```powershell
# from repository root
dotnet build src/Api/Clinics.Api.csproj -c Debug
dotnet build ClinicsManagementService/WhatsAppMessagingService.csproj -c Debug
# start frontend in its own terminal
cd apps/web; npm install; npm run dev

# then run the backend and whatsapp service (separate terminals)
dotnet run --project src/Api/Clinics.Api.csproj
dotnet run --project ClinicsManagementService/WhatsAppMessagingService.csproj
```

Environment variables / secrets

- Copy `.env.local.example` to `.env.local` and set `LOCAL_SQL_CONN` (or set the environment variable in your shell). The VS Code launch configurations reference `${env:LOCAL_SQL_CONN}` for the DB connection string.
- Alternatively, use `dotnet user-secrets` for secure per-developer secrets.

See `apps/web/README.md` for frontend-specific instructions.
