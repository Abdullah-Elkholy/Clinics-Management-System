import React from 'react'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import Dashboard from '../pages/dashboard'
import { server } from '../mocks/server'
import { rest } from 'msw'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'

describe('Messages Edge Cases', () => {
  test('message send partial failure shows failure toast', async () => {
    server.use(
      rest.post(`${API_BASE}/api/messages/send`, (req, res, ctx) => {
        return res(ctx.status(500), ctx.json({ message: 'Internal Server Error' }))
      })
    )

    renderWithProviders(<Dashboard />)

    // 1. Select queue and wait for patients
    const queueButton = await screen.findByText(/الطابور الأول/i)
    fireEvent.click(queueButton)
    await screen.findByText('Ali')
    await screen.findByText('Sara')

    // 2. Select all patients
    const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all/i })
    fireEvent.click(selectAllCheckbox)

    // 3. Open the message modal
    const sendMessageButton = screen.getByRole('button', { name: /إرسال رسالة للمحددين/i })
    fireEvent.click(sendMessageButton)

    // 4. Type a message and send
    const messageInput = await screen.findByRole('textbox', { name: /custom message/i })
    fireEvent.change(messageInput, { target: { value: 'Test partial failure' } })

    const sendConfirmButton = screen.getByRole('button', { name: /إرسال/i })
    fireEvent.click(sendConfirmButton)

    // 5. Assert failure toast is shown
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('فشل إرسال الرسالة')
  }, 15000)

  test('message send batching handles large recipient list (no crash)', async () => {
    const largePatientList = Array.from({ length: 150 }, (_, i) => ({
      id: i + 1,
      fullName: `User${i + 1}`,
      phoneNumber: `09100000${i}`,
      position: i + 1,
    }))

    server.use(
      rest.get(`${API_BASE}/api/queues/q1/patients`, (req, res, ctx) => {
        return res(ctx.json({ success: true, patients: largePatientList }))
      }),
      rest.post(`${API_BASE}/api/messages/send`, (req, res, ctx) => {
        return res(ctx.json({ success: true, message: 'All messages sent' }))
      })
    )

    renderWithProviders(<Dashboard />)

    const queueButton = await screen.findByText(/الطابور الأول/i)
    fireEvent.click(queueButton)

    await screen.findByText('User1')
    expect(await screen.findAllByRole('row')).toHaveLength(largePatientList.length + 1) // +1 for header

    const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all/i })
    fireEvent.click(selectAllCheckbox)

    const sendMessageButton = screen.getByRole('button', { name: /إرسال رسالة للمحددين/i })
    fireEvent.click(sendMessageButton)

    const sendConfirmButton = await screen.findByRole('button', { name: /إرسال/i })
    fireEvent.click(sendConfirmButton)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('تم إرسال الرسالة')
  }, 25000)
})
