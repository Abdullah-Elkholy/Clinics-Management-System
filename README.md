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
     ```bash
     dotnet --version
     ```

2. **Node.js (LTS version recommended)**  
   - Required for Playwright installation.  
   - [Download here](https://nodejs.org/)  
   - Verify installation:  
     ```bash
     node -v
     npm -v
     ```

3. **Playwright** (must be installed after restoring dependencies)  
   - Install Playwright and its browser binaries:  
     ```bash
     dotnet tool install --global Microsoft.Playwright.CLI
     playwright install
     ```
   - Or if Playwright is referenced via NuGet, run:  
     ```bash
     dotnet build
     pwsh bin/Debug/net8.0/playwright.ps1 install
     ```

4. **Git** (to clone the repo)  
   - [Download here](https://git-scm.com/downloads)  

---

## ⚙️ Setup & Run

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/ClinicsManagementSln.git
   cd ClinicsManagementSln/ClinicsManagementService
