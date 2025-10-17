import React from 'react'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import App from '../pages/_app'
import Dashboard from '../pages/dashboard'
import { server } from '../mocks/server'
import { rest } from 'msw'

// Simulate transient failure (first request 500), then success, ensure UI shows retry works
test('message send transient failure then success using retry', async ()=>{
  renderWithProviders(<App Component={Dashboard} pageProps={{}} />, { localStorage: { currentUser: JSON.stringify({ id:1, role: 'primary_admin' }) } })
  const queueBtn = await screen.findByText(/الطابور الأول/i)
  fireEvent.click(queueBtn)
  await waitFor(()=> expect(screen.getByText('Ali')).toBeInTheDocument())

  // select patient
  fireEvent.click(screen.getByLabelText('select-patient-0'))

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'
  // make a handler that fails the first time then succeeds
  let called = 0
  const transient = rest.post(API_BASE + '/api/messages/send', (req, res, ctx) => {
    called++
    if (called === 1) return res(ctx.status(500), ctx.json({ success: false }))
    return res(ctx.json({ success: true, queued: 1 }))
  })
  server.use(transient)

  // open modal and send
  fireEvent.click(screen.getByText('إرسال رسالة'))
  const sendBtn = await screen.findByText('إرسال')
  fireEvent.click(sendBtn)

  // expect failure toast
  await waitFor(()=> expect(screen.getByText('فشل إرسال الرسالة')).toBeInTheDocument())

  // Now send again, transient handler will now return success
  fireEvent.click(screen.getByText('إرسال رسالة'))
  const sendBtn2 = await screen.findByText('إرسال')
  fireEvent.click(sendBtn2)

  await waitFor(()=> expect(screen.getByText('تم إرسال الرسالة')).toBeInTheDocument())
})
