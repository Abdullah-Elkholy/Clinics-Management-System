param(
    [string]$LocalSqlServer = "Server=BODYELKHOLY\SQL2022;Database=ClinicsDb;User Id=sa;Password=123456;TrustServerCertificate=True;",
    [string]$SeedAdminPassword = "DevAdmin!23"
)

# Set environment variables for the API process
$env:USE_LOCAL_SQL = 'true'
$env:LocalSqlServer = $LocalSqlServer
$env:SEED_ADMIN = 'true'
$env:SEED_ADMIN_PASSWORD = $SeedAdminPassword
$env:ASPNETCORE_URLS = 'http://localhost:5000'
$env:ASPNETCORE_ENVIRONMENT = 'Development'

Write-Host "Starting API with LocalSqlServer: $LocalSqlServer"

dotnet run --project src/Api
