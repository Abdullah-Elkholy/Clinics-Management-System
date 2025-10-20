import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import LoginForm from '../components/auth/LoginForm'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import { useAuth } from '../lib/auth'
import api from '../lib/api'

// Mock Next router
jest.mock('next/router', () => ({ useRouter: () => ({ push: jest.fn() }) }))

// Mock api
jest.mock('../lib/api')

// Mock useAuth
jest.mock('../lib/auth', () => ({
  useAuth: jest.fn(),
}))

describe('LoginForm', () => {
  let loginMock

  beforeEach(() => {
    loginMock = jest.fn()
    useAuth.mockReturnValue({
      login: loginMock,
    })
    api.post.mockClear()
  })

  test('renders and logs in successfully', async () => {
    api.post.mockResolvedValue({ data: { success: true, data: { accessToken: 'fake-token' } } })

    const { container } = renderWithProviders(<LoginForm />)

    const userInput = await screen.findByPlaceholderText(/أدخل اسم المستخدم/i)
    const passInput = await screen.findByPlaceholderText(/أدخل كلمة المرور/i)
    const btn = await screen.findByRole('button', { name: /تسجيل الدخول/i })

    fireEvent.change(userInput, { target: { value: 'admin' } })
    fireEvent.change(passInput, { target: { value: 'admin123' } })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/Auth/login', {
        username: 'admin',
        password: 'admin123',
      })
    })

    await waitFor(() => {
      expect(loginMock).toHaveBeenCalledWith('fake-token')
    })

    // a11y: quick axe check for regressions
    const results = await global.axe(container)
    expect(results).toHaveNoViolations()
  })

  test('shows error on failed login', async () => {
    api.post.mockResolvedValue({ data: { success: false, message: 'Invalid credentials' } })

    renderWithProviders(<LoginForm />)

    const userInput = await screen.findByPlaceholderText(/أدخل اسم المستخدم/i)
    const passInput = await screen.findByPlaceholderText(/أدخل كلمة المرور/i)
    const btn = await screen.findByRole('button', { name: /تسجيل الدخول/i })

    fireEvent.change(userInput, { target: { value: 'wrong' } })
    fireEvent.change(passInput, { target: { value: 'user' } })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/api/Auth/login', {
        username: 'wrong',
        password: 'user',
      })
    })

    expect(loginMock).not.toHaveBeenCalled()
    // You could also test for an error message being displayed, if the component does that.
  })
})
