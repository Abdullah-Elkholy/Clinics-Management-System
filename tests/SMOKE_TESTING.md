Testing & smoke-test (PowerShell on Windows)

This project includes a smoke-test script at `scripts/run_smoke_test.ps1` that:

- Applies EF Core migrations (Infrastructure project).
- Starts the API (`src/Api`) and redirects stdout/stderr to `./logs/api_out.log` and `./logs/api_err.log`.
- Waits for the API to become ready (checks `http://localhost:5000/swagger/index.html`).
- Logs in with the seeded admin account, performs an admin GET, and calls refresh.

Important: the script defaults to a safe DryRun (no destructive actions). You must pass `-Execute` to run migrations and start the API.

1) Validate parsing (DryRun - safe)

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run_smoke_test.ps1
```

Expected output: the script prints Mode: DryRun, BaseUrl and LocalSqlServer, then exits.

2) Run the full smoke test (destructive: will run EF migrations and start the API)

Replace the connection string below with your local SQL Server instance if needed. Use single quotes around the connection string in PowerShell so backslashes are preserved literally.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\run_smoke_test.ps1 -Execute -LocalSqlServer 'Server=BODYELKHOLY\SQL2022;Database=ClinicsDb;User Id=sa;Password=123456;TrustServerCertificate=True;'
```

What it does:
- Applies `dotnet ef database update --project src/Infrastructure --startup-project src/Api`.
- Starts the API and waits for readiness, then exercises the auth endpoints (login -> admin GET -> refresh).

3) Inspect logs if something fails

If the script reports "API not ready" or exits with a non-zero code, inspect the logs:

```powershell
Get-Content .\logs\api_out.log -Tail 400
Get-Content .\logs\api_err.log -Tail 400
```

4) Run EF migrations manually (optional)

If you prefer to run migrations separately, from repository root:

```powershell
dotnet ef database update --project src/Infrastructure --startup-project src/Api
```

5) Seeded admin credentials

When the environment variable `SEED_ADMIN` is set to `true` the API seeds a development admin user on startup. The seeded account is:

- Username: `admin`
- Password: `Admin123!`

If you change `AdminUser` or `AdminPass` in the script, make sure they match the database account.

6) Notes about backslashes and connection strings

- PowerShell single-quoted strings are literal. Use a single backslash in the server instance name:

  'Server=MYHOST\SQL2022;Database=ClinicsDb;User Id=sa;Password=...;'

- If you see a `\\` appearance in some contexts, that is usually an escaping artifact from JSON or when embedding inside another string; the SQL client expects a single backslash.

7) Troubleshooting tips

- Ensure .NET 8 SDK is installed and `dotnet` is on your PATH.
- If `dotnet run` fails to start the API, open `logs/api_err.log` for stack traces.
- If migrations fail, run the manual migration command above and inspect the console errors.

8) Quick manual health-checks (if API is running)

- Swagger UI / readiness:

```powershell
Invoke-WebRequest -Uri "http://localhost:5000/swagger/index.html" -Method Head -UseBasicParsing -TimeoutSec 5
```

- Login (example using `Invoke-RestMethod`):

```powershell
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$body = @{ username='admin'; password='Admin123!' } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:5000/api/auth/login" -Method Post -ContentType 'application/json' -Body $body -WebSession $session
```

If you'd like, I can either try again to edit `README.md` in-place, or you can copy the contents of this `docs/SMOKE_TESTING.md` into `README.md` where you'd like it inserted. Let me know which you prefer.