# RUNNING TESTS

## Quick Commands

```bash
# Run all tests
cd apps/web && npm test -- --passWithNoTests --testTimeout=10000

# Run with coverage
npm test -- --coverage --watchAll=false

# Run specific test
npm test -- dashboard-error-handling.test.jsx

# Watch mode
npm test -- --watch
```

## Test Structure

```
apps/web/
├── __tests__/
│   ├── [30+ passing tests]
│   ├── [22 failing suites with 50 tests]
│   └── [All component/integration tests]
├── test-utils/
│   └── renderWithProviders.js (main utility)
├── __mocks__/
│   └── [Mock setup]
└── components/
    └── [Component files]
```

## Key Utilities

- **renderWithProviders**: Use this for all tests (has all mocks)
- **MSW Server**: API mocking via beforeAll hooks
- **localStorage**: Mocked via renderWithProviders options
- **next/router**: Hoisted jest.mock before imports

## Common Issues

| Problem | Solution |
|---------|----------|
| "NextRouter not mounted" | Use renderWithProviders from test-utils |
| Toast not appearing | Verify toast mock in test setup |
| File upload failing | Check MSW multipart/form-data handler |
| Timeout errors | Use `await waitFor()` for async |
