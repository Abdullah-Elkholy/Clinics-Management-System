import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import { AuthProvider, useAuth } from '../lib/auth'
import { rest } from 'msw'
import { server } from '../mocks/server'
import { renderWithProviders } from '../test-utils/renderWithProviders'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'

const TestComponent = () => {
  const { user, login, logout, isAuthenticated, isLoading } = useAuth()
  return (
    <div>
      <div data-testid="isAuthenticated">{isAuthenticated.toString()}</div>
      <div data-testid="isLoading">{isLoading.toString()}</div>
      <div data-testid="user">{user ? user.name : 'null'}</div>
      <button onClick={() => login('test-token')}>Login</button>
      <button onClick={() => logout()}>Logout</button>
    </div>
  )
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear()
    server.resetHandlers()
  })

  test('initial state is not authenticated', () => {
    renderWithProviders(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )
    expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false')
    expect(screen.getByTestId('isLoading')).toHaveTextContent('false')
    expect(screen.getByTestId('user')).toHaveTextContent('null')
  })

  test('login function sets token and fetches user', async () => {
    server.use(
      rest.get(`${API_BASE}/api/Auth/me`, (req, res, ctx) => {
        return res(ctx.json({ data: { id: '1', name: 'Test User', role: 'Admin' } }))
      })
    )

    renderWithProviders(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    act(() => {
      fireEvent.click(screen.getByText('Login'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true')
    })

    expect(localStorage.getItem('token')).toBe('test-token')
    expect(screen.getByTestId('user')).toHaveTextContent('Test User')
  })

  test('logout function clears token and user', async () => {
    server.use(
      rest.get(`${API_BASE}/api/Auth/me`, (req, res, ctx) => {
        return res(ctx.json({ data: { id: '1', name: 'Test User', role: 'Admin' } }))
      })
    )

    renderWithProviders(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    )

    act(() => {
      fireEvent.click(screen.getByText('Login'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('user')).toHaveTextContent('Test User')
    })

    act(() => {
      fireEvent.click(screen.getByText('Logout'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('false')
    })
    expect(localStorage.getItem('token')).toBeNull()
    expect(screen.getByTestId('user')).toHaveTextContent('null')
  })

  test('initializes with token from localStorage', async () => {
    server.use(
      rest.get(`${API_BASE}/api/Auth/me`, (req, res, ctx) => {
        return res(ctx.json({ data: { id: '1', name: 'Existing User', role: 'Admin' } }))
      })
    )

    renderWithProviders(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>,
      { localStorage: { token: 'existing-token' } }
    )

    await waitFor(() => {
      expect(screen.getByTestId('isAuthenticated')).toHaveTextContent('true')
    })
    expect(screen.getByTestId('user')).toHaveTextContent('Existing User')
  })
})
