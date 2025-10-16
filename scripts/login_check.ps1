param(
    [string]$BaseUrl = 'http://localhost:5000'
)

function ToUtf8($obj) {
    # Return JSON string (Invoke-RestMethod will send it correctly).
    return $obj | ConvertTo-Json -Depth 10
}

try {
    # AuthController accepts literal password 'admin' for seeded users without a PasswordHash (development backdoor)
    $body = @{ Username = 'admin'; Password = 'admin' }
    $resp = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post -Body (ToUtf8 $body) -ContentType 'application/json; charset=utf-8' -ErrorAction Stop
    Write-Host 'Login SUCCESS'
    Write-Host 'Full response JSON:'
    $resp | ConvertTo-Json -Depth 10 | Write-Host
    Write-Host '`n--- ACCESS TOKEN (full) ---`n'
    Write-Host $resp.data.AccessToken
} catch {
    Write-Host 'Login FAILED:' $_.Exception.Message
    if ($_.Exception.Response) {
        $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        Write-Host 'Response body:'
        Write-Host $sr.ReadToEnd()
    }
    exit 1
}
