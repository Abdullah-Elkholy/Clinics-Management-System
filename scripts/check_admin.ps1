param()

Write-Output "Checking for SQL Server instance MSSQL$SQL2022..."
$svc = Get-Service -Name 'MSSQL$SQL2022' -ErrorAction SilentlyContinue
if ($svc) {
    Write-Output "Service: $($svc.Name) Status: $($svc.Status)"
    if ($svc.Status -eq 'Stopped') {
        Write-Output "Starting service $($svc.Name)..."
        Start-Service -Name $svc.Name -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 3
        $svc = Get-Service -Name $svc.Name
        Write-Output "After start: $($svc.Status)"
    }
} else {
    Write-Output "Named instance MSSQL$SQL2022 not found. Showing available MSSQL services:";
    Get-Service -Name 'MSSQL*' -ErrorAction SilentlyContinue | Select-Object Name,Status,DisplayName | Format-Table -AutoSize
}

Write-Output "Attempting DB query for admin user..."
try {
    $cs = 'Server=BODYELKHOLY\\SQL2022;User Id=sa;Password=123456;'
    $cn = New-Object System.Data.SqlClient.SqlConnection $cs
    $cn.Open()
    $cmd = $cn.CreateCommand()
    $cmd.CommandText = "SET NOCOUNT ON; SELECT Id, Username, LEN(PasswordHash) AS HashLen, FullName, RoleId FROM dbo.Users WHERE Username = 'admin';"
    $r = $cmd.ExecuteReader()
    if ($r.Read()) {
        $id = $r.GetInt32(0)
        $username = $r.GetString(1)
        $hashLen = if ($r.IsDBNull(2)) { 0 } else { $r.GetInt32(2) }
        $fullname = if ($r.IsDBNull(3)) { '<NULL>' } else { $r.GetString(3) }
        $roleId = if ($r.IsDBNull(4)) { -1 } else { $r.GetInt32(4) }
        Write-Output ("$id|$username|$hashLen|$fullname|$roleId")
    } else {
        Write-Output 'NO_ROW'
    }
    $r.Close()
    $cn.Close()
} catch {
    Write-Output ('DB_ERROR: ' + $_.Exception.Message)
}
