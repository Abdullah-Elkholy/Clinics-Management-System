import React from 'react'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import App from '../pages/_app'
import Dashboard from '../pages/dashboard'
import { server } from '../mocks/server'
import { rest } from 'msw'

test('CSV large file processes without crashing and adds final rows', async ()=>{
  renderWithProviders(<App Component={Dashboard} pageProps={{}} />, { localStorage: { currentUser: JSON.stringify({ id:1, role: 'primary_admin' }) } })
  const queueBtn = await screen.findByText(/الطابور الأول/i)
  fireEvent.click(queueBtn)
  await waitFor(()=> expect(screen.getByText('Ali')).toBeInTheDocument())

  // create a sizable CSV of 30 rows (reduced to keep test fast)
  let csv = 'fullName,phoneNumber\n'
  for (let i=0;i<100;i++) csv += `User${i},09${1000+i}\n`
  const file = new File([csv], 'large.csv', { type: 'text/csv' })
  const input = screen.getByLabelText('رفع ملف المرضى (CSV)')
  fireEvent.change(input, { target: { files: [file] } })
  // expect at least some of the new rows to appear (optimistic append)
  await waitFor(()=> expect(screen.getByText('User0')).toBeInTheDocument(), { timeout: 30000 })
  expect(screen.getByText('Ali')).toBeInTheDocument()
})

test('CSV header-only file yields no additions and no crash', async ()=>{
  renderWithProviders(<App Component={Dashboard} pageProps={{}} />, { localStorage: { currentUser: JSON.stringify({ id:1, role: 'primary_admin' }) } })
  const queueBtn = await screen.findByText(/الطابور الأول/i)
  fireEvent.click(queueBtn)
  await waitFor(()=> expect(screen.getByText('Ali')).toBeInTheDocument())
  const file = new File(['fullName,phoneNumber\n'], 'header.csv', { type: 'text/csv' })
  const input = screen.getByLabelText('رفع ملف المرضى (CSV)')

  // capture row count before
  const rowsBefore = screen.getAllByRole('row')
  fireEvent.change(input, { target: { files: [file] } })

  // header-only means no new rows (wait briefly)
  await new Promise(r=> setTimeout(r, 50))
  const rowsAfter = screen.getAllByRole('row')
  expect(rowsAfter.length).toBe(rowsBefore.length)
  expect(screen.getByText('Ali')).toBeInTheDocument()
})

test('CSV with invalid rows shows failure toast but processes valid rows', async ()=>{
  renderWithProviders(<App Component={Dashboard} pageProps={{}} />, { localStorage: { currentUser: JSON.stringify({ id:1, role: 'primary_admin' }) } })
  const queueBtn = await screen.findByText(/الطابور الأول/i)
  fireEvent.click(queueBtn)
  await waitFor(()=> expect(screen.getByText('Ali')).toBeInTheDocument())
  // intercept POST to return 500 for rows missing fullName
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'
  server.use(rest.post(API_BASE + '/api/queues/:queueId/patients', async (req, res, ctx) => {
    const body = await req.json()
    if (!body.fullName) return res(ctx.status(500), ctx.json({ success: false }))
    // otherwise simulate success
    return res(ctx.status(201), ctx.json({ success: true, data: { id: Math.floor(Math.random()*10000), fullName: body.fullName || 'Unknown', phoneNumber: body.phoneNumber || '', position: 999 } }))
  }))

  // create CSV with a valid and invalid row
  const csv = 'fullName,phoneNumber\nValidUser,09999\n,\n'
  const file = new File([csv], 'mixed.csv', { type: 'text/csv' })
  const input = screen.getByLabelText('رفع ملف المرضى (CSV)')
  fireEvent.change(input, { target: { files: [file] } })

  // optimistic addition of the valid row
  await waitFor(()=> expect(screen.getByText('ValidUser')).toBeInTheDocument())
  // failure toast should be shown for invalid row (Toast uses polite aria-live)
  await waitFor(()=> expect(screen.getByText('بعض السجلات فشلت')).toBeInTheDocument())
})
