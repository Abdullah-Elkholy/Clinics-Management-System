$BaseUrl = 'http://localhost:5000'
$user = 'admin'
$passwords = @('DevAdmin!23','Admin123!','admin','password','Admin!123')

foreach ($pw in $passwords) {
    Write-Host "Trying password: $pw"
    $body = @{ username = $user; password = $pw } | ConvertTo-Json
    try {
        $resp = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post -Body $body -ContentType 'application/json' -ErrorAction Stop
        Write-Host "SUCCESS with password: $pw"
        $resp | ConvertTo-Json -Depth 5
        break
    } catch {
        Write-Host "Failed: $($_.Exception.Response.StatusCode.value__ 2>$null)" -ForegroundColor Yellow
    }
}
