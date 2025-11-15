/**
 * Frontend Test Setup
 * Initializes React Testing Library, mocks external dependencies (toast, file APIs, router)
 * and polyfills for jsdom environment.
 */
/* eslint-disable no-console */

import '@testing-library/jest-dom';
// Polyfill fetch in Jest (jsdom)
import 'whatwg-fetch';
import { TextDecoder as NodeTextDecoder, TextEncoder as NodeTextEncoder } from 'util';
import { server, resetMswDb } from './msw/server';

type FileCtor = new (
  fileBits?: BlobPart[],
  fileName?: string,
  options?: FilePropertyBag
) => File;

type GlobalWithPolyfills = typeof globalThis & {
  TextDecoder?: typeof NodeTextDecoder;
  TextEncoder?: typeof NodeTextEncoder;
  File?: FileCtor;
};

const globalWithPolyfills = globalThis as GlobalWithPolyfills;

if (typeof globalWithPolyfills.TextDecoder === 'undefined') {
  globalWithPolyfills.TextDecoder = NodeTextDecoder;
}

if (typeof globalWithPolyfills.TextEncoder === 'undefined') {
  globalWithPolyfills.TextEncoder = NodeTextEncoder;
}

type ToastPromiseMessages = {
  loading?: unknown;
  success?: unknown;
  error?: unknown;
};

const createToastApi = () => ({
  success: jest.fn((message: unknown) => message),
  error: jest.fn((message: unknown) => message),
  loading: jest.fn((message: unknown) => message),
  promise: jest.fn((promise: Promise<unknown>, _msgs?: ToastPromiseMessages) => promise),
  custom: jest.fn(),
});

// Mock react-hot-toast
jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: createToastApi(),
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
  toast: createToastApi(),
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

const computeMockFileSize = (parts: BlobPart[]): number =>
  parts.reduce((acc, part) => {
    if (typeof part === 'string') {
      return acc + part.length;
    }

    if (part instanceof ArrayBuffer) {
      return acc + part.byteLength;
    }

    if (ArrayBuffer.isView(part)) {
      return acc + part.byteLength;
    }

    if (typeof Blob !== 'undefined' && part instanceof Blob) {
      return acc + part.size;
    }

    return acc;
  }, 0);

if (typeof globalWithPolyfills.File === 'undefined') {
  if (typeof Blob !== 'undefined') {
    class MockFile extends Blob {
      readonly lastModified: number;
      readonly name: string;
      readonly webkitRelativePath = '';

      constructor(parts: BlobPart[] = [], filename = 'mock-file', options: FilePropertyBag = {}) {
        super(parts, options);
        this.name = filename;
        this.lastModified = options.lastModified ?? Date.now();
      }
    }

    globalWithPolyfills.File = MockFile as unknown as FileCtor;
  } else {
    const MockFileFallback = function (
      this: unknown,
      parts: BlobPart[] = [],
      filename = 'mock-file',
      options: FilePropertyBag = {}
    ): File {
      const content = parts
        .map((part) => (typeof part === 'string' ? part : String(part)))
        .join('');

      const fileLike = {
        name: filename,
        size: computeMockFileSize(parts),
        type: options.type ?? '',
        lastModified: options.lastModified ?? Date.now(),
        webkitRelativePath: '',
        slice: jest.fn<Blob, []>(() => ({}) as Blob),
        stream: jest.fn<ReadableStream<Uint8Array>, []>(
          () =>
            new ReadableStream<Uint8Array>({
              start(controller) {
                controller.close();
              },
            })
        ),
        text: jest.fn<Promise<string>, []>(async () => content),
        arrayBuffer: jest.fn<Promise<ArrayBuffer>, []>(async () => new ArrayBuffer(0)),
        [Symbol.toStringTag]: 'File',
      };

      return fileLike as unknown as File;
    };

    globalWithPolyfills.File = MockFileFallback as unknown as FileCtor;
  }
}

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
  console.error = jest.fn((...args: unknown[]) => {
    // Suppress known non-critical React warnings
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('Warning: ReactDOM.render') ||
        args[0].includes('Not implemented: HTMLFormElement.prototype.submit') ||
        args[0].includes('Base64 decoding failed'))
    ) {
      return;
    }
    originalError(...(args as Parameters<typeof originalError>));
  });

  console.warn = jest.fn((...args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('componentWillReceiveProps') ||
        args[0].includes('componentWillMount') ||
        args[0].includes('Failed to load queues from API:'))
    ) {
      return;
    }
    originalWarn(...(args as Parameters<typeof originalWarn>));
  });
});

afterAll(() => {
  console.error = originalError;
  console.warn = originalWarn;
});

export {};
