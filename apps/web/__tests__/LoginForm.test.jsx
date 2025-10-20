import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// Mock Next router
jest.mock('next/router', () => ({ useRouter: () => ({ push: jest.fn() }) }))

// Mock api before importing the component so it picks up the mocked module
jest.mock('../lib/api', () => ({
  __esModule: true,
  default: {
    post: jest.fn(async (path, body) => {
      if (path === '/api/Auth/login' && body.username === 'admin' && body.password === 'admin123') {
        return { data: { success: true, data: { accessToken: 'fake-token' } } }
      }
      return { data: { success: false } }
    })
  }
}))
import LoginForm from '../components/auth/LoginForm'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import { useAuth } from '../lib/auth'

jest.mock('../lib/auth', () => ({
  ...jest.requireActual('../lib/auth'),
  useAuth: () => ({
    login: jest.fn(),
  }),
}))

describe('LoginForm', () => {
  test('renders and logs in successfully', async () => {
    const { container } = renderWithProviders(<LoginForm />)
    const userInput = screen.getByPlaceholderText(/أدخل اسم المستخدم/i)
    const passInput = screen.getByPlaceholderText(/أدخل كلمة المرور/i)
    const btn = screen.getByRole('button', { name: /تسجيل الدخول/i })

    fireEvent.change(userInput, { target: { value: 'admin' } })
    fireEvent.change(passInput, { target: { value: 'admin123' } })
    fireEvent.click(btn)

    await waitFor(() => {
      expect(useAuth().login).toHaveBeenCalledWith('fake-token')
    })

    // a11y: quick axe check for regressions
    const results = await global.axe(container)
    expect(results).toHaveNoViolations()
  })
})
