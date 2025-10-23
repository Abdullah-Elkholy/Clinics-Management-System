import '@testing-library/jest-dom';

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

// Mock localStorage
// Create a proper localStorage mock
const createStorageMock = () => {
  let storage = {};
  return {
    getItem: jest.fn((key) => storage[key] || null),
    setItem: jest.fn((key, value) => {
      storage[key] = value;
    }),
    removeItem: jest.fn((key) => {
      delete storage[key];
    }),
    clear: jest.fn(() => {
      storage = {};
    })
  };
};

Object.defineProperty(window, 'localStorage', {
  value: createStorageMock()
});

// Mock window.matchMedia (needed for responsive tests)
window.matchMedia = window.matchMedia || function(query) {
  return {
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  };
};

// Start MSW server before all tests
beforeAll(() => server.listen())

// Reset handlers and mock data after each test
afterEach(() => {
  server.resetHandlers()
  resetMockData()
  cleanup()
  // Clear all localStorage mocks
  localStorage.getItem.mockClear()
  localStorage.setItem.mockClear()
  localStorage.removeItem.mockClear()
  localStorage.clear.mockClear()
})

// Close server after all tests
afterAll(() => server.close())

jest.mock('./lib/i18n', () => ({
  ...jest.requireActual('./lib/i18n'),
  useI18n: () => {
    // Load Arabic bundle for tests so components receive localized strings
    // which many tests assert on.
    const bundles = {
      en: require('./locales/en.json'),
      ar: require('./locales/ar.json'),
    }
    const locale = 'ar'
    const bundle = bundles[locale]
    return {
      t: (key, defaultText, options) => {
        // First try to get the translation from the bundle
        let text = bundle[key]
        // If no translation found and defaultText provided, use that
        if (!text && defaultText) {
          text = defaultText
        }
        // If still no text, use the key as fallback
        if (!text) {
          text = key
        }
        // Apply any interpolation options
        if (options) {
          text = Object.entries(options).reduce(
            (acc, [optKey, optVal]) => acc.replace(`{${optKey}}`, optVal),
            text
          )
        }
        return text
      },
      setLocale: jest.fn(),
      getLocale: () => locale,
      getDir: () => 'rtl',
      initLocaleFromBrowser: jest.fn(),
    }
  },
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

