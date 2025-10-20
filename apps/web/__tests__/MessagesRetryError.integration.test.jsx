import React from 'react'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import Dashboard from '../pages/dashboard'
import { server } from '../mocks/server'
import { rest } from 'msw'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'

test('message send error and retry flow', async () => {
  let requestCount = 0
  // First send fails with a 500 error
  server.use(
    rest.post(`${API_BASE}/api/messages/send`, (req, res, ctx) => {
      requestCount++
      if (requestCount === 1) {
        return res(ctx.status(500), ctx.json({ message: 'Internal Server Error' }))
      }
      return res(ctx.json({ success: true, message: 'Messages sent successfully' }))
    })
  )

  renderWithProviders(<Dashboard />)

  // 1. Select queue and wait for patients
  const queueButton = await screen.findByText(/الطابور الأول/i)
  fireEvent.click(queueButton)
  await screen.findByText('Ali')

  // 2. Select patients
  const selectAllCheckbox = screen.getByRole('checkbox', { name: /select all/i })
  fireEvent.click(selectAllCheckbox)

  // 3. Open modal and attempt to send (will fail)
  const sendMessageButton = screen.getByRole('button', { name: /إرسال رسالة للمحددين/i })
  fireEvent.click(sendMessageButton)
  const sendConfirmButton = await screen.findByRole('button', { name: /إرسال/i })
  fireEvent.click(sendConfirmButton)

  // 4. Assert failure toast
  const failAlert = await screen.findByRole('alert')
  expect(failAlert).toHaveTextContent('فشل إرسال الرسالة')
  expect(requestCount).toBe(1)

  // 5. Re-open modal and retry (will succeed)
  fireEvent.click(sendMessageButton)
  const retrySendButton = await screen.findByRole('button', { name: /إرسال/i })
  fireEvent.click(retrySendButton)

  // 6. Assert success toast
  const successAlert = await screen.findByRole('alert')
  expect(successAlert).toHaveTextContent('تم إرسال الرسالة')
  expect(requestCount).toBe(2)
}, 15000)
