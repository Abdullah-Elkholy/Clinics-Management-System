import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { rest } from 'msw'
import { server } from '../mocks/server'
import LoginPage from '../pages/login'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import { createMockRouter } from '../test-utils/renderWithProviders'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'

describe('LoginPage', () => {
  test('renders login form correctly', () => {
    renderWithProviders(<LoginPage />)
    expect(screen.getByLabelText(/اسم المستخدم/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/كلمة المرور/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /تسجيل الدخول/i })).toBeInTheDocument()
  })

  test('allows user to type in username and password', () => {
    renderWithProviders(<LoginPage />)
    const usernameInput = screen.getByLabelText(/اسم المستخدم/i)
    const passwordInput = screen.getByLabelText(/كلمة المرور/i)

    fireEvent.change(usernameInput, { target: { value: 'testuser' } })
    fireEvent.change(passwordInput, { target: { value: 'password123' } })

    expect(usernameInput.value).toBe('testuser')
    expect(passwordInput.value).toBe('password123')
  })

  test('shows loading state when login button is clicked', async () => {
    renderWithProviders(<LoginPage />)
    fireEvent.change(screen.getByLabelText(/اسم المستخدم/i), { target: { value: 'testuser' } })
    fireEvent.change(screen.getByLabelText(/كلمة المرور/i), { target: { value: 'password123' } })
    
    const loginButton = screen.getByRole('button', { name: /تسجيل الدخول/i })
    fireEvent.click(loginButton)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /جارٍ تسجيل الدخول/i })).toBeDisabled()
    })
  })

  test('handles successful login and redirects', async () => {
    const router = createMockRouter()
    renderWithProviders(<LoginPage />, { router })

    fireEvent.change(screen.getByLabelText(/اسم المستخدم/i), { target: { value: 'admin' } })
    fireEvent.change(screen.getByLabelText(/كلمة المرور/i), { target: { value: 'Admin123!' } })
    fireEvent.click(screen.getByRole('button', { name: /تسجيل الدخول/i }))

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith('/dashboard')
    })
    
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('تم تسجيل الدخول بنجاح')
  })

  test('handles failed login and shows error toast', async () => {
    server.use(
      rest.post(`${API_BASE}/api/auth/login`, (req, res, ctx) => {
        return res(ctx.status(401), ctx.json({ message: 'Invalid credentials' }))
      })
    )

    renderWithProviders(<LoginPage />)

    fireEvent.change(screen.getByLabelText(/اسم المستخدم/i), { target: { value: 'wronguser' } })
    fireEvent.change(screen.getByLabelText(/كلمة المرور/i), { target: { value: 'wrongpassword' } })
    fireEvent.click(screen.getByRole('button', { name: /تسجيل الدخول/i }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('فشل تسجيل الدخول')
  })
})
