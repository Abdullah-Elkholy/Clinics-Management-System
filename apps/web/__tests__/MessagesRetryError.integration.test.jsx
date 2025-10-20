import React from 'react'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import { ROLES } from '../lib/roles'
import Dashboard from '../pages/dashboard'
import { server } from '../mocks/server'
import { rest } from 'msw'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'

test('message send error and retry flow', async () => {
  let sendCount = 0
  server.use(
    rest.post(`${API_BASE}/api/messages/send`, (req, res, ctx) => {
      sendCount++
      if (sendCount === 1) {
        return res(ctx.status(500), ctx.json({ success: false, message: 'something went wrong' }))
      }
      return res(ctx.json({ success: true, data: { messageId: 'id1', status: 'sent' } }))
    })
  )

  renderWithProviders(<Dashboard />, { auth: { user: { id:1, role: ROLES.PRIMARY_ADMIN } } })

  // 1. Select queue and wait for patients
  const queueButton = await screen.findByText(/الطابور الأول/i)
  fireEvent.click(queueButton)
  await screen.findByText('Ali')

  // 2. Select a patient and template
  fireEvent.click(screen.getByLabelText('select-patient-0'))
  fireEvent.change(screen.getByLabelText('القوالب'), { target: { value: 't1' } })

  // 3. Send message (will fail first time)
  fireEvent.click(screen.getByRole('button', { name: /إرسال رسالة واتساب/i }))
  // Wait for loading to finish
  await waitFor(() => {
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
  })

  // Wait for error message
  await waitFor(() => {
    expect(screen.getByText((content, element) => {
      return content.includes('فشل إرسال رسالة') && content.includes('Ali')
    })).toBeInTheDocument()
  })

  // 4. Open retry modal and click retry
  fireEvent.click(screen.getByRole('button', { name: /عرض المحاولات الفاشلة/i }))
  await screen.findByText('إعادة إرسال الرسائل')
  fireEvent.click(screen.getByRole('button', { name: /إعادة إرسال الكل/i }))

  // 5. Assert success this time
  await screen.findByText(/تم إرسال رسالة للمريض Ali بنجاح/i)
  expect(sendCount).toBe(2)
}, 15000)
