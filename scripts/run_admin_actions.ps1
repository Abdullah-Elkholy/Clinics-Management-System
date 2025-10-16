# Run admin actions against local API
$BaseUrl = 'http://localhost:5000'
$AdminUser = 'admin'
$AdminPass = 'DevAdmin!23'

Write-Host "Attempting login to $BaseUrl as $AdminUser"
$loginBody = @{ username = $AdminUser; password = $AdminPass } | ConvertTo-Json
try {
    $loginResp = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post -Body $loginBody -ContentType 'application/json' -ErrorAction Stop
} catch {
    Write-Error "Login failed: $($_.Exception.Message)"
    exit 1
}

Write-Host "Login response:"; $loginResp | ConvertTo-Json -Depth 5
$token = $loginResp.data.AccessToken
Write-Host "Access token:`n$token`n"

# prepare headers
$hdr = @{ Authorization = "Bearer $token" }

Write-Host 'Creating a test user (admin-only)...'
$newUser = @{ username = "testuser_$(Get-Random -Maximum 9999)"; fullName = 'مستخدم اختبار'; role = 'user'; password = 'User123!' }
try {
    $createResp = Invoke-RestMethod -Uri "$BaseUrl/api/users" -Method Post -Headers $hdr -Body ($newUser | ConvertTo-Json) -ContentType 'application/json' -ErrorAction Stop
    Write-Host 'Create user response:'; $createResp | ConvertTo-Json -Depth 5
} catch {
    Write-Error "Create user failed: $($_.Exception.Message)"
}

Write-Host 'Listing queues...'
try {
    $queues = Invoke-RestMethod -Uri "$BaseUrl/api/queues" -Method Get -Headers $hdr -ErrorAction Stop
    Write-Host 'Queues:'; $queues | ConvertTo-Json -Depth 5
} catch {
    Write-Error "List queues failed: $($_.Exception.Message)"
    exit 1
}

if ($queues -and $queues.Count -ge 1) {
    $first = $queues[0]
    $qId = $null
    if ($first.PSObject.Properties['id']) { $qId = $first.id } elseif ($first.PSObject.Properties['Id']) { $qId = $first.Id } else { $qId = $first.Id }
    if (-not $qId) { Write-Error 'Could not determine queue id'; exit 1 }

    $patients = @(
        @{ fullName = 'Patient One'; phone = '0500000001'; nationalId = '900000001'; desiredPosition = 1 },
        @{ fullName = 'Patient Two'; phone = '0500000002'; nationalId = '900000002'; desiredPosition = 2 }
    )

    Write-Host "Adding patients to queue $qId"
    try {
        $addResp = Invoke-RestMethod -Uri "$BaseUrl/api/queues/$qId/patients" -Method Post -Headers $hdr -Body (@{ patients = $patients } | ConvertTo-Json -Depth 5) -ContentType 'application/json' -ErrorAction Stop
        Write-Host 'Add patients response:'; $addResp | ConvertTo-Json -Depth 5
    } catch {
        Write-Error "Add patients failed: $($_.Exception.Message)"
    }
} else {
    Write-Host 'No queues found; skipping add patients.'
}

Write-Host 'Admin actions finished.'
