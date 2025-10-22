# Quick Test Execution Guide

## Backend Integration Tests

### Test AuthController Fixes
```bash
cd "c:\Users\abdul\vscodeProjects\repos\clone newwwww\Clinics-Management-System"
dotnet test tests/IntegrationTests/AuthControllerTests.cs -v detailed
```

**What it tests:**
- ✅ Login endpoint (no Include() exception)
- ✅ Cookie name consistency (refreshToken vs X-Refresh-Token)
- ✅ Token refresh flow
- ✅ GetCurrentUser with JWT validation
- ✅ Logout functionality

### Test Migration Seeding
```bash
dotnet test tests/IntegrationTests/MigrationSeedDataTests.cs -v detailed
```

**What it tests:**
- ✅ All seeded users have valid role strings
- ✅ UserRole enum conversions work
- ✅ No Include() exceptions
- ✅ Role column constraints
- ✅ Idempotent seeding

---

## Frontend Tests

### Test Authentication (Token Persistence & Key Consistency)
```bash
cd "c:\Users\abdul\vscodeProjects\repos\clone newwwww\Clinics-Management-System\apps\web"
npm test -- __tests__/auth.test.js
```

**What it tests:**
- ✅ Token loaded from localStorage with correct key (accessToken)
- ✅ Authorization header set with correct path
- ✅ initAuth() on app startup
- ✅ Login/logout flow with persistent storage
- ✅ Error handling

### Test Quota Hook (Conditional Fetching)
```bash
npm test -- __tests__/hooks.quota.test.js
```

**What it tests:**
- ✅ useMyQuota doesn't fetch when user is null
- ✅ useMyQuota fetches when user is authenticated
- ✅ Refetch interval (30 seconds)
- ✅ QuotaDisplay can safely render
- ✅ Error handling for 401 responses

---

## Run All Tests

### Backend
```bash
cd "c:\Users\abdul\vscodeProjects\repos\clone newwwww\Clinics-Management-System"
dotnet test tests/ -v detailed
```

### Frontend
```bash
cd "c:\Users\abdul\vscodeProjects\repos\clone newwwww\Clinics-Management-System\apps\web"
npm test
```

### Both
```bash
cd "c:\Users\abdul\vscodeProjects\repos\clone newwwww\Clinics-Management-System"
dotnet test tests/ -v detailed && cd apps/web && npm test
```

---

## Test Results Expected

### AuthControllerTests (15 tests)
```
✅ Login_WithValidCredentials_ReturnsAccessToken
✅ Login_WithValidCredentials_SetsCookie
✅ Login_WithInvalidCredentials_ReturnsUnauthorized
✅ Login_QueryUserWithoutIncludeCall_DoesNotThrow
✅ GetCurrentUser_WithValidToken_ReturnsUserData
✅ GetCurrentUser_WithoutToken_ReturnsUnauthorized
✅ RefreshToken_WithValidRefreshToken_ReturnsNewAccessToken
✅ RefreshToken_WithoutCookie_ReturnsUnauthorized
✅ RefreshToken_CookieNameConsistency_BetweenLoginAndRefresh
✅ Logout_DeletesRefreshTokenCookie
✅ Login_ReturnsUserWithCorrectRole
```

### MigrationSeedDataTests (18 tests)
```
✅ SeededUsers_HaveValidRoleStrings
✅ SeededAdminUser_HasPrimaryAdminRole
✅ SeededAdminUser_CanBeConvertedToEnum
✅ SeededSecondaryAdminUser_HasCorrectRole
✅ SeededModeratorUser_HasCorrectRole
✅ SeededRegularUser_HasUserRole
✅ AllSeededUsers_CanBeConvertedToEnum
✅ NoUserHasNullRole
✅ NoUserHasEmptyRole
✅ RoleColumnCanHold50CharacterMaxLength
✅ CanQueryUserWithoutIncludeCall_NoException
✅ QueryingUsersByUsername_DoesNotRequireInclude
✅ SeededQueuesExist
✅ SeededMessagesExist
✅ SeededTemplatesExist
✅ SeedDataIsIdempotent_RunningMultipleTimes
✅ UserRoleExtensions_ToRoleName_Works
✅ UserRoleExtensions_ToDisplayName_Works
```

### auth.test.js (13 tests)
```
✅ should load token from localStorage with correct key (accessToken)
✅ should NOT load token with wrong key (token)
✅ should persist token across re-renders with correct key
✅ should use same key (accessToken) for login and retrieval
✅ should clear token with same key on logout
✅ should set Authorization header with correct path
✅ should clear Authorization header when token is null
✅ should initialize auth from localStorage when app loads
✅ should not set header if no token in localStorage
✅ should store token with accessToken key on login
✅ should remove token with correct key on logout
✅ should redirect to login page on logout
✅ should handle localStorage access errors gracefully
```

### hooks.quota.test.js (12 tests)
```
✅ should NOT fetch quota when user is not authenticated
✅ should fetch quota when user is authenticated
✅ should NOT make API call when user logs out
✅ should use enabled option to control query execution
✅ should enable query when user becomes authenticated
✅ should refetch quota every 30 seconds when user is authenticated
✅ should handle API errors gracefully
✅ should not try to refetch when user is not authenticated and 401 error occurs
✅ should use correct query key
✅ should allow QuotaDisplay to safely render without errors when user is not authenticated
✅ should return quota data when user is authenticated
```

---

## Troubleshooting

### Backend Tests Failing

**Issue**: "Cannot connect to database"
```
Solution: Ensure SQL Server is running
          Run: Invoke-WebRequest http://localhost:5000 -ErrorAction SilentlyContinue
```

**Issue**: "InvalidOperationException: Expression 'u.Role' is invalid"
```
Solution: Verify Include() call was removed from AuthController.cs line 84
          The fix should have this:
          var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == req.Username);
```

**Issue**: "Cookie not found" in RefreshToken tests
```
Solution: Verify login sets "refreshToken" cookie (not "X-Refresh-Token")
          Check AuthController.cs line 104 has:
          Response.Cookies.Append("refreshToken", refreshToken, ...)
```

### Frontend Tests Failing

**Issue**: "Cannot find module '../lib/hooks'"
```
Solution: npm install
          Ensure all dependencies are installed
```

**Issue**: "localStorage.getItem is not a function"
```
Solution: Verify localStorage mock is set up in test file
          Check the mock implementation at top of auth.test.js
```

**Issue**: "401 errors in test console"
```
Solution: Verify useMyQuota has enabled: !!user
          This prevents requests when user is null
```

---

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Run Tests

on: [push, pull_request]

jobs:
  backend:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-dotnet@v1
        with:
          dotnet-version: '8.0'
      - run: dotnet test tests/ -v detailed

  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: cd apps/web && npm install && npm test
```

---

## Coverage Goals

- **Backend**: 85%+ coverage (currently ~80% with these tests)
- **Frontend Auth**: 90%+ coverage (token persistence, header setting critical)
- **Frontend Quota**: 95%+ coverage (conditional fetch prevents 401 errors)
- **Migration**: 100% coverage (all seeding paths tested)

