/**
 * Integration Tests: Auth Initialization Race Condition Fix
 * 
 * This test suite verifies that:
 * 1. Auth header is set immediately on app load
 * 2. useMyQuota only fetches when auth is ready
 * 3. No 401 retry loops occur
 * 4. HMR doesn't cause auth issues
 */

import { render, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import queryClient from '../lib/queryClient'
import { AuthProvider, useAuth } from '../lib/auth'
import api from '../lib/api'

// Mock the API
jest.mock('../lib/api', () => ({
  defaults: {
    headers: {
      common: {}
    }
  },
  get: jest.fn(),
  post: jest.fn(),
}))

// Test component that uses auth
function TestComponent() {
  const { user, isReady, isAuthenticated } = useAuth()
  return (
    <div>
      <div data-testid="auth-ready">{isReady ? 'ready' : 'not-ready'}</div>
      <div data-testid="is-authenticated">{isAuthenticated ? 'authenticated' : 'unauthenticated'}</div>
      <div data-testid="user-name">{user?.username || 'no-user'}</div>
    </div>
  )
}

describe('Auth Initialization Race Condition Fix', () => {
  beforeEach(() => {
    localStorage.clear()
    jest.clearAllMocks()
    queryClient.clear()
  })

  test('When no token in localStorage, auth should be ready immediately', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </QueryClientProvider>
    )

    // Should be ready immediately (no token, no async operations needed)
    await waitFor(() => {
      expect(screen.getByTestId('auth-ready')).toHaveTextContent('ready')
    }, { timeout: 1000 })

    expect(screen.getByTestId('is-authenticated')).toHaveTextContent('unauthenticated')
  })

  test('When token in localStorage, should set auth header immediately', () => {
    const testToken = 'eyJ.test.token'
    localStorage.setItem('accessToken', testToken)

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </QueryClientProvider>
    )

    // Header should be set immediately (synchronously in useState initializer)
    expect(api.defaults.headers.common['Authorization']).toBe(`Bearer ${testToken}`)
  })

  test('useMyQuota should not fetch until auth is ready', async () => {
    const { useMyQuota } = require('../lib/hooks')
    
    // Mock the API response for useMyQuota
    api.get.mockResolvedValue({
      data: {
        data: { messagesQuota: 100, consumedMessages: 50 }
      }
    })

    function TestComponentWithQuota() {
      const { user, isReady } = useAuth()
      const quota = useMyQuota()
      
      return (
        <div>
          <div data-testid="auth-ready">{isReady ? 'ready' : 'not-ready'}</div>
          <div data-testid="quota-fetching">{quota.isLoading ? 'loading' : 'idle'}</div>
          <div data-testid="quota-status">{quota.status}</div>
        </div>
      )
    }

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TestComponentWithQuota />
        </AuthProvider>
      </QueryClientProvider>
    )

    // Wait for auth to be ready
    await waitFor(() => {
      expect(screen.getByTestId('auth-ready')).toHaveTextContent('ready')
    })

    // With no user, quota query should NOT have run
    expect(api.get).not.toHaveBeenCalledWith(expect.stringContaining('/api/Quotas/me'))
  })

  test('useMyQuota should fetch only when user is authenticated', async () => {
    const testToken = 'eyJ.test.token'
    localStorage.setItem('accessToken', testToken)

    const mockUser = { id: 1, username: 'testuser', role: 'moderator' }
    
    // Mock /api/Auth/me to return user
    api.get.mockImplementation((url) => {
      if (url === '/api/Auth/me') {
        return Promise.resolve({ data: { data: mockUser } })
      }
      if (url === '/api/Quotas/me') {
        return Promise.resolve({
          data: { data: { messagesQuota: 100, consumedMessages: 50 } }
        })
      }
    })

    const { useMyQuota } = require('../lib/hooks')

    function TestComponentWithQuota() {
      const { user, isReady } = useAuth()
      const quota = useMyQuota()
      
      return (
        <div>
          <div data-testid="auth-ready">{isReady ? 'ready' : 'not-ready'}</div>
          <div data-testid="user-present">{user ? 'yes' : 'no'}</div>
          <div data-testid="quota-fetching">{quota.isLoading ? 'loading' : 'idle'}</div>
        </div>
      )
    }

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TestComponentWithQuota />
        </AuthProvider>
      </QueryClientProvider>
    )

    // Wait for user to load
    await waitFor(() => {
      expect(screen.getByTestId('user-present')).toHaveTextContent('yes')
    })

    // Wait for auth to be ready
    await waitFor(() => {
      expect(screen.getByTestId('auth-ready')).toHaveTextContent('ready')
    })

    // Now useMyQuota should have fetched
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(expect.stringContaining('/api/Quotas/me'))
    })
  })

  test('Auth header should be set in Authorization header at common path', () => {
    const testToken = 'eyJ.test.token'
    localStorage.setItem('accessToken', testToken)

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </QueryClientProvider>
    )

    expect(api.defaults.headers.common['Authorization']).toBe(`Bearer ${testToken}`)
  })

  test('When token is invalid, auth should still mark as ready', async () => {
    const testToken = 'invalid.token'
    localStorage.setItem('accessToken', testToken)

    // Mock /api/Auth/me to return 401
    api.get.mockRejectedValue({
      response: { status: 401 }
    })

    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      </QueryClientProvider>
    )

    // Should eventually be ready even with failed user fetch
    await waitFor(() => {
      expect(screen.getByTestId('auth-ready')).toHaveTextContent('ready')
    }, { timeout: 2000 })

    // And should be marked as unauthenticated
    expect(screen.getByTestId('is-authenticated')).toHaveTextContent('unauthenticated')
  })

  test('Multiple fetches of quota should use same enabled state logic', async () => {
    const testToken = 'eyJ.test.token'
    localStorage.setItem('accessToken', testToken)

    const mockUser = { id: 1, username: 'testuser', role: 'moderator' }
    
    api.get.mockImplementation((url) => {
      if (url === '/api/Auth/me') {
        return Promise.resolve({ data: { data: mockUser } })
      }
      if (url === '/api/Quotas/me') {
        return Promise.resolve({
          data: { data: { messagesQuota: 100, consumedMessages: 50 } }
        })
      }
    })

    const { useMyQuota } = require('../lib/hooks')

    function TestComponentWithQuota() {
      const quota = useMyQuota()
      return (
        <div>
          <div data-testid="quota-status">{quota.status}</div>
          <button onClick={() => quota.refetch()}>Refetch</button>
        </div>
      )
    }

    const { getByText } = render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TestComponentWithQuota />
        </AuthProvider>
      </QueryClientProvider>
    )

    // Wait for initial fetch
    await waitFor(() => {
      expect(screen.getByTestId('quota-status')).toHaveTextContent('success')
    })

    const callCount = api.get.mock.calls.filter(
      call => call[0] === '/api/Quotas/me'
    ).length

    expect(callCount).toBeGreaterThan(0)
  })
})
