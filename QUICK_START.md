# Quick Start Guide - Test Suite & CI/CD

## 🎯 Current Status
- **Pass Rate**: 375/425 (88.2%)
- **Target**: 90% (need +7 tests)
- **Status**: ✅ HEALTHY

## 🏃 Quick Commands

### Run All Tests
```bash
cd apps/web
npm test -- --passWithNoTests --testTimeout=10000
```

### Run Specific Test Suite
```bash
npm test -- dashboard-error-handling.test.jsx
npm test -- tabs-integration.test.jsx
npm test -- CSVEdgeCases.integration.test.jsx
```

### Run Tests with Coverage
```bash
npm test -- --coverage --watchAll=false
```

### Watch Mode (Development)
```bash
npm test -- --watch
```

## 📁 Documentation Files

All located in `docs/`:
- `reports/FINAL_STATUS.md` - Current achievement overview
- `reports/PHASE2_COMPLETION_REPORT.md` - Detailed Phase 2 analysis
- `reports/TEST_PROJECT_STATUS.md` - Test inventory
- `guides/NEXT_STEPS.md` - Continuation strategy
- `guides/REMAINING_FIXES_STRATEGY.md` - Fix prioritization
- `analysis/TEST_FAILURE_ANALYSIS.md` - Root cause analysis

## 🚀 GitHub Actions

Workflow file: `.github/workflows/tests.yml`

**Triggers**:
- Push to main/develop
- Pull requests to main/develop
- Manual workflow dispatch

**Jobs**:
1. Frontend tests (Node 18.x, 20.x)
2. Backend build tests
3. Coverage reporting
4. Test artifacts archival

**To Deploy**:
```bash
git add .github/workflows/tests.yml
git commit -m "Add GitHub Actions test automation"
git push origin main
```

## 🔥 Highest Impact Fixes (For Next Developer)

### Priority 1: Toast Integration (~15 tests) - 1-2 hours
- **Files**: dashboard-error-handling.test.jsx, login.test.jsx
- **Issue**: showToast() messages not appearing in DOM
- **Strategy**: Review async patterns in test setup

### Priority 2: CSV Operations (~12 tests) - 2-3 hours  
- **Files**: CSVEdgeCases, CSVPartialAndError, CSVOptimistic
- **Issue**: MSW handlers or data transformation
- **Strategy**: Verify CSV upload mocks match component expectations

### Priority 3: Message Retry (~10 tests) - 2-3 hours
- **Files**: MessagesRetry, MessagesEdgeCases
- **Issue**: Complex async state handling
- **Strategy**: Check retry logic with proper wait assertions

## 💡 Key Technical Notes

### What Worked Best
- ✅ Using `renderWithProviders` from test-utils (NOT custom versions)
- ✅ Hoisted `jest.mock()` calls before imports
- ✅ Proper MSW handler setup in beforeAll
- ✅ Async assertions with waitFor()

### Most Common Mistakes
- ❌ Custom renderWithProviders without hoisted mocks
- ❌ Missing async/await in assertions
- ❌ Toast tests without proper mock setup
- ❌ CSV tests without file upload handlers

## 📊 Test Suite Organization

**52 Total Test Suites**:
- ✅ 30 passing (all green)
- ⚠️ 22 failing (systematic work ahead)

**425 Total Tests**:
- ✅ 375 passing (88.2%)
- ⚠️ 50 failing (11.8%)

## 🎯 Path to 90%

| Action | Tests Fixed | Time | Cumulative |
|--------|------------|------|-----------|
| Toast integration | +4 | 1h | 379 (89%) |
| CSV quick wins | +3 | 1.5h | 382 (90%) ✅ |
| Optional: Templates | +8 | 1-2h | 390 (92%) |
| Optional: Message retry | +10 | 2-3h | 400 (94%) |

## ⚡ Tips for Quick Wins

1. **Check Toast Mocks**: Ensure toast container properly set up in renderWithProviders
2. **CSV Upload Handling**: MSW needs proper multipart/form-data handler
3. **Async Patterns**: Use `waitFor(() => { expect(...).toBeTruthy() })`
4. **Mock Verification**: Print MSW handlers in beforeAll to verify they're loading

## 🔗 Related Files

- Test utilities: `test-utils/renderWithProviders.js`
- Mock setup: `__mocks__/` folder
- MSW server: Test files using `server.use()` 
- Components: `components/` folder

## 📞 Support

All analysis documented in `docs/` folder with:
- Root cause for each failing test type
- Code examples of working solutions
- Strategy for approaching fixes
- Timeline estimates

---

**Status**: Ready for continuation | **Last Updated**: Current Session | **Maintainer**: Development Team
