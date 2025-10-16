param(
    [string]$BaseUrl = 'http://localhost:5000'
)

function Send($json) {
    try {
        $resp = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post -Body $json -ContentType 'application/json; charset=utf-8' -ErrorAction Stop
        Write-Host 'SUCCESS:'
        $resp | ConvertTo-Json -Depth 10 | Write-Host
    } catch {
        Write-Host 'FAILED:' $_.Exception.Message
        if ($_.Exception.Response) {
            $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            Write-Host 'Response body:'
            Write-Host $sr.ReadToEnd()
        }
    }
}

Write-Host 'Test A: PascalCase'
Send '{"Username":"admin","Password":"Admin123!"}'

Write-Host "`nTest B: lowercase"
Send '{"username":"admin","password":"Admin123!"}'

Write-Host "`nTest C: envelope req"
Send '{"req": {"Username":"admin","Password":"Admin123!"}}'
