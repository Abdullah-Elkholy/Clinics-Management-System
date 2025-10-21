# Next Steps: Quick Start Guide

## Current Status
- **Tests Passing**: 361/425 (84.9%)
- **Tests Failing**: 64 (15.1%)
- **Target**: 382/425 (90%)
- **Needed**: +21 tests

## Top 3 Quick Wins (Should take ~2-3 hours total)

### 1. Fix Tabs Navigation Tests (10 tests)
**File**: `__tests__/tabs-integration.test.jsx`  
**Issue**: Failed/Ongoing tabs not loading data  
**Command to test**:
```bash
cd apps/web
npm test -- tabs-integration.test.jsx --no-coverage
```
**Expected Error**: Tab data not loading or rendering  
**Fix Strategy**:
1. Check mock data for `useFailedTasks` and `useOngoingSessions`
2. Verify hook returns `{ data: [] }` structure
3. May need to update `test-utils/renderWithProviders.js` hooks

**Effort**: 30 min | **Impact**: 10 tests → ~87% pass rate

---

### 2. Fix Authorization Tests (10 tests)
**File**: `__tests__/authorization.test.js`  
**Issue**: Permission expectations don't match hook  
**Current Status**: 15/25 passing  
**Problem Lines**: Permission combination forEach loop (line 305-320)  
**Fix Strategy**:
1. Review `lib/authorization.js` to understand actual behavior
2. Either:
   - Update hook to return missing fields/correct logic, OR
   - Update test expectations to match current hook
3. Most likely: AuthProvider isn't being tested with mocked permissions

**Effort**: 1 hour | **Impact**: +10 tests → ~90% pass rate

---

### 3. Fix QuotaDisplay Mock (1-5 tests)
**File**: `__tests__/QuotaDisplay.test.js`  
**Issue**: Mock incomplete  
**Command**:
```bash
npm test -- QuotaDisplay.test.js --no-coverage
```
**Fix Strategy**:
1. Check what the test expects
2. Ensure `__mocks__/components/QuotaDisplay.js` exports all needed functions
3. May need to add mock to match component API

**Effort**: 30 min | **Impact**: +1-5 tests → ~90-91% pass rate

---

## Testing Commands

```bash
# Run specific test file
npm test -- FileName.test.jsx --no-coverage

# Run all tests with timeout
npm test -- --passWithNoTests --testTimeout=10000

# Run with verbose output
npm test -- FileName.test.jsx --verbose

# Run and show coverage
npm test -- --coverage

# Watch mode
npm test -- --watch
```

## Common Patterns

### Testing with Mock Data
```javascript
import { renderWithProviders } from '../test-utils/renderWithProviders'

// Pass auth state
renderWithProviders(<Component />, { 
  auth: { user: { role: 'primary_admin' } } 
})

// Pass localStorage
renderWithProviders(<Component />, { 
  localStorage: { token: 'test-token' } 
})
```

### Mocking Authorization
```javascript
jest.mock('../lib/authorization', () => ({
  useAuthorization: jest.fn(() => ({
    canCreateQueues: true,
    canEditQueues: true,
    canDeleteQueues: true,
  })),
}))
```

### MSW Mock Handler
```javascript
server.use(
  rest.get(`${API_BASE}/api/path`, (req, res, ctx) => {
    return res(ctx.json({ data: { /* mock data */ } }))
  })
)
```

## Key Files to Know

### Test Infrastructure
- `test-utils/renderWithProviders.js` - Main test rendering utility
- `mocks/server.js` - MSW setup
- `mocks/handlers.js` - API mock handlers

### Components Recently Fixed
- `components/AddPatientsModal.js` - Added label accessibility
- `__tests__/Dashboard.test.jsx` - Queue creation test updated
- `__tests__/AuthContext.test.js` - localStorage handling

### Troubleshooting Files
- `lib/authorization.js` - Authorization hook (if tests fail)
- `lib/auth.js` - Auth context
- `lib/i18n.js` - i18n setup

## What NOT to Break

✅ These tests are stable and passing:
- Dashboard tests (12/12)
- AddPatientsModal tests (42/42)
- AddQueueModal tests (43/43)
- CSVUploadModal tests (45/45)
- EditUserModal tests (47/47)
- ManagementPanel tests (23/23)
- LoginForm tests (2/2)
- Layout tests (7/7)
- Navigation tests (7/7)
- AuthContext tests (4/4)

**Do NOT touch these unless necessary!**

## Documentation

**Read These First**:
1. `PHASE2_COMPLETION_REPORT.md` - What was done
2. `TEST_PROJECT_STATUS.md` - Overall status
3. `TEST_FAILURE_ANALYSIS.md` - Why tests fail

**Then Review**:
- `SESSION_SUMMARY.md` - Full context
- `REMAINING_FIXES_STRATEGY.md` - Strategy notes

## Success Checklist

- [ ] Ran full test suite: `npm test -- --passWithNoTests`
- [ ] Identified one failing test to fix
- [ ] Made the fix
- [ ] Re-ran full test suite (verify no regressions)
- [ ] Repeated for next test
- [ ] Documented any new patterns discovered

## Common Issues & Solutions

### "Cannot find module '__mocks__/...'"
- Check mock file exists in `__mocks__` directory
- Ensure export names match import

### "MSW handler not responding"
- Verify URL matches exactly (case-sensitive)
- Check handler is using correct HTTP method (GET/POST)
- Ensure server.use() is called BEFORE test renders

### "localStorage not set"
- Pass localStorage via renderWithProviders options
- Don't use window.localStorage directly in tests

### "Async test timeout"
- Add `--testTimeout=10000` flag
- Use `waitFor()` for async operations
- Ensure all promises resolve

## Contact Points

**Questions about**:
- Component fixes? → Check `PHASE2_COMPLETION_REPORT.md`
- Test patterns? → Review working tests in fixed components
- Test infrastructure? → See `test-utils/renderWithProviders.js`
- Authorization? → Check `lib/authorization.js` vs test expectations

---

**Created**: After Phase 2  
**For**: Next developer  
**Goal**: Quick path to 90% test pass rate

🚀 **Ready to continue? Pick issue #1 (tabs) and start!**
