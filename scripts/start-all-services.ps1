# Start All Services Script
# Starts Backend API, Frontend, and optionally WhatsApp Service

param(
    [switch]$IncludeWhatsApp = $false
)

$ErrorActionPreference = "Continue"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Starting All Services" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Function to check if a port is in use
function Test-Port {
    param([int]$Port)
    $connection = Test-NetConnection -ComputerName localhost -Port $Port -WarningAction SilentlyContinue -InformationLevel Quiet
    return $connection
}

# Check if Backend API is already running
Write-Host "Checking Backend API (port 5000)..." -ForegroundColor Yellow
if (Test-Port -Port 5000) {
    Write-Host "✓ Backend API is already running on port 5000" -ForegroundColor Green
} else {
    Write-Host "Starting Backend API..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "cd '$PSScriptRoot\..\src\Api'; `$env:USE_LOCAL_SQL='true'; `$env:SEED_ADMIN='true'; `$env:ASPNETCORE_ENVIRONMENT='Development'; `$env:ASPNETCORE_URLS='http://localhost:5000'; dotnet run"
    ) -WindowStyle Normal
    Write-Host "Backend API starting in new window..." -ForegroundColor Cyan
    Start-Sleep -Seconds 5
    
    # Wait for backend to be ready
    $maxAttempts = 30
    $attempt = 0
    while ($attempt -lt $maxAttempts) {
        if (Test-Port -Port 5000) {
            Write-Host "✓ Backend API is ready on http://localhost:5000" -ForegroundColor Green
            break
        }
        $attempt++
        Write-Host "Waiting for Backend API... ($attempt/$maxAttempts)" -ForegroundColor Yellow
        Start-Sleep -Seconds 2
    }
    
    if ($attempt -eq $maxAttempts) {
        Write-Host "⚠ Backend API did not start within timeout" -ForegroundColor Red
    }
}

Write-Host ""

# Check if Frontend is already running
Write-Host "Checking Frontend (port 3000)..." -ForegroundColor Yellow
if (Test-Port -Port 3000) {
    Write-Host "✓ Frontend is already running on port 3000" -ForegroundColor Green
} else {
    Write-Host "Starting Frontend..." -ForegroundColor Yellow
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "cd '$PSScriptRoot\..\apps\web'; npm run dev"
    ) -WindowStyle Normal
    Write-Host "Frontend starting in new window..." -ForegroundColor Cyan
    Start-Sleep -Seconds 3
    
    # Wait for frontend to be ready
    $maxAttempts = 20
    $attempt = 0
    while ($attempt -lt $maxAttempts) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost:3000" -Method Get -TimeoutSec 2 -ErrorAction Stop
            Write-Host "✓ Frontend is ready on http://localhost:3000" -ForegroundColor Green
            break
        } catch {
            $attempt++
            Write-Host "Waiting for Frontend... ($attempt/$maxAttempts)" -ForegroundColor Yellow
            Start-Sleep -Seconds 2
        }
    }
    
    if ($attempt -eq $maxAttempts) {
        Write-Host "⚠ Frontend did not start within timeout" -ForegroundColor Red
    }
}

Write-Host ""

# Optionally start WhatsApp Service
if ($IncludeWhatsApp) {
    Write-Host "Checking WhatsApp Service (port 5185)..." -ForegroundColor Yellow
    if (Test-Port -Port 5185) {
        Write-Host "✓ WhatsApp Service is already running on port 5185" -ForegroundColor Green
    } else {
        Write-Host "Starting WhatsApp Service..." -ForegroundColor Yellow
        Start-Process powershell -ArgumentList @(
            "-NoExit",
            "-Command",
            "cd '$PSScriptRoot\..\ClinicsManagementService'; `$env:ASPNETCORE_ENVIRONMENT='Development'; `$env:ASPNETCORE_URLS='http://localhost:5185'; dotnet run --project WhatsAppMessagingService"
        ) -WindowStyle Normal
        Write-Host "WhatsApp Service starting in new window..." -ForegroundColor Cyan
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Services Status:" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Backend API:  http://localhost:5000" -ForegroundColor $(if (Test-Port -Port 5000) { "Green" } else { "Red" })
Write-Host "Frontend:     http://localhost:3000" -ForegroundColor $(if (Test-Port -Port 3000) { "Green" } else { "Red" })
if ($IncludeWhatsApp) {
    Write-Host "WhatsApp:     http://localhost:5185" -ForegroundColor $(if (Test-Port -Port 5185) { "Green" } else { "Red" })
}
Write-Host ""
Write-Host "Test Credentials:" -ForegroundColor Cyan
Write-Host "  Admin:      admin / admin123" -ForegroundColor White
Write-Host "  Admin2:     admin2 / admin123" -ForegroundColor White
Write-Host "  Moderator:  mod1 / mod123" -ForegroundColor White
Write-Host "  User:       user1 / user123" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow

