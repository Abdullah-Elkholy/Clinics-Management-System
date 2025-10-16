@echo off
REM Batch wrapper to start API with env vars
set USE_LOCAL_SQL=true
set LocalSqlServer=Server=BODYELKHOLY\SQL2022;Database=ClinicsDb;User Id=sa;Password=123456;TrustServerCertificate=True;
set SEED_ADMIN=true
set SEED_ADMIN_PASSWORD=Admin123!
set ASPNETCORE_URLS=http://localhost:5000
set ASPNETCORE_ENVIRONMENT=Development

echo Starting API (dotnet run --project src/Api)
dotnet run --project "%~dp0..\src\Api"
echo API process exited. Press any key to close...
pause>nul
