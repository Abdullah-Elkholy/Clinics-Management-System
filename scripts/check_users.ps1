$connString = "Server=BODYELKHOLY\SQL2022;Database=ClinicsDb;User Id=sa;Password=123456;TrustServerCertificate=True;"
$conn = New-Object System.Data.SqlClient.SqlConnection $connString
$conn.Open()
$cmd = $conn.CreateCommand()
$cmd.CommandText = "SELECT Id, Username, PasswordHash, FullName FROM dbo.Users"
$reader = $cmd.ExecuteReader()
while($reader.Read()){
    $id = $reader.GetInt32(0)
    $username = $reader.GetString(1)
    $pw = if($reader.IsDBNull(2)) { '<NULL>' } else { 'HASHED' }
    $fullname = if($reader.IsDBNull(3)) { '' } else { $reader.GetString(3) }
    Write-Host "$id | $username | $pw | $fullname"
}
$reader.Close()
$conn.Close()
