import React from 'react'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import Dashboard from '../pages/dashboard'
import { server } from '../mocks/server'
import { rest } from 'msw'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'

test('message send transient failure then success using retry', async () => {
  let requestCount = 0
  server.use(
    rest.post(`${API_BASE}/api/messages/send`, (req, res, ctx) => {
      requestCount++
      if (requestCount === 1) {
        // First time it fails
        return res(ctx.status(503), ctx.json({ message: 'Service Unavailable' }))
      }
      // Second time it succeeds
      return res(ctx.json({ success: true, message: 'Messages sent successfully' }))
    })
  )

  renderWithProviders(<Dashboard />)

  // 1. Select queue and wait for patients
  const queueButton = await screen.findByText(/الطابور الأول/i)
  fireEvent.click(queueButton)
  await screen.findByText('Ali')

  // 2. Select all patients
  const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all/i })
  fireEvent.click(selectAllCheckbox)

  // 3. Open message modal and send (first attempt)
  const sendMessageButton = screen.getByRole('button', { name: /إرسال رسالة للمحددين/i })
  fireEvent.click(sendMessageButton)
  const sendConfirmButton = await screen.findByRole('button', { name: /إرسال/i })
  fireEvent.click(sendConfirmButton)

  // 4. Assert failure toast
  const failAlert = await screen.findByRole('alert')
  expect(failAlert).toHaveTextContent('فشل إرسال الرسالة')
  expect(requestCount).toBe(1)

  // 5. The modal should close on failure, so we re-open it to retry
  fireEvent.click(sendMessageButton)
  const retrySendButton = await screen.findByRole('button', { name: /إرسال/i })
  fireEvent.click(retrySendButton)

  // 6. Assert success toast on second attempt
  const successAlert = await screen.findByRole('alert')
  expect(successAlert).toHaveTextContent('تم إرسال الرسالة')
  expect(requestCount).toBe(2)
}, 15000)
