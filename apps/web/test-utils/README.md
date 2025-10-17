Minimal test utilities

This folder contains small helpers used by unit/integration tests.

- MinimalDashboard.jsx — A tiny deterministic component used by lightweight tests to avoid importing the full Next.js page and triggering async effects.

Usage:
- Import MinimalDashboard in tests where you need a deterministic dashboard placeholder:
  import { MinimalDashboard } from '__tests__/test-utils/MinimalDashboard'

Notes:
- Keep this file minimal; it exists purely for test stability.
