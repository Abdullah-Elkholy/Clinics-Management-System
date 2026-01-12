# Test Execution Guide

## Quick Commands

### Run all backend tests
```bash
dotnet test tests/Clinics.Api.Tests --verbosity normal
```

### Run tests with coverage
```bash
dotnet test tests/Clinics.Api.Tests --collect:"XPlat Code Coverage"
```

### Run specific test class
```bash
dotnet test tests/Clinics.Api.Tests --filter "FullyQualifiedName~HarnessVerificationTests"
```

### Run specific test method
```bash
dotnet test tests/Clinics.Api.Tests --filter "FullyQualifiedName~HarnessVerificationTests.TestRunner_ShouldExecute"
```

### Build + Test
```bash
# Clean build entire solution
dotnet build ClinicsManagementSln.sln -c Debug

# Run tests (no rebuild)
dotnet test tests/Clinics.Api.Tests --no-build --verbosity normal
```

## CI/Automation

### Full pipeline simulation
```powershell
# 1. Restore packages
dotnet restore ClinicsManagementSln.sln

# 2. Build solution
dotnet build ClinicsManagementSln.sln -c Debug --no-incremental

# 3. Run tests
$env:VSTEST_CONNECTION_TIMEOUT=180
dotnet test tests/Clinics.Api.Tests --no-build --verbosity normal
```

## Test Organization

```
tests/Clinics.Api.Tests/
├── _SmokeTests/              # Harness verification (always run first)
├── Unit/                     # Fast, isolated tests
│   ├── PauseResume/          # State machine logic
│   ├── Queue/                # Queue eligibility & ordering
│   └── MessageNormalization/ # Text sanitization
└── Integration/              # DB + service interactions
    ├── Queue/                # Persistence & concurrency
    └── PauseResume/          # Pause/resume during sending
```

## Troubleshooting

### Test timeout error
If you see "vstest.console process failed to connect", increase timeout:
```powershell
$env:VSTEST_CONNECTION_TIMEOUT=180
dotnet test tests/Clinics.Api.Tests
```

### Build warnings
The solution currently has 31 warnings (pre-existing, not test-related). These are acceptable for now and will be addressed in later phases.

## Test Naming Conventions

- Test class: `{FeatureName}Tests` (e.g., `PauseResumeStateMachineTests`)
- Test method: `{Method}_{Scenario}_{ExpectedResult}` (e.g., `EffectivePausedState_WhenGlobalPaused_ShouldReturnTrue`)
- Use `[Fact]` for parameterless tests, `[Theory]` for parameterized tests

## Phase Progress

### ✅ Phase 1 Complete — 185 tests, 10 defects

✅ Phase 0.1-0.2: Test harness + build pipeline (3)
✅ Phase 1.1: Canonical state model
✅ Phase 1.2: Pause/resume unit tests (30)
✅ Phase 1.3: Queue eligibility (15)
✅ Phase 1.4: Queue persistence (14)
✅ Phase 1.5: Pause/resume sending (13)
✅ Phase 1.6: Failed tasks + retry (15)
✅ Phase 1.7: Message normalization (45) → DEF-003/004/005
✅ Phase 1.8: Extension lifecycle (32) → DEF-006/007/008/009/010
✅ Phase 1.9: E2E golden flow (18)

### ✅ Phase 2 (Templates) — Partial (62 tests)

✅ Phase 2.1: Condition evaluation unit tests (41)
✅ Phase 2.2: Condition-to-action integration tests (21)
⏸️ Phase 2.3: Frontend integration tests (deferred)
⏸️ Phase 2.4: E2E template flow (deferred)

### 🔄 Phase 3 (Patients) — In Progress (64 tests)

✅ Phase 3.1: Patient validation unit tests (27)
✅ Phase 3.2: Patient persistence integration tests (19)
⏸️ Phase 3.3: Frontend validation tests (deferred)
✅ Phase 3.4: Excel upload parsing tests (18)
⏸️ Phase 3.5: E2E upload flow (deferred)

### 🔄 Phase 4 (Users/Quota) — In Progress (47 tests)

✅ Phase 4.1: Role enforcement unit tests (21) → DEF-011
⏸️ Phase 4.2: Frontend role UI tests (deferred)
✅ Phase 4.3: Quota enforcement integration tests (26) → DEF-012
⏸️ Phase 4.4: E2E quota blocking (not started)

### ✅ Phase 5 (Database) — Complete (27 tests)

✅ Phase 5.1: Schema constraint tests (13) → DEF-013
✅ Phase 5.2: Concurrency tests (14) → DEF-014
⏸️ Phase 5.3: Migration tests (N/A - no migrations exist)

### ✅ Phase 6 (Regression) — Complete

✅ Phase 6.1: Compact regression suite (14 tests)
✅ Phase 6.2: Edge Cases Index (`docs/EDGE_CASES_INDEX.md`)

### ✅ Phase 7 (Multi-User Authority) — Complete (32 tests)

✅ Phase 7.1: User-Under-Moderator authority (10 tests)
✅ Phase 7.2: Multi-user concurrent access (7 tests)
✅ Phase 7.3: Admin full authority (11 tests)
✅ Phase 7.4: Cross-role conflict (5 tests)

### **Total: 434 tests passing**

---

## ✅ TEST RESET AND REBUILD PLAN COMPLETE

All backend phases complete. **11 of 14 defects fixed** (1 N/A, 2 deferred).

### Defect Fixes Applied (Jan 6, 2026)
| Fixed | Service/File |
|-------|--------------|
| DEF-003,004,005 | `MessageContentSanitizer.cs` |
| DEF-006,007,008,009,010 | `ExtensionCommandValidator.cs`, `ExtensionCommandCleanupService.cs` |
| DEF-011 | `UserRole.cs` (case-insensitive) |
| DEF-013 | `Patient.RowVersion` + migration |
| DEF-014 | `MessageStatusStateMachine.cs` |

---

## 🌐 Frontend Tests (Jest)

Run with: `cd apps/web && npm test`

✅ Phase 2.3: Template selection tests (14)
✅ Phase 3.3: Patient form validation tests (18)
✅ Phase 4.2: Role-based UI tests (17)

**Frontend Total: 49 tests**

---

## 🎭 E2E Tests (Playwright)

Run with: `cd apps/web && npm run test:e2e`

✅ Phase 2.4: Template flow E2E (5 tests)
✅ Phase 3.5: Excel upload E2E (6 tests)
✅ Phase 4.4: Quota blocking E2E (6 tests)

**E2E Total: 17 tests**

---

## 🎯 GRAND TOTAL: 500 tests (434 backend + 49 Jest + 17 E2E) ✅ ALL PASSING
