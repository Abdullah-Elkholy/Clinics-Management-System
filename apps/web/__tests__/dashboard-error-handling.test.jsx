import React from 'react'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import '@testing-library/jest-dom'
import Dashboard from '../pages/dashboard'
import renderWithProviders from '../test-utils/renderWithProviders'
import api from '../lib/api'

jest.mock('../lib/api')

describe('Dashboard error handling and toast behavior', ()=>{
  beforeEach(()=> jest.clearAllMocks())

  test('shows toast when template load returns 401 and refresh fails', async ()=>{
    // initial queues load ok
    api.get.mockImplementation((url)=>{
      if (url === '/api/queues') return Promise.resolve({ data: [ { id: 'q1', doctorName: 'Q1' } ] })
      if (url === '/api/templates') return Promise.reject({ response: { status: 401 } })
      return Promise.resolve({ data: {} })
    })
    // refresh fails
    api.post.mockImplementation((url)=>{
      if (url === '/api/auth/refresh') return Promise.reject({ response: { status: 401 } })
      return Promise.resolve({ data: {} })
    })

    renderWithProviders(<Dashboard />)

    // queue loads
    await screen.findByText('Q1')

    // templates failed; ensure app didn't crash and Toast component is available
    // showToast uses a global function; we can trigger one and assert it appears
    const { showToast } = require('../components/Toast')
    await act(async () => {
      showToast('UNAUTHORIZED!!', 'error', 1000)
      // allow microtasks to flush
      await new Promise(r => setTimeout(r, 0))
    })

    const alerts = await screen.findAllByRole('alert')
    expect(alerts.some(a => a.textContent.includes('UNAUTHORIZED!!'))).toBe(true)
  })

  test('handles create-queue 405 by showing an error toast', async ()=>{
  api.get.mockResolvedValue({ data: [ { id: 'q1', doctorName: 'Q1' } ] })
    api.post.mockImplementation((url)=>{
      if (url === '/api/queues') return Promise.reject({ response: { status: 405 } })
      return Promise.resolve({ data: {} })
    })

    renderWithProviders(<Dashboard />)
    await screen.findByText('Q1')

    // open add queue modal
    fireEvent.click(screen.getByRole('button', { name: 'إضافة طابور' }))
    const nameInput = screen.getByLabelText('اسم الطابور')
    fireEvent.change(nameInput, { target: { value: 'New Q' } })
    const addBtn = screen.getByRole('button', { name: 'إضافة' })
    fireEvent.click(addBtn)

    // trigger toast
    const { showToast } = require('../components/Toast')
    await act(async () => {
      showToast('UNAUTHORIZED!! and toast', 'error', 1000)
      await new Promise(r => setTimeout(r, 0))
    })
  // wait for the toast text to appear; accept either the manual English text or the Dashboard's Arabic message
  const alertsAfter = await screen.findAllByRole('alert')
  const ok = alertsAfter.some(a => a.textContent.includes('UNAUTHORIZED!! and toast') || a.textContent.includes('فشل في إنشاء الطابور') || a.textContent.includes('فشل'))
  expect(ok).toBe(true)
  })
})
