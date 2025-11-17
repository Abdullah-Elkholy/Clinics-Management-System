# E2E Test Execution Script (PowerShell)
# This script automates the process of running E2E tests with proper setup

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "E2E Test Execution Script" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if backend API is running
Write-Host "Checking if backend API is running..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/api/health" -Method Get -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✓ Backend API is running" -ForegroundColor Green
} catch {
    Write-Host "✗ Backend API is not running on http://localhost:5000" -ForegroundColor Red
    Write-Host "Please start the backend API before running E2E tests" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "To start the backend:" -ForegroundColor Yellow
    Write-Host "  cd ../.." -ForegroundColor White
    Write-Host "  dotnet run --project ClinicsManagementService" -ForegroundColor White
    exit 1
}

# Check if frontend is already running
Write-Host ""
Write-Host "Checking if frontend is already running..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000" -Method Get -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✓ Frontend is already running" -ForegroundColor Green
    $FRONTEND_RUNNING = $true
} catch {
    Write-Host "Frontend is not running, Playwright will start it automatically" -ForegroundColor Yellow
    $FRONTEND_RUNNING = $false
}

# Run tests
Write-Host ""
Write-Host "Running E2E tests..." -ForegroundColor Yellow
Write-Host ""

# Check for command line arguments
if ($args[0] -eq "--headed") {
    Write-Host "Running in headed mode (visible browser)" -ForegroundColor Cyan
    npm run test:e2e:headed
} elseif ($args[0] -eq "--debug") {
    Write-Host "Running in debug mode" -ForegroundColor Cyan
    npm run test:e2e:debug
} elseif ($args[0] -eq "--report") {
    Write-Host "Opening test report" -ForegroundColor Cyan
    npm run test:e2e:report
} else {
    Write-Host "Running in headless mode" -ForegroundColor Cyan
    npm run test:e2e
}

$EXIT_CODE = $LASTEXITCODE

Write-Host ""
if ($EXIT_CODE -eq 0) {
    Write-Host "==========================================" -ForegroundColor Green
    Write-Host "✓ All E2E tests passed!" -ForegroundColor Green
    Write-Host "==========================================" -ForegroundColor Green
} else {
    Write-Host "==========================================" -ForegroundColor Red
    Write-Host "✗ Some E2E tests failed" -ForegroundColor Red
    Write-Host "==========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "To view the test report:" -ForegroundColor Yellow
    Write-Host "  npm run test:e2e:report" -ForegroundColor White
}

exit $EXIT_CODE

