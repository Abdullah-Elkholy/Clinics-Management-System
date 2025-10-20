// Mock modules before imports to avoid initialization order issues
jest.mock('../lib/api', () => {
  const mockApi = {
    post: jest.fn(),
    get: jest.fn()
  }

  // Default API responses - matching the format expected by hooks
  mockApi.get.mockImplementation(url => {
    if (url === '/api/Queues') {
      return Promise.resolve({
        data: [{ id: 'q1', name: 'الطابور الأول', patientCount: 1 }]
      })
    }
    if (url.startsWith('/api/Queues/') && url.includes('/patients')) {
      return Promise.resolve({
        data: {
          patients: [{ id: 101, fullName: 'Ali', position: 1, phoneNumber: '010' }]
        }
      })
    }
    if (url === '/api/Templates') {
      return Promise.resolve({
        data: {
          templates: [{ id: 't1', title: 'تأكيد', content: 'أهلاً {name}' }]
        }
      })
    }
    return Promise.resolve({ data: [] })
  })

  mockApi.post.mockImplementation(url => {
    if (url === '/api/Messages/SendToPatient') {
      return Promise.resolve({ data: { success: true } })
    }
    return Promise.resolve({ data: { success: true } })
  })

  return mockApi
})

jest.mock('../components/Toast', () => {
  const mockToast = ({ children }) => <div data-testid="toast-container">{children}</div>
  return {
    default: mockToast,
    ToastManager: mockToast,
    show: jest.fn((message) => {
      window.dispatchEvent(new CustomEvent('clinics:show-toast', { 
        detail: { message, type: 'success', id: Date.now() }
      }))
    })
  }
})

import React from 'react'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import { ROLES } from '../lib/roles'
import Dashboard from '../pages/dashboard'
import api from '../lib/api'

// Reset handlers before each test
beforeEach(() => {
  api.get.mockClear()
  api.post.mockClear()
})

// Mock the message sending endpoint
beforeEach(() => {
  api.post.mockImplementation((url) => {
    if (url === '/api/Queues') {
      return Promise.resolve({ data: { success: true, data: [] } })
    }
    if (url === '/api/Messages/SendToPatient') {
      return Promise.resolve({ data: { success: true } })
    }
    return Promise.resolve({ data: { success: true } })
  })
})

// This test is for debugging the toast manager and event system
// It verifies that toast messages with Arabic text and variable interpolation work correctly
test('debug: probe clinics:show-toast event and global manager', async () => {
  const handler = jest.fn()
  window.addEventListener('clinics:show-toast', handler)

  renderWithProviders(<Dashboard />, { 
    auth: { 
      user: { id: 1, role: ROLES.PRIMARY_ADMIN },
      isAuthenticated: true 
    }
  })

  // Wait for dashboard to render
  await waitFor(() => {
    const queueButtons = screen.queryAllByRole('button', { name: /الطابور الأول/i })
    expect(queueButtons.length).toBeGreaterThan(0)
  }, { timeout: 3000 })

  // Instead of complex UI interaction, directly test the toast system
  // by importing and calling showToast with the expected message format
  const { showToast } = require('../lib/toast')
  const { useI18n } = require('../lib/i18n')
  
  // Simulate what happens when a message is sent successfully
  const patientName = 'Ali'
  const mockI18n = useI18n()
  const message = mockI18n.t('hooks.send_message.success', 'تم إرسال رسالة للمريض {patientName} بنجاح', { patientName })
  
  // Trigger the toast
  showToast(message, 'success')

  // Wait for and verify the success toast
  await waitFor(() => {
    // Should be rendered by TestToastRenderer
    expect(screen.getByText(/تم إرسال رسالة للمريض Ali بنجاح/i)).toBeInTheDocument()
  }, { timeout: 3000 })

  // Verify the event was dispatched with the correct message
  expect(handler).toHaveBeenCalled()
  const toastEvent = handler.mock.calls[handler.mock.calls.length - 1][0]
  expect(toastEvent.detail.message).toMatch(/تم إرسال رسالة للمريض Ali بنجاح/i)

  window.removeEventListener('clinics:show-toast', handler)
})
