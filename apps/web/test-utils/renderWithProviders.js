import React from 'react'
import { render } from '@testing-library/react'

// Provide a jest.mock for next/router that reads a global test router object.
// This factory is hoisted by Jest and must not reference out-of-scope variables.

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

export function renderWithProviders(ui, { localStorage = {}, router = createMockRouter(), wrapper: WrapperComponent, ...options } = {}){
  // Mock window.matchMedia for Tailwind/Next.js compatibility
  if (typeof window !== 'undefined' && !window.matchMedia) {
    window.matchMedia = function() {
      return {
        matches: false,
        addListener: function() {},
        removeListener: function() {},
        addEventListener: function() {},
        removeEventListener: function() {},
        dispatchEvent: function() {},
      };
    };
  }
  // seed localStorage
  Object.entries(localStorage).forEach(([k,v])=>{
    try{ window.localStorage.setItem(k, v) }catch(e){}
  })

  // set the global router so the hoisted mock returns this router
  global.__TEST_ROUTER__ = router

  // Always create a root div for rendering
  // Always use a fresh root for each render to avoid reusing an unmounted root
  const existing = document.getElementById('test-root');
  if (existing) {
    existing.remove();
  }
  const root = document.createElement('div');
  root.id = 'test-root';
  document.body.appendChild(root);

  function Wrapper({ children }){
    const base = (<>{children}</>);
    if (WrapperComponent) return <WrapperComponent>{base}</WrapperComponent>;
    return base;
  }

  return render(ui, { wrapper: Wrapper, container: root, ...options });
}

export default renderWithProviders
