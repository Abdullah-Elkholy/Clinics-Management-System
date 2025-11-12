/**
 * Frontend Test Setup
 * Initializes React Testing Library, mocks external dependencies (toast, file APIs, router)
 * and polyfills for jsdom environment.
 */

import '@testing-library/jest-dom';
import React from 'react';

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

// Mock Fetch for API calls
global.fetch = jest.fn(async (url: string, options?: any) => {
  // Default mock response; override in specific tests
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    url: url || '',
    type: 'basic' as ResponseType,
    redirected: false,
    json: async () => ({ success: true, data: {} }),
    text: async () => '{}',
    blob: async () => new Blob(),
    arrayBuffer: async () => new ArrayBuffer(0),
    clone: jest.fn(),
    headers: new Headers(),
  } as unknown as Response;
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
        args[0].includes('Not implemented: HTMLFormElement.prototype.submit'))
    ) {
      return;
    }
    originalError(...args);
  });

  console.warn = jest.fn((...args: any[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('componentWillReceiveProps') ||
        args[0].includes('componentWillMount'))
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
