# WhatsApp Messaging Automated System

A **.NET 8.0 Web API** for automating WhatsApp message delivery using [Playwright](https://playwright.dev/). It exposes endpoints for sending single or bulk messages, manages WhatsApp sessions, and provides robust error handling and status reporting.

---

## 🚀 Features

- Send WhatsApp messages via REST API.
- Bulk and single message support.
- Automated browser session management (QR code login, session persistence).
- Playwright-based browser automation.
- Robust error handling and retry logic.
- Screenshot capture for debugging (QR code, timeouts, UI issues).
- Dependency Injection for services and logging.
- API documentation via Swagger/OpenAPI.

---

## 📦 Prerequisites

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

---

## ⚙️ Setup & Run

1. **Clone the repository**
   ```sh
   git clone https://github.com/Abdullah-Elkholy/ClinicsManagementSln.git
   cd ClinicsManagementSln/ClinicsManagementService
   ```

2. **Restore dependencies**
   ```sh
   dotnet restore
   ```

3. **Build the project**
   ```sh
   dotnet build
   ```

4. **Install Playwright browsers**
   ```sh
   playwright install
   # or
   pwsh bin/Debug/net8.0/playwright.ps1 install
   ```

5. **Configure appsettings.json**  
   Edit `appsettings.json` for logging and allowed hosts.

6. **Run the Web API**
   ```sh
   dotnet run
   ```

7. **Test the API**  
   Use Swagger UI (`/swagger`), Postman, Insomnia, or `curl`.

---

## 📚 API Endpoints

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

**Bulk Messaging**
```sh
curl -X POST "http://localhost:5185/BulkMessaging/send-bulk?minDelayMs=1000&maxDelayMs=3000" \
  -H "Content-Type: application/json" \
  -d '{"Items":[{"Phone":"+1234567890","Message":"Hello"},{"Phone":"+1987654321","Message":"Hi"}]}'
```

---

## 🛠 Troubleshooting

- If Playwright browsers are not installed, rerun the install command.
- Ensure WhatsApp session is valid (scan QR code if prompted).
- Screenshots for debugging are saved in `Screenshots/`.
- Check console output for error details.
- Make sure required ports are open.

---

## 🤝 Contributing

Pull requests are welcome! For major changes, open an issue first to discuss.

---

## 📁 Project Structure

- `Controllers/` — API endpoints ([BulkMessagingController](Controllers/BulkMessagingController.cs), [MessageController](Controllers/MessageController.cs))
- `Models/` — Data models ([PhoneMessageDto](Models/PhoneMessageDto.cs), [BulkPhoneMessageRequest](Models/BulkPhoneMessageDto.cs), [MessageSendResult](Models/MessageSendResult.cs))
- `Services/` — Core logic ([WhatsAppService](Services/WhatsAppService.cs), [PlaywrightBrowserSession](Services/PlaywrightBrowserSession.cs), [ConsoleNotifier](Services/Infrastructure/ConsoleNotifier.cs))
- `Screenshots/` — Debugging images
- `whatsapp-session/` — Persistent browser session data
