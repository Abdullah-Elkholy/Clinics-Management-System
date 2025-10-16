import React from 'react'
import { render } from '@testing-library/react'

export function createMockRouter(overrides) {
  return {
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
    ...overrides,
  }
}

export function renderWithRouter(ui, { router = createMockRouter(), ...renderOptions } = {}) {
  function Wrapper({ children }){ return <>{children}</> }
  return { ...render(ui, { wrapper: Wrapper, ...renderOptions }), router }
}

export default renderWithRouter
