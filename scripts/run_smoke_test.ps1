<# Safe, single-file PowerShell 5.1 smoke test script
     - DryRun by default; pass -Execute to perform actions.
     - Applies EF Core migrations (Infrastructure project), starts the API (src/Api), waits for readiness,
         logs in as admin, performs an admin GET, refreshes the session, then stops the API process.

Usage:
    Dry run (validate parsing):
        powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run_smoke_test.ps1

    Execute the smoke test:
        powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run_smoke_test.ps1 -Execute -LocalSqlServer "Server=BODYELKHOLY\SQL2022;Database=ClinicsDb;User Id=sa;Password=123456;TrustServerCertificate=True;"
#>

<# Safe, single-file PowerShell 5.1 smoke test script
     - DryRun by default; pass -Execute to perform actions.
     - Applies EF Core migrations (Infrastructure project), starts the API (src/Api), waits for readiness,
         logs in as admin, performs an admin GET, refreshes the session, then stops the API process.

Usage:
    Dry run (validate parsing):
        powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run_smoke_test.ps1

    Execute the smoke test:
        powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run_smoke_test.ps1 -Execute -LocalSqlServer "Server=BODYELKHOLY\SQL2022;Database=ClinicsDb;User Id=sa;Password=123456;TrustServerCertificate=True;"
#>

param(
    [switch]$Execute,
    [string]$BaseUrl = 'http://localhost:5000',
    [string]$LocalSqlServer = 'Server=BODYELKHOLY\SQL2022;Database=ClinicsDb;User Id=sa;Password=123456;TrustServerCertificate=True;',
    [string]$AdminUser = 'admin',
    [string]$AdminPass = 'Admin123!'
)

function Write-Log { param($m) Write-Host "[smoke] $m" }

Write-Log "Mode: $(if ($Execute) { 'Execute' } else { 'DryRun' })"
Write-Log "BaseUrl: $BaseUrl"
Write-Log "LocalSqlServer: $LocalSqlServer"

if (-not $Execute) { Write-Log "DryRun: no actions will be performed. Re-run with -Execute to perform the smoke test."; exit 0 }

# Export env vars used by API
Write-Log "Exporting environment variables for API process"
$env:USE_LOCAL_SQL = 'true'
$env:LocalSqlServer = $LocalSqlServer
$env:SEED_ADMIN = 'true'
$env:ASPNETCORE_URLS = $BaseUrl
# Ensure environment is Development so cookies set during login are not marked Secure (useful for local HTTP testing)
$env:ASPNETCORE_ENVIRONMENT = 'Development'

$repo = Resolve-Path (Join-Path $PSScriptRoot '..')
$proj = Join-Path $repo 'src\Api\Clinics.Api.csproj'
if (!(Test-Path $proj)) { Write-Error "Missing project: $proj"; exit 3 }

# Prepare logs
$logDir = Join-Path $repo 'logs'; if (!(Test-Path $logDir)) { New-Item -ItemType Directory -Path $logDir | Out-Null }
$out = Join-Path $logDir 'api_out.log'; $err = Join-Path $logDir 'api_err.log'

Write-Log "Applying EF migrations (Infrastructure project)"
Push-Location $repo
try { dotnet ef database update --project src/Infrastructure --startup-project src/Api } catch { Write-Log "ef failed: $_"; Pop-Location; exit 4 }
Pop-Location

Write-Log "Starting API (logs: $out, $err)"
$quoted = '"' + $proj + '"'
$cmd = 'dotnet run --project ' + $quoted + ' 1>' + '"' + $out + '"' + ' 2>' + '"' + $err + '"'
$proc = Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', $cmd -PassThru
Start-Sleep -Milliseconds 500

# Wait for readiness
$ready = $false; $t = 60
    # Wait for readiness: prefer health endpoint, fall back to swagger
    $ready = $false
    $timeoutSeconds = 60
    $healthUrl = "$BaseUrl/api/health"
    $swaggerUrl = "$BaseUrl/swagger/index.html"
    for ($i = 0; $i -lt $timeoutSeconds; $i++) {
        Start-Sleep -Seconds 1
        try {
            # Try health endpoint (GET)
            $resp = Invoke-WebRequest -Uri $healthUrl -Method Get -TimeoutSec 2 -ErrorAction Stop
            if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 400) { $ready = $true; break }
        } catch {
            # If health not present or not ready, try swagger (HEAD)
            try {
                $r = Invoke-WebRequest -Uri $swaggerUrl -Method Head -TimeoutSec 2 -ErrorAction Stop
                if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 400) { $ready = $true; break }
            } catch { }
        }
    }
if (-not $ready) { Write-Log "API not ready"; if (Test-Path $out) { Write-Host "--- STDOUT ---"; Get-Content $out -Tail 200 }; if (Test-Path $err) { Write-Host "--- STDERR ---"; Get-Content $err -Tail 200 }; if ($proc -and $proc.Id) { Stop-Process -Id $proc.Id -Force }; exit 5 }

