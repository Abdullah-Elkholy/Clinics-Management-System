# WhatsApp Messaging Automated System

This project is a **.NET 8.0 Web API** that automates sending WhatsApp messages using [Playwright](https://playwright.dev/).
It exposes an API endpoint where you can provide a phone number and message content.
The system validates numbers, attempts delivery, and reports whether the message was sent successfully.

---

## 🚀 Features
- Send automated WhatsApp messages programmatically via API.
- Built on **.NET 8.0 API Framework** with **C#**.
- Automation handled using **Playwright**.
- Detects and handles invalid phone numbers.
- Confirms delivery status (sent successfully or not).

---

## 📦 Prerequisites

Before running this project, ensure you have the following installed:

1. **.NET 8.0 SDK**
   - [Download here](https://dotnet.microsoft.com/en-us/download/dotnet/8.0)
   - Verify installation:
     ```powershell
     dotnet --version
     ```

2. **Node.js (LTS version recommended)**
   - Required for Playwright installation.
   - [Download here](https://nodejs.org/)
   - Verify installation:
     ```powershell
     node -v
     npm -v
     ```

3. **Playwright** (must be installed after restoring dependencies)
   - Install Playwright and its browser binaries:
     ```powershell
     dotnet tool install --global Microsoft.Playwright.CLI
     playwright install
     ```
   - Or if Playwright is referenced via NuGet, run:
     ```powershell
     dotnet build
     pwsh bin/Debug/net8.0/playwright.ps1 install
     ```

4. **Git** (to clone the repo)
   - [Download here](https://git-scm.com/downloads)

---

## ⚙️ Setup & Run

After cloning the repository, follow these steps:

1. **Restore .NET dependencies**
   ```powershell
   dotnet restore
   ```

2. **Build the project**
   ```powershell
   dotnet build
   ```

3. **Install Playwright browsers**
   If you installed Playwright as a .NET tool:
   ```powershell
   playwright install
   ```
   If Playwright is referenced via NuGet:
   ```powershell
   pwsh bin/Debug/net8.0/playwright.ps1 install
   ```

4. **Update appsettings.json**
   - Configure any required settings in `appsettings.json` or `appsettings.Development.json`.

5. **Run the Web API**
   ```powershell
   dotnet run
   ```

6. **Test the API**
   - Use [Postman](https://www.postman.com/), [Insomnia](https://insomnia.rest/), or `curl` to send requests to the API endpoint.
   - Example request:
     ```powershell
     curl -X POST "http://localhost:5000/api/message/send" -H "Content-Type: application/json" -d '{"phoneNumber": "+1234567890", "message": "Hello from API!"}'
     ```
   - The API will respond with JSON indicating success or failure.

---

## 📚 API Endpoints

| Method | Endpoint                | Description                                 |
|--------|-------------------------|---------------------------------------------|
| POST   | `/BulkMessaging/send`   | Send multiple messages to a phone number    |
| POST   | `/Messaging/send`       | Send a single message to a phone number     |

---

### Example Requests

**Bulk Messaging**
```powershell
curl -X POST "http://localhost:5000/BulkMessaging/send" -H "Content-Type: application/json" -d '{"Phone": "+1234567890", "Messages": ["Hello", "How are you?"]}'
```

**Single Message**
```powershell
curl -X POST "http://localhost:5000/Messaging/send?phone=+1234567890&message=Hello%20from%20API!"
```

---

## 🛠 Troubleshooting

- If Playwright browsers are not installed, rerun the install command.
- Ensure your WhatsApp session is valid and not expired.
- Check logs for error details in the console output.
- Make sure ports are not blocked by firewall or other apps.

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you would like to change.
