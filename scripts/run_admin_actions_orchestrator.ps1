param(
    [string]$BaseUrl = 'http://localhost:5000'
)

function To-JsonUtf8Bytes($obj) {
    # Return JSON string for Invoke-RestMethod
    return $obj | ConvertTo-Json -Depth 10
}

try {
    # Login as admin (seeded)
    # Use PascalCase keys to match LoginRequest DTO
    # Use 'admin' password backdoor for seeded admin when PasswordHash is NULL
    $loginReq = @{ Username = 'admin'; Password = 'admin' }
    $login = Invoke-RestMethod -Uri "$BaseUrl/api/auth/login" -Method Post -Body (To-JsonUtf8Bytes $loginReq) -ContentType 'application/json; charset=utf-8' -ErrorAction Stop
    $token = $login.data.AccessToken
    Write-Host "TOKEN:`n$token"

    $hdr = @{ Authorization = "Bearer $token" }

    # Ensure roles exist via direct SQL (idempotent)
    try {
        $connString = "Server=BODYELKHOLY\\SQL2022;Database=ClinicsDb;User Id=sa;Password=123456;TrustServerCertificate=True;"
        $sql = @'
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Name = N''primary_admin'')
    INSERT INTO dbo.Roles (Name, DisplayName) VALUES (N'primary_admin', N'المدير الأساسي');
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Name = N''moderator'')
    INSERT INTO dbo.Roles (Name, DisplayName) VALUES (N'moderator', N'المشرف');
IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE Name = N''user'')
    INSERT INTO dbo.Roles (Name, DisplayName) VALUES (N'user', N'مستخدم');
'@
        $conn = New-Object System.Data.SqlClient.SqlConnection $connString
        $conn.Open()
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = $sql
        $cmd.ExecuteNonQuery() | Out-Null
        $conn.Close()
        Write-Host 'Ensured roles exist in DB.'
    } catch {
        Write-Host 'Warning: could not ensure roles via direct SQL. Proceeding.'
    }

    # Create a user (PascalCase DTO)
    $newUser = @{ Username = "created_by_test_$([int](Get-Random -Maximum 9999))"; FullName = 'مستخدم إنشاء'; Role = 'user'; Password = 'User123!' }
    $create = Invoke-RestMethod -Uri "$BaseUrl/api/users" -Method Post -Headers $hdr -Body (To-JsonUtf8Bytes $newUser) -ContentType 'application/json; charset=utf-8' -ErrorAction Stop
    Write-Host 'Create user result:'
    $create | ConvertTo-Json -Depth 10 | Write-Host

    # List queues
    $queues = Invoke-RestMethod -Uri "$BaseUrl/api/queues" -Method Get -Headers $hdr -ErrorAction Stop
    Write-Host 'Queues:'
    $queues | ConvertTo-Json -Depth 10 | Write-Host

    # Force add patients to queue id 1 (POST each patient individually using PatientCreateRequest DTO)
    $qId = 1
    $patients = @(
        @{ FullName = 'E2E Patient 1'; PhoneNumber = '+966500000101'; DesiredPosition = 1 },
        @{ FullName = 'E2E Patient 2'; PhoneNumber = '+966500000102'; DesiredPosition = 2 }
    )
    foreach ($p in $patients) {
        try {
            $addResp = Invoke-RestMethod -Uri "$BaseUrl/api/queues/$qId/patients" -Method Post -Headers $hdr -Body (To-JsonUtf8Bytes $p) -ContentType 'application/json; charset=utf-8' -ErrorAction Stop
            Write-Host "Added patient: $($p.FullName)"
            $addResp | ConvertTo-Json -Depth 10 | Write-Host
        } catch {
            Write-Host "Warning: failed to add patient $($p.FullName):" $_.Exception.Message
            if ($_.Exception.Response) {
                $sr = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                Write-Host 'Response body:'
                Write-Host $sr.ReadToEnd()
            }
        }
    }

    # Create an extra user
    $extraUser = @{ Username = "tester_$(Get-Random -Maximum 9999)"; FullName = 'اختبار'; Role = 'user'; Password = 'Test123!' }
    $createdExtra = Invoke-RestMethod -Uri "$BaseUrl/api/users" -Method Post -Headers $hdr -Body (To-JsonUtf8Bytes $extraUser) -ContentType 'application/json; charset=utf-8' -ErrorAction Stop
    Write-Host 'Created extra user:'
    $createdExtra | ConvertTo-Json -Depth 10 | Write-Host

    # Update that user's role to moderator via direct SQL (no update endpoint implemented)
    try {
        $connString = "Server=BODYELKHOLY\\SQL2022;Database=ClinicsDb;User Id=sa;Password=123456;TrustServerCertificate=True;"
        $conn = New-Object System.Data.SqlClient.SqlConnection $connString
        $conn.Open()
        $uid = $createdExtra.data.Id
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = "UPDATE dbo.Users SET RoleId = (SELECT Id FROM dbo.Roles WHERE Name = 'moderator') WHERE Id = $uid"
        $cmd.ExecuteNonQuery() | Out-Null
        $conn.Close()
        Write-Host "Updated user $uid role to moderator via direct SQL."
    } catch {
        Write-Host 'Warning: could not update role via SQL: ' $_.Exception.Message
    }

    # Create a message template
    $template = @{ Title = 'Test Template'; Content = 'Hello {{name}}, this is a test message.'; CreatedBy = 1; IsShared = $true }
    $createdTpl = Invoke-RestMethod -Uri "$BaseUrl/api/templates" -Method Post -Headers $hdr -Body (To-JsonUtf8Bytes $template) -ContentType 'application/json; charset=utf-8' -ErrorAction Stop
    Write-Host 'Created template:'
    $createdTpl | ConvertTo-Json -Depth 10 | Write-Host

    # Fetch patients in queue 1 and send a message to the last two
    try {
        $pList = Invoke-RestMethod -Uri "$BaseUrl/api/queues/$qId/patients" -Method Get -Headers $hdr -ErrorAction Stop
        $patientIds = ($pList.data | Select-Object -Last 2 | ForEach-Object { $_.Id })
    } catch {
        $patientIds = @()
    }

    if ($patientIds.Count -gt 0) {
        $sendReq = @{ TemplateId = $createdTpl.data.Id; PatientIds = $patientIds; Channel = 'whatsapp' }
        $sendResp = Invoke-RestMethod -Uri "$BaseUrl/api/messages/send" -Method Post -Headers $hdr -Body (To-JsonUtf8Bytes $sendReq) -ContentType 'application/json; charset=utf-8' -ErrorAction Stop
        Write-Host 'Send message response:'
        $sendResp | ConvertTo-Json -Depth 10 | Write-Host
    } else {
        Write-Host 'No patient ids available for sending message.'
    }

} catch {
    Write-Host 'ERROR:' $_.Exception.Message
    if ($_.Exception.Response) { $_.Exception.Response | Format-List -Force }
    exit 1
}