Write-Log "Login as $AdminUser"
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
try { $lr = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post -ContentType 'application/json' -Body (@{ username=$AdminUser; password=$AdminPass } | ConvertTo-Json) -WebSession $session -ErrorAction Stop } catch { Write-Log "login failed: $_"; if ($proc -and $proc.Id) { Stop-Process -Id $proc.Id -Force }; exit 6 }
if (-not $lr -or -not $lr.data -or -not $lr.data.AccessToken) { Write-Log "login missing token"; if ($proc -and $proc.Id) { Stop-Process -Id $proc.Id -Force }; exit 7 }
$token = $lr.data.AccessToken

# Debug: list cookies captured in the WebRequestSession (helps verify refresh cookie present)
try {
    $cookieList = $session.Cookies.GetCookies([Uri]$BaseUrl)
    foreach ($c in $cookieList) { Write-Log "Cookie: $($c.Name) = $($c.Value); Path=$($c.Path); HttpOnly=$($c.HttpOnly); Secure=$($c.Secure)" }
} catch { Write-Log "Could not enumerate cookies: $_" }

Write-Log "Admin GET /api/users"
try { $u = Invoke-RestMethod -Uri "$BaseUrl/api/users" -Headers @{ Authorization = "Bearer $token" } -Method Get -ErrorAction Stop; Write-Log "admin GET ok" } catch { Write-Log "admin GET failed: $_"; if ($proc -and $proc.Id) { Stop-Process -Id $proc.Id -Force }; exit 8 }

Write-Log "Refresh token"
try {
    $rr = Invoke-RestMethod -Uri "$BaseUrl/api/auth/refresh" -Method Post -WebSession $session -ErrorAction Stop
    Write-Log "refresh ok"
} catch {
    # Try to extract response body for debugging
    $bodyText = "(no body)"
    try {
        if ($_.Exception -and $_.Exception.Response) {
            $stream = $_.Exception.Response.GetResponseStream()
            $sr = New-Object System.IO.StreamReader($stream)
            $bodyText = $sr.ReadToEnd()
        }
    } catch { }
    Write-Log "refresh failed: $($_)"
    Write-Log "refresh failure body: $bodyText"
    if ($proc -and $proc.Id) { Stop-Process -Id $proc.Id -Force }
    exit 9
}

Write-Log "Success; stopping API"
if ($proc -and $proc.Id) { Stop-Process -Id $proc.Id -Force }
Write-Log "Done"; exit 0
$timeout = 120
$ready = $false
for ($i=0; $i -lt $timeout; $i++) {
    Start-Sleep -Seconds 1
    try {
        $resp = Invoke-WebRequest -Uri "$BaseUrl/swagger/index.html" -Method Head -TimeoutSec 3 -ErrorAction Stop
        if ($resp.StatusCode -ge 200 -and $resp.StatusCode -lt 400) { $ready = $true; break }
    } catch { }
}

if (-not $ready) {
    Write-Log "API did not become ready within $timeout seconds. Dumping logs"
    if (Test-Path $outLog) { Write-Host "--- STDOUT (tail 200) ---"; Get-Content $outLog -Tail 200 }
    if (Test-Path $errLog) { Write-Host "--- STDERR (tail 200) ---"; Get-Content $errLog -Tail 200 }
    if ($proc -and $proc.Id) { Stop-Process -Id $proc.Id -Force }
    exit 4
}

Write-Log "API ready. Performing login -> refresh -> admin GET"

# Use WebRequestSession to preserve cookies
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

try {
    $loginResp = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post -ContentType 'application/json' -Body (@{ username = $AdminUser; password = $AdminPass } | ConvertTo-Json) -WebSession $session -ErrorAction Stop
} catch {
    Write-Log "Login failed: $_"
    if ($proc -and $proc.Id) { Stop-Process -Id $proc.Id -Force }
    exit 5
}

if (-not $loginResp -or -not $loginResp.data -or -not $loginResp.data.AccessToken) {
    Write-Log "Login response missing access token: $($loginResp | ConvertTo-Json -Depth 3)"
    if ($proc -and $proc.Id) { Stop-Process -Id $proc.Id -Force }
    exit 6
}

$access = $loginResp.data.AccessToken
Write-Log "Login OK (access token length: $($access.Length))"

try {
    $users = Invoke-RestMethod -Uri "$BaseUrl/api/users" -Headers @{ Authorization = "Bearer $access" } -Method Get -ErrorAction Stop
    Write-Log "Admin GET /api/users succeeded"
} catch {
    Write-Log "Admin GET failed: $_"
    if ($proc -and $proc.Id) { Stop-Process -Id $proc.Id -Force }
    exit 7
}

try {
    $refreshResp = Invoke-RestMethod -Uri "$BaseUrl/api/auth/refresh" -Method Post -WebSession $session -ErrorAction Stop
    Write-Log "Refresh succeeded"
} catch {
    Write-Log "Refresh failed: $_"
    if ($proc -and $proc.Id) { Stop-Process -Id $proc.Id -Force }
    exit 8
}

Write-Log "Smoke test PASSED. Stopping API process."
if ($proc -and $proc.Id) { Stop-Process -Id $proc.Id -Force }
Write-Log "Done."
exit 0
$projectPath = Join-Path $PSScriptRoot '..\src\Api\Clinics.Api.csproj'
