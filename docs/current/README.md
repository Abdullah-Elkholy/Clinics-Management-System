# QUICK START

**Status**: 375/425 (88.2%) ✅

## In 2 Minutes

1. Read: `docs/current/STATUS.md`
2. Command: `cd apps/web && npm test -- --passWithNoTests`
3. Pick: Priority 1 from `docs/current/FAILING_TESTS.md`

## In 5 Minutes

1. Read: `docs/current/RUNNING_TESTS.md` (commands)
2. Read: `docs/current/FAILING_TESTS.md` (what's broken)
3. Read: `docs/current/NEXT_STEPS.md` (what to do)

## In 30 Minutes

1. Run failing test locally
2. Check test-utils/renderWithProviders.js (key utility)
3. Look at __tests__/tabs-integration.test.jsx (working example)
4. Understand the pattern
5. Start fixing

## Commands Cheat Sheet

```bash
# Run all tests
npm test -- --passWithNoTests --testTimeout=10000

# Run one suite
npm test -- dashboard-error-handling.test.jsx

# With coverage
npm test -- --coverage --watchAll=false

# Watch mode
npm test -- --watch
```

## Key Files

- `docs/current/STATUS.md` - Current metrics
- `docs/current/RUNNING_TESTS.md` - How to run tests
- `docs/current/FAILING_TESTS.md` - What's broken + how to fix
- `docs/current/NEXT_STEPS.md` - What to do next
- `test-utils/renderWithProviders.js` - Main test utility
- `__tests__/tabs-integration.test.jsx` - Best working example

## That's It!

Everything else is archived or deleted. No ocean of docs. Just these 4 pages.
