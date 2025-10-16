$connString = "Server=BODYELKHOLY\SQL2022;Database=ClinicsDb;User Id=sa;Password=123456;TrustServerCertificate=True;"
$conn = New-Object System.Data.SqlClient.SqlConnection $connString
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "UPDATE dbo.Users SET PasswordHash = NULL WHERE Username = 'admin'"
$rows = $cmd.ExecuteNonQuery()
Write-Host "Updated rows: $rows"
$conn.Close()
