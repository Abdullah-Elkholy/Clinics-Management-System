import '@testing-library/jest-dom'
import { server } from './mocks/server'
import { resetMockData } from './mocks/handlers'
import { cleanup } from '@testing-library/react';
import { QueryClient } from '@tanstack/react-query';

const testQueryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

jest.mock('./lib/i18n', () => ({
  ...jest.requireActual('./lib/i18n'),
  useI18n: () => ({
    t: (key, defaultText, options) => {
      if (defaultText && options) {
        return Object.entries(options).reduce(
          (acc, [optKey, optVal]) => acc.replace(`{${optKey}}`, optVal),
          defaultText
        );
      }
      return defaultText || key;
    },
    setLocale: jest.fn(),
    getLocale: () => 'ar',
    getDir: () => 'rtl',
    initLocaleFromBrowser: jest.fn(),
  }),
}));

// Start MSW before all tests and stop after
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
// Reset in-memory mock data before each test for deterministic state
beforeEach(() => {
  resetMockData();
  testQueryClient.clear();
})
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// helper to pre-seed localStorage
global.seedLocalStorage = function (items = {}){
	Object.keys(items).forEach(k => {
		try { localStorage.setItem(k, items[k]) } catch(e) {}
	})
}

// accessibility helper
import { axe, toHaveNoViolations } from 'jest-axe'
expect.extend(toHaveNoViolations)
global.axe = axe

// polyfill fetch for node tests
// polyfill fetch, Request, Headers, Response for node tests
import 'cross-fetch/polyfill'

// stub/override window.alert used by some components (jsdom's default throws)
if (typeof window !== 'undefined') {
	window.alert = () => {}
}

// In case a test leaves a lingering toast, we can attempt to clear it.
// This is a bit of a hack, but it can help with test stability.
function clearToasts() {
  if (typeof globalThis !== 'undefined' && globalThis.__CLINICS_TOAST__) {
    const mgr = globalThis.__CLINICS_TOAST__;
    if (mgr.pending) {
      mgr.pending = [];
    }
    // We can't directly clear the state of the React component,
    // but we can prevent new toasts from being shown by nullifying the showImpl
    // and we can try to advance timers to clear existing ones if jest.useFakeTimers() is active.
    try {
      // Check if fake timers are in use before trying to advance them
      if (typeof jest !== 'undefined' && typeof setTimeout.mock !== 'undefined' && jest.advanceTimersByTime) {
        jest.advanceTimersByTime(10000); // Clear all pending toasts
      }
    } catch (e) {
      // ignore
    }
  }
}

afterEach(() => {
  cleanup();
  clearToasts();
  server.resetHandlers();
});

