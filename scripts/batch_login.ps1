Param()

$pairs = @(
    @{ Username = 'admin'; Password = 'admin123' },
    @{ Username = 'admin2'; Password = 'admin123' },
    @{ Username = 'mod1'; Password = 'mod123' },
    @{ Username = 'user1'; Password = 'user123' }
)

foreach ($p in $pairs) {
    Write-Output "----"
    Write-Output "Attempting login for: $($p.Username)"
    $body = @{ Username = $p.Username; Password = $p.Password } | ConvertTo-Json
    try {
        $resp = Invoke-RestMethod -Method Post -Uri 'http://localhost:5002/api/auth/login' -ContentType 'application/json' -Body $body -ErrorAction Stop
        Write-Output ($resp | ConvertTo-Json -Depth 5)
    } catch {
        Write-Output "ERROR: $($_.Exception.Message)"
    }
    Start-Sleep -Milliseconds 300
}
