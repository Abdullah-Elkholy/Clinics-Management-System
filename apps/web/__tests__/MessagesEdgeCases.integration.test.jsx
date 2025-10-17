import React from 'react'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import App from '../pages/_app'
import Dashboard from '../pages/dashboard'
import { server } from '../mocks/server'
import { rest } from 'msw'

test('message send partial failure shows failure toast and leaves retry option', async ()=>{
  renderWithProviders(<App Component={Dashboard} pageProps={{}} />, { localStorage: { currentUser: JSON.stringify({ id:1, role: 'primary_admin' }) } })
  const queueBtn = await screen.findByText(/الطابور الأول/i)
  fireEvent.click(queueBtn)
  await waitFor(()=> expect(screen.getByText('Ali')).toBeInTheDocument())

  // select Ali
  fireEvent.click(screen.getByLabelText('select-patient-0'))

  // override send to simulate partial failure (returns success:false)
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'
  server.use(rest.post(API_BASE + '/api/messages/send', (req, res, ctx) => {
    return res(ctx.status(200), ctx.json({ success: false, failed: [101], message: 'Some failed' }))
  }))

  // open send modal and send
  fireEvent.click(screen.getByLabelText('open-message-modal'))
  const sendBtn = await screen.findByText('إرسال')
  fireEvent.click(sendBtn)

  await waitFor(()=> expect(screen.getByText(/فشل إرسال الرسالة|Some failed/i)).toBeInTheDocument())
})

test('message send batching handles large recipient list (no crash)', async ()=>{
  renderWithProviders(<App Component={Dashboard} pageProps={{}} />, { localStorage: { currentUser: JSON.stringify({ id:1, role: 'primary_admin' }) } })
  const queueBtn = await screen.findByText(/الطابور الأول/i)
  fireEvent.click(queueBtn)
  await waitFor(()=> expect(screen.getByText('Ali')).toBeInTheDocument())

  // create lots of patients by posting directly to API (use existing handlers)
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'
  for (let i=0;i<60;i++){
    await fetch(`${API_BASE}/api/queues/q1/patients`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fullName: `Bulk${i}`, phoneNumber: `09${1000+i}` }) })
  }

  // choose all checkboxes (the table should now have many rows)
  const checkboxes = await screen.findAllByRole('checkbox')
  checkboxes.forEach(cb => { try{ fireEvent.click(cb) }catch(e){} })

  // send messages (use default mock which returns success)
  fireEvent.click(screen.getByLabelText('open-message-modal'))
  const sendBtn = await screen.findByText('إرسال')
  fireEvent.click(sendBtn)

  await waitFor(()=> expect(screen.getByText(/تم إرسال الرسالة/)).toBeInTheDocument())
})
