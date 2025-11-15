/**
 * Frontend Test Setup
 * Initializes React Testing Library, mocks external dependencies (toast, file APIs, router)
 * and polyfills for jsdom environment.
 */

import '@testing-library/jest-dom';
import React from 'react';
// Polyfill fetch in Jest (jsdom)
import 'whatwg-fetch';
import { server, resetMswDb } from './msw/server';

// Polyfill TextEncoder/TextDecoder for Node test environment (JWT decoding, etc.)
try {
  // @ts-ignore
  if (typeof TextDecoder === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { TextDecoder } = require('util');
    (global as any).TextDecoder = TextDecoder;
  }
  // @ts-ignore
  if (typeof TextEncoder === 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { TextEncoder } = require('util');
    (global as any).TextEncoder = TextEncoder;
  }
} catch {
  // noop – best-effort polyfill
}

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: {
    success: jest.fn((message: string) => message),
    error: jest.fn((message: string) => message),
    loading: jest.fn((message: string) => message),
    promise: jest.fn((promise: Promise<any>, msgs: any) => promise),
    custom: jest.fn(),
  },
  Toaster: () => null,
  useToaster: () => ({
    toasts: [],
    handlers: {
      startPause: jest.fn(),
      endPause: jest.fn(),
      calculateOffset: jest.fn(),
      updateHeight: jest.fn(),
    },
  }),
  toast: {
    success: jest.fn((message: string) => message),
    error: jest.fn((message: string) => message),
    loading: jest.fn((message: string) => message),
    promise: jest.fn((promise: Promise<any>, msgs: any) => promise),
    custom: jest.fn(),
  },
}));

// Mock Next.js router
jest.mock('next/router', () => ({
  __esModule: true,
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    reload: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn(),
    query: {},
    pathname: '/',
    route: '/',
    asPath: '/',
  })),
}));

// Mock Next.js navigation (for app router)
jest.mock('next/navigation', () => ({
  __esModule: true,
  useRouter: jest.fn(() => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  })),
  usePathname: jest.fn(() => '/'),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}));

// Mock File API for CSV import tests
global.File = jest.fn((parts, filename, options) => ({
  name: filename,
  size: parts.reduce((acc: number, part: any) => acc + (part?.length || 0), 0),
  type: options?.type || '',
  slice: jest.fn(),
  stream: jest.fn(),
  text: jest.fn(async () => parts.join('')),
  arrayBuffer: jest.fn(async () => new ArrayBuffer(0)),
})) as any;

// Start MSW for network interception in tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'bypass' });
});

afterEach(() => {
  server.resetHandlers();
  // Also reset in-memory MSW DB to initial state to avoid cross-test leakage
  resetMswDb();
});

afterAll(() => {
  server.close();
});

// Mock ResizeObserver (used in some components)
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Suppress console errors and warnings in tests (optional; comment out if debugging)
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  console.error = jest.fn((...args: any[]) => {
    // Suppress known non-critical React warnings
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
        args[0].includes('Not implemented: HTMLFormElement.prototype.submit') ||
        args[0].includes('Base64 decoding failed'))
    ) {
      return;
    }
    originalError(...args);
  });

  console.warn = jest.fn((...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('componentWillReceiveProps') ||
        args[0].includes('componentWillMount') ||
        args[0].includes('Failed to load queues from API:'))
    ) {
      return;
    }
    originalWarn(...args);
  });
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

export {};
