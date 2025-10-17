import React from 'react'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import App from '../pages/_app'
import Dashboard from '../pages/dashboard'
import { server } from '../mocks/server'
import { rest } from 'msw'

test('message send error and retry flow', async ()=>{
  renderWithProviders(<App Component={Dashboard} pageProps={{}} />, { localStorage: { currentUser: JSON.stringify({ id:1, role: 'primary_admin' }) } })
  const queueBtn = await screen.findByText(/الطابور الأول/i)
  fireEvent.click(queueBtn)
  await waitFor(()=> expect(screen.getByText('Ali')).toBeInTheDocument())

  // select patient
  fireEvent.click(screen.getByLabelText('select-patient-0'))

  // override messages/send to fail
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'
  const failHandler = rest.post(API_BASE + '/api/messages/send', (req, res, ctx) => res(ctx.status(500), ctx.json({ success: false })))
  server.use(failHandler)

  // open modal and send
  fireEvent.click(screen.getByText('إرسال رسالة'))
  const sendBtn = await screen.findByText('إرسال')
  fireEvent.click(sendBtn)

  // expect failure toast
  await waitFor(()=> expect(screen.getByText('فشل إرسال الرسالة')).toBeInTheDocument())

  // restore default handler (server is configured with success by default)
  server.resetHandlers()

  // open modal and send again
  fireEvent.click(screen.getByText('إرسال رسالة'))
  const sendBtn2 = await screen.findByText('إرسال')
  fireEvent.click(sendBtn2)
  await waitFor(()=> expect(screen.getByText('تم إرسال الرسالة')).toBeInTheDocument())
})
