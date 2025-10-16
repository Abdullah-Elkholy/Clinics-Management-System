# Simple helper script — no parameters (edit values below if needed)
$BaseUrl = 'http://localhost:5000'
$AdminUser = 'admin'
$AdminPass = 'DevAdmin!23'

Function Wait-ForHealth {
    param($url, $timeoutSeconds)
    if (-not $timeoutSeconds) { $timeoutSeconds = 60 }
    Write-Host "Waiting for API health at $url/api/health (timeout ${timeoutSeconds}s)..."
    $end = (Get-Date).AddSeconds($timeoutSeconds)
    while ((Get-Date) -lt $end) {
        try {
            $h = Invoke-RestMethod -Uri "$url/api/health" -UseBasicParsing -TimeoutSec 3
            Write-Host "Health ok:"; $h | ConvertTo-Json -Depth 3
            return $true
        } catch {
            Write-Host -NoNewline '.'; Start-Sleep -Seconds 1
        }
    }
    Write-Error "API did not become ready within $timeoutSeconds seconds"
    return $false
}

Write-Host "Starting admin checks against $BaseUrl"
if (-not (Wait-ForHealth $BaseUrl 60)) { exit 1 }

try {
    $loginBody = @{ username = $AdminUser; password = $AdminPass } | ConvertTo-Json
    Write-Host "Logging in as $AdminUser..."
    $loginResp = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post -Body $loginBody -ContentType 'application/json' -ErrorAction Stop
    $token = $loginResp.data.AccessToken
    Write-Host "ACCESS_TOKEN:`n$token`n"
} catch {
    Write-Error "Login failed: $($_.Exception.Message)"
    exit 1
}

try {
    $hdr = @{ Authorization = "Bearer $token" }

    # create a user (admin-only)
    $newUser = @{ username = "testuser_$(Get-Random -Maximum 9999)"; fullName = 'مستخدم اختبار'; role = 'user'; password = 'User123!' }
    Write-Host "Creating user: $($newUser.username)"
    $createResp = Invoke-RestMethod -Uri "$BaseUrl/api/users" -Method Post -Headers $hdr -Body ($newUser | ConvertTo-Json) -ContentType 'application/json' -ErrorAction Stop
    Write-Host "Create user response:"; $createResp | ConvertTo-Json -Depth 5
} catch {
    Write-Error "Create user failed: $($_.Exception.Message)"
}

try {
    # list queues
    Write-Host "Listing queues..."
    $queues = Invoke-RestMethod -Uri "$BaseUrl/api/queues" -Method Get -Headers $hdr -ErrorAction Stop
    Write-Host "Queues:"; $queues | ConvertTo-Json -Depth 5
} catch {
    Write-Error "List queues failed: $($_.Exception.Message)"
    exit 1
}

if ($queues -and $queues.Count -ge 1) {
    # pick first queue id (support different casing)
    $first = $queues[0]
    if ($first.PSObject.Properties['id']) { $qId = $first.id } elseif ($first.PSObject.Properties['Id']) { $qId = $first.Id } else { $qId = $first.Id }
    if (-not $qId) { Write-Error 'Could not determine queue id'; exit 1 }

    $patients = @(
        @{ fullName = 'Patient One'; phone = '0500000001'; nationalId = '900000001'; desiredPosition = 1 },
        @{ fullName = 'Patient Two'; phone = '0500000002'; nationalId = '900000002'; desiredPosition = 2 }
    )

    try {
        Write-Host "Adding patients to queue $qId"
        $addResp = Invoke-RestMethod -Uri "$BaseUrl/api/queues/$qId/patients" -Method Post -Headers $hdr -Body (@{ patients = $patients } | ConvertTo-Json -Depth 5) -ContentType 'application/json' -ErrorAction Stop
        Write-Host "Add patients response:"; $addResp | ConvertTo-Json -Depth 5
    } catch {
        Write-Error "Add patients failed: $($_.Exception.Message)"
    }
} else {
    Write-Host 'No queues available to add patients.'
}

Write-Host 'Admin checks completed.'
