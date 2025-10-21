# NEXT STEPS

## Immediate (Today)

1. **Pick Priority 1**: Start with toast integration tests
   - File: dashboard-error-handling.test.jsx
   - Command: `npm test -- dashboard-error-handling`

2. **Follow pattern**: Check FAILING_TESTS.md for fix approach

3. **Test locally**: Verify fix doesn't break other tests

4. **Commit**: Push to PR

## Short Term (This Week)

1. **Fix 7 tests**: Toast (4) + CSV (3) = 90% pass rate

2. **Run full suite**: `npm test -- --passWithNoTests`

3. **Verify**: No regressions (all 375 passing maintained)

## Medium Term (This Month)

1. **Reach 95%+**: Optional stretch goal
2. **Stabilize CI/CD**: Verify GitHub Actions workflow
3. **Document patterns**: Add to test guidelines

## Resources

- **Test Utilities**: `test-utils/renderWithProviders.js`
- **Mock Setup**: `__mocks__/` folder
- **Working Examples**: `__tests__/tabs-integration.test.jsx` (best example)
- **Error Analysis**: Each failing test shows exactly what's wrong

## Success Criteria

- [ ] Run first test fix locally
- [ ] No regressions
- [ ] 2+ tests passing
- [ ] Commit to PR
- [ ] Reach 90% (382/425) this week
