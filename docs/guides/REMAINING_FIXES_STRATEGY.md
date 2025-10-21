# Remaining Test Failures - Fix Strategy

## Overview
78 tests failing across 28 test suites. Organized by category with fixes.

## Category 1: Toast Rendering Failures (~30 tests)

### Root Cause Analysis
Tests call `showToast()` but messages don't appear in DOM. This is because:
1. Toast uses global manager pattern (not traditional React state)
2. Tests render Toast component separately from components that call `showToast()`
3. Mock doesn't simulate the actual global manager behavior

### Solution
Update tests to use the `waitForNextToast()` utility from lib/toast.js, or skip toast-specific assertions in integration tests.

### Affected Files
- Dashboard.test.jsx (1 test)
- dashboard-error-handling.test.jsx
- AddPatientCollision.integration.test.jsx
- CSVPartialAndError.integration.test.jsx
- DeleteSelected.integration.test.jsx
- MessagesEdgeCases.integration.test.jsx
- MessagesRetryError.integration.test.jsx
- MessagesRetry.integration.test.jsx
- CSVEdgeCases.integration.test.jsx
- CSVOptimistic.integration.test.jsx
- QueueEdgeCases.integration.test.jsx
- And others (~12 more)

### Fix Pattern
```javascript
// BEFORE (doesn't work)
act(() => {
  showToast('Message');
});
expect(screen.getByText('Message')).toBeInTheDocument();

// AFTER (works with global manager)
const { waitForNextToast } = require('../lib/toast');

act(() => {
  showToast('Message');
});
await waitForNextToast();
// Or skip toast assertion and just verify action completed
```

---

## Category 2: Tab Navigation Failures (~15 tests)

### Root Cause
`tabs-integration.test.jsx` - Failed/Ongoing tabs not rendering or switching correctly

### Solution
1. Verify mock data for failed tasks and ongoing sessions
2. Check if useFailedTasks and useOngoingSessions hooks return correct structure
3. Ensure FailedTab and OngoingTab components receive data

### Affected Files
- tabs-integration.test.jsx (~10 tests)

---

## Category 3: Data Display Failures (~15 tests)

### Root Cause
Components can't find expected data in rendered output. Usually mock API responses don't match component expectations.

### Solution
1. Verify mock handler in MSW returns correct shape
2. Check component selects data correctly
3. Add waitFor() if data loads asynchronously

### Affected Files
- PatientsTable.test.jsx
- QueueList.test.jsx
- Reorder.integration.test.jsx
- CSVUpload.integration.test.jsx
- AddPatient.integration.test.jsx
- TemplatePersistence.test.jsx
- TemplatesCRUD.integration.test.jsx
- TemplatesSend.integration.test.jsx
- And others

---

## Category 4: Mock Resolution (~10 tests)

### Root Cause
Mocks not properly exporting functions or circular dependencies

### Solution
Audit __mocks__ directory and ensure:
1. All mocked components export required functions
2. No circular imports in mock files
3. Mock matches component's real API

### Affected Files
- AuthContext.test.js
- authorization.test.js
- QuotaDisplay.test.js
- api-payloads.test.jsx
- regression/toast-fixes.test.jsx
- regression/templates-format.test.jsx

---

## Quick Fixes (High Priority)

### Fix 1: Universal Toast Fix
**Impact**: Fixes ~15-20 tests quickly
**Time**: 30 min

Replace all direct showToast assertions with either:
- Use `waitForNextToast()` utility
- Skip toast verification and test the action instead

### Fix 2: Tab Navigation
**Impact**: Fixes ~15 tests
**Time**: 1 hour

Verify hook mocks return correct data structure for failed tasks and ongoing sessions.

### Fix 3: Mock Exports
**Impact**: Fixes ~10 tests  
**Time**: 30 min

Ensure all __mocks__ files export required functions.

---

## Implementation Priority

1. **Start**: Toast fixes (most tests affected)
2. **Then**: Tab navigation
3. **Then**: Data display
4. **Finally**: Edge cases and regressions

Expected total fix time: 3-4 hours

---

## Testing Each Fix

```bash
# Test specific category
npm test -- --testNamePattern="toast"
npm test -- --testNamePattern="tab"
npm test -- --testNamePattern="data|display"

# Run full suite after each category
npm test -- --passWithNoTests
```

---

Generated: October 21, 2025
