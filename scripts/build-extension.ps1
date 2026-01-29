# Build Extension Package Script
# Packages the Chrome extension into a .zip file for distribution

$ErrorActionPreference = "Stop"

# Paths
$extensionPath = "extension"
$outputPath = "src\Api\wwwroot\downloads"
$zipName = "clinics-whatsapp-extension.zip"
$tempDirBase = "temp-extension-build"

Write-Host "Building Clinics WhatsApp Extension Package..." -ForegroundColor Cyan

# Create output directory if it doesn't exist
if (-not (Test-Path $outputPath)) {
    New-Item -ItemType Directory -Force -Path $outputPath | Out-Null
    Write-Host "Created output directory: $outputPath" -ForegroundColor Green
}

# Remove old zip if exists
$zipPath = Join-Path $outputPath $zipName
if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
    Write-Host "Removed old package" -ForegroundColor Yellow
}

# Create temp directory structure
if (Test-Path $tempDirBase) {
    Remove-Item $tempDirBase -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $tempDirBase | Out-Null

# We want the zip to contain an 'extension' folder at the root
$tempExtensionDir = Join-Path $tempDirBase "extension"
New-Item -ItemType Directory -Force -Path $tempExtensionDir | Out-Null

Write-Host "Copying extension files..." -ForegroundColor Cyan

# Copy all files first (simplest way to preserve structure)
# Using resolved paths to ensure copy works correctly
$absSource = (Resolve-Path $extensionPath).Path
Copy-Item "$absSource\*" -Destination $tempExtensionDir -Recurse -Force

Write-Host "Cleaning excluded files..." -ForegroundColor Cyan

# Remove excluded items
$exclusions = @("node_modules", ".git", ".gitignore", "package-lock.json", "*.md", ".DS_Store", "Thumbs.db")

# Remove items matching exclusion list
foreach ($exc in $exclusions) {
    Get-ChildItem -Path $tempExtensionDir -Recurse -Include $exc | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
}

# Create zip archive
Write-Host "Creating zip archive..." -ForegroundColor Cyan
# Zip the 'extension' folder inside tempDirBase
Compress-Archive -Path $tempExtensionDir -DestinationPath $zipPath -CompressionLevel Optimal -Force

# Clean up temp directory
Remove-Item $tempDirBase -Recurse -Force

# Get file size
$fileSize = (Get-Item $zipPath).Length / 1KB
Write-Host "Package created: $zipName ($([math]::Round($fileSize, 2)) KB)" -ForegroundColor Green

Write-Host ""
Write-Host "Extension package built successfully!" -ForegroundColor Green
Write-Host "Location: $zipPath" -ForegroundColor Cyan
