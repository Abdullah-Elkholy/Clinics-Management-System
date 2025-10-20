import React from 'react'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import { ROLES } from '../lib/roles'
import Dashboard from '../pages/dashboard'
import { server } from '../mocks/server'
import { rest } from 'msw'

test('CSV optimistic additions appear immediately and are not hidden by immediate refresh', async ()=>{
  renderWithProviders(<Dashboard />, { auth: { user: { id:1, role: ROLES.PRIMARY_ADMIN } } })

  const queueBtn = await screen.findByText(/الطابور الأول/i)
  fireEvent.click(queueBtn)
  await waitFor(()=> expect(screen.getByText('Ali')).toBeInTheDocument())

  // intercept POST to simulate small delay but eventual success
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'
  server.use(rest.post(API_BASE + '/api/Queues/:queueId/patients', async (req, res, ctx) => {
    const body = await req.json()
    // slight delay
    await new Promise(r => setTimeout(r, 50))
    return res(ctx.status(201), ctx.json({ success: true, data: { id: 9999, fullName: body.fullName, phoneNumber: body.phoneNumber, position: 999 } }))
  }))

  // Open CSV modal and get input
  const addPatientButton = await screen.findByRole('button', { name: 'إضافة مرضى جدد' }, { timeout: 3000 })
  fireEvent.click(addPatientButton)
  
  const csvButton = screen.getByRole('button', { name: 'رفع ملف المرضى' })
  fireEvent.click(csvButton)

  // Create file and upload
  const file = new File([`fullName,phoneNumber,desiredPosition\nNew User,099,`], 'patients.csv', { type: 'text/csv' })
  const input = screen.getByLabelText('رفع ملف المرضى (CSV)')
  fireEvent.change(input, { target: { files: [file] } })

  // optimistic row should appear quickly
  await waitFor(() => expect(screen.getByText('New User')).toBeInTheDocument())

  // also ensure original patients still present (no full refresh hiding optimistic row)
  expect(screen.getByText('Ali')).toBeInTheDocument()
})
