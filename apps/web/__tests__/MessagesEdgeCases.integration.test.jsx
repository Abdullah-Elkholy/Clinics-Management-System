import React from 'react'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import { ROLES } from '../lib/roles'
import Dashboard from '../pages/dashboard'
import { server } from '../mocks/server'
import { rest } from 'msw'
import { mockPatients, resetMockData } from '../mocks/handlers'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'

describe('Messages Edge Cases', () => {
  beforeEach(() => resetMockData())

  test('message send partial failure shows failure toast', async () => {
    server.use(
      rest.post(`${API_BASE}/api/messages/send`, async (req, res, ctx) => {
        const { patientIds } = await req.json()
        if (patientIds.includes('p1')) {
          return res(ctx.status(500), ctx.json({ success: false, message: 'Failed for p1' }))
        }
        return res(ctx.json({ success: true, data: { messageId: 'id-sara', status: 'sent' } }))
      })
    )

    renderWithProviders(<Dashboard />, { auth: { user: { id:1, role: ROLES.PRIMARY_ADMIN } } })

    // 1. Select queue and wait for patients
    const queueButton = await screen.findByText(/الطابور الأول/i)
    fireEvent.click(queueButton)
    await screen.findByText('Ali')
    await screen.findByText('Sara')

    // 2. Select both patients and a template
    fireEvent.click(screen.getByLabelText('select-patient-0'))
    fireEvent.click(screen.getByLabelText('select-patient-1'))
    fireEvent.change(screen.getByLabelText('القوالب'), { target: { value: 't1' } })

    // 3. Send message
    fireEvent.click(screen.getByRole('button', { name: /إرسال رسالة واتساب/i }))

    // 4. Assert partial failure
    await screen.findByText(/فشل إرسال رسالة للمريض Ali/i)
    await screen.findByText(/تم إرسال رسالة للمريض Sara بنجاح/i)
  })

  test('message send batching handles large recipient list (no crash)', async () => {
    // Add 20 users to the mock data
    for (let i = 1; i <= 20; i++) {
      mockPatients.q1.push({ id: `p${i + 2}`, fullName: `User${i}`, phoneNumber: `05000000${i}`, position: i + 2 })
    }

  renderWithProviders(<Dashboard />, { auth: { user: { id:1, role: ROLES.PRIMARY_ADMIN } } })

    const queueButton = await screen.findByText(/الطابور الأول/i)
    fireEvent.click(queueButton)

    await screen.findByText('User1')
    await screen.findByText('User20')

    // Select all patients
    fireEvent.click(screen.getByLabelText('select-all-patients'))
    fireEvent.change(screen.getByLabelText('القوالب'), { target: { value: 't1' } })

    // Send and expect no crash
    fireEvent.click(screen.getByRole('button', { name: /إرسال رسالة واتساب/i }))

    // Check for success toasts (at least some of them)
    await screen.findByText(/تم إرسال رسالة للمريض User1 بنجاح/i)
    await screen.findByText(/تم إرسال رسالة للمريض User20 بنجاح/i)
  })
})
