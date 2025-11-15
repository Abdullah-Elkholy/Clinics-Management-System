param(
  [string]$ConnectionString = "Server=BODYELKHOLY\\SQL2022;Database=ClinicsDb;User Id=sa;Password=123456;TrustServerCertificate=True;"
)

$ErrorActionPreference = 'Stop'
$cs = $ConnectionString
Add-Type -AssemblyName System.Data
$cn = New-Object System.Data.SqlClient.SqlConnection $cs
$cn.Open()

function Run-Query($sql) {
  $cmd = $cn.CreateCommand()
  $cmd.CommandText = $sql
  $rdr = $cmd.ExecuteReader()
  $tbl = New-Object System.Data.DataTable
  $tbl.Load($rdr) | Out-Null
  return $tbl
}

Write-Host "== Users (admin, admin2, mod1, user1) =="
$users = Run-Query "SELECT Id, Username, FirstName, LastName, Role, ModeratorId FROM dbo.Users WHERE Username IN ('admin','admin2','mod1','user1') ORDER BY Username;"
$users | Format-Table -AutoSize

# Assertions: expect 4 users with specific names
if ($users.Rows.Count -lt 4) { throw "Expected 4 seeded users (admin, admin2, mod1, user1). Found: $($users.Rows.Count)" }

$lookup = @{}
foreach ($row in $users.Rows) { $lookup[$row.Username] = $row }

function Assert-Name($u, $first, $last) {
  if ($null -eq $u) { throw "User entry missing" }
  if (($u.FirstName -ne $first) -or ($u.LastName -ne $last)) {
    throw "User $($u.Username) expected name '$first $last' but found '$($u.FirstName) $($u.LastName)'"
  }
}

Assert-Name $lookup.admin  'Admin' 'One'
Assert-Name $lookup.admin2 'Admin' 'Two'
Assert-Name $lookup.mod1   'Mod'   'One'
Assert-Name $lookup.user1  'User'  'One'

Write-Host "== user1 -> moderator username =="
$link = Run-Query "SELECT u.Username AS UserName, u.ModeratorId, m.Username AS ModeratorUsername FROM dbo.Users u LEFT JOIN dbo.Users m ON m.Id = u.ModeratorId WHERE u.Username = 'user1';"
$link | Format-Table -AutoSize
if ($link.Rows.Count -ne 1 -or $link.Rows[0].ModeratorUsername -ne 'mod1') { throw "user1 should be linked to moderator 'mod1'" }

Write-Host "== Queues =="
$queues = Run-Query "SELECT Id, DoctorName, ModeratorId FROM dbo.Queues ORDER BY Id;"
$queues | Format-Table -AutoSize
if (-not ($queues | Where-Object { $_.DoctorName -eq "عيادة د. أحمد" })) { throw "Expected seeded queue 'عيادة د. أحمد' not found" }

Write-Host "== Quota exists for mod1 =="
$quota = Run-Query "SELECT COUNT(*) AS QuotasForMod1 FROM dbo.Quotas q JOIN dbo.Users u ON u.Id = q.ModeratorUserId WHERE u.Username = 'mod1';"
$quota | Format-Table -AutoSize
if ([int]$quota.Rows[0].QuotasForMod1 -lt 1) { throw "Quota for mod1 not found" }

Write-Host "== Template & Condition sample =="
$tc = Run-Query "SELECT TOP(1) mt.Id AS TemplateId, mt.Title, mt.QueueId, c.Id AS ConditionId, c.Operator, c.Value, c.MinValue, c.MaxValue, c.QueueId FROM dbo.MessageTemplates mt LEFT JOIN dbo.MessageConditions c ON c.TemplateId = mt.Id ORDER BY mt.Id;"
$tc | Format-Table -AutoSize
if ($tc.Rows.Count -lt 1) { throw "Expected at least one MessageTemplate (with optional condition)" }

$cn.Close()