# FAILING TESTS - HOW TO FIX

## Priority 1: Toast Integration (15 tests) ⭐ START HERE

**Files**: 
- dashboard-error-handling.test.jsx
- login.test.jsx
- regression/toast-fixes.test.jsx

**Problem**: showToast() not rendering messages in DOM

**Fix Pattern**:
```javascript
// Check if toast mock is in renderWithProviders
// If missing, add to test-utils/renderWithProviders.js
// Use waitFor() for async assertions:
await waitFor(() => {
  expect(screen.getByText('Success')).toBeInTheDocument()
})
```

**Time**: 1-2 hours | **Impact**: +4 tests to 90%

---

## Priority 2: CSV Operations (12 tests)

**Files**:
- CSVEdgeCases.integration.test.jsx
- CSVPartialAndError.integration.test.jsx
- CSVOptimistic.integration.test.jsx

**Problem**: File upload or parsing failures

**Fix Pattern**:
```javascript
// Verify MSW handler for CSV upload
server.use(
  rest.post('/api/csv/upload', (req, res, ctx) => {
    return res(ctx.json({ success: true }))
  })
)
```

**Time**: 2-3 hours | **Impact**: +3 tests to 90%

---

## Priority 3: Message Retry (10 tests)

**Files**:
- MessagesRetry.integration.test.jsx
- MessagesEdgeCases.integration.test.jsx

**Problem**: Retry logic not working correctly

**Fix**: Check retry implementation with proper wait patterns

**Time**: 2-3 hours | **Impact**: Bonus tests

---

## Priority 4: Templates (8 tests)

**Files**:
- TemplatesSend.integration.test.jsx

**Problem**: Data structure mismatches

**Fix**: Verify mock response format matches component

**Time**: 1-2 hours | **Impact**: Bonus tests

---

## Priority 5: Other (5 tests)

**Files**: Reorder, DeleteSelected, api-payloads

**Time**: 1 hour | **Impact**: Bonus tests

---

## Fix Order to Reach 90%

```
1. Toast integration
   ↓ Fix 4 tests → 379/425 (89.2%)

2. CSV quick wins
   ↓ Fix 3 tests → 382/425 (90.0%) ✅ TARGET REACHED
```

**Total Time**: 4-6 hours
