import React from 'react'
// Hoisted mock for next/router so modules that import it at load-time
// (like ../lib/auth) see the mocked router during tests.
jest.mock('next/router', () => ({
  useRouter: () => (global.__TEST_ROUTER__ || {
    basePath: '',
    pathname: '/',
    route: '/',
    query: {},
    asPath: '/',
    push: jest.fn(),
    replace: jest.fn(),
    reload: jest.fn(),
    back: jest.fn(),
    prefetch: jest.fn().mockResolvedValue(null),
    beforePopState: jest.fn(),
    isFallback: false,
  })
}))
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from '../lib/i18n';
import { RouterContext } from 'next/dist/shared/lib/router-context.shared-runtime';

const defaultRouter = {
  basePath: '',
  pathname: '/',
  route: '/',
  query: {},
  asPath: '/',
  push: jest.fn(),
  replace: jest.fn(),
  reload: jest.fn(),
  back: jest.fn(),
  prefetch: jest.fn().mockResolvedValue(null),
  beforePopState: jest.fn(),
  isFallback: false,
}

export function createMockRouter(overrides) {
  return { ...defaultRouter, ...overrides }
}

export function renderWithProviders(ui, { 
  localStorage: storage = {}, 
  router: routerConfig = createMockRouter(), 
  wrapper: WrapperComponent, 
  auth,
  ...options 
} = {}){
  // Ensure tests can override the router via global.__TEST_ROUTER__ or by
  // passing a routerConfig. We don't call jest.mock here because mocks must
  // be hoisted; instead, set the global for the mock above to read.
  global.__TEST_ROUTER__ = routerConfig

  // Mock window.matchMedia for Tailwind/Next.js compatibility
  if (typeof window !== 'undefined' && !window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(), // deprecated
        removeListener: jest.fn(), // deprecated
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  }

  // Mock localStorage for tests
  const mockLocalStorage = (() => {
    let store = { ...storage };
    return {
      getItem: jest.fn((key) => store[key] || null),
      setItem: jest.fn((key, value) => {
        store[key] = value.toString();
      }),
      removeItem: jest.fn((key) => {
        delete store[key];
      }),
      clear: jest.fn(() => {
        store = {};
      }),
    };
  })();
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', { value: mockLocalStorage, configurable: true, writable: true });
  }

  // Set up QueryClient with v5 configuration
  const testQueryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
    logger: {
      error: () => {},
      warn: () => {},
      log: () => {}
    }
  })

  function AllTheProviders({ children }) {
    const authProviderProps = auth ? { initialUser: auth.user } : {};
    const i18nInitialLocale = storage.locale || 'ar';
    // Resolve AuthProvider at runtime so tests that mock ../lib/auth can
    // replace/use only parts of the module (e.g. useAuth) without breaking
    // this helper. If AuthProvider isn't available (mocked tests), use a
    // passthrough provider.
    let ResolvedAuthProvider
    try {
      // Use require so Jest's module mocking can take effect
      // eslint-disable-next-line global-require
      ResolvedAuthProvider = require('../lib/auth').AuthProvider
    } catch (e) {
      ResolvedAuthProvider = undefined
    }

    const MaybeAuthProvider = ResolvedAuthProvider && typeof ResolvedAuthProvider === 'function'
      ? ResolvedAuthProvider
      : ({ children: c }) => c

    // Small in-test toast renderer: it listens for the 'clinics:show-toast'
    // CustomEvent and renders simple messages. This ensures tests can
    // observe toast output even when the real Toast component is mocked out.
    function TestToastRenderer() {
      const [msgs, setMsgs] = React.useState([])
      React.useEffect(() => {
        const handler = (e) => setMsgs((m) => [...m, e.detail || e])
        window.addEventListener('clinics:show-toast', handler)
        return () => window.removeEventListener('clinics:show-toast', handler)
      }, [])
      if (!msgs.length) return null
      return (
        <div aria-live="polite">
          {msgs.map((t) => (
            <div key={t.id || Math.random()} role="alert">{t.message}</div>
          ))}
        </div>
      )
    }

    return (
      <QueryClientProvider client={testQueryClient}>
        <RouterContext.Provider value={routerConfig}>
          <I18nProvider initialLocale={i18nInitialLocale}>
            <MaybeAuthProvider {...authProviderProps}>
              {WrapperComponent ? <WrapperComponent>{children}</WrapperComponent> : children}
            </MaybeAuthProvider>
            <TestToastRenderer />
          </I18nProvider>
        </RouterContext.Provider>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: AllTheProviders, ...options })
}

export async function waitForMSW(server, method, url) {
  return new Promise((resolve) => {
    server.events.on('request:end', (req) => {
      if (req.method.toLowerCase() === method.toLowerCase() && req.url.pathname === url) {
        resolve(req)
      }
    })
  })
}

export default renderWithProviders

