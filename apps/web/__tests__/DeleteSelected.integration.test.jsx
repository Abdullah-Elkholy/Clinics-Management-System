import React from 'react'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import App from '../pages/_app'
import Dashboard from '../pages/dashboard'
import { server } from '../mocks/server'
import { resetMockData } from '../mocks/handlers'
import { rest } from 'msw'

// successful delete-selected should remove selected patients from UI
test('delete-selected removes selected patients on success', async ()=>{
  renderWithProviders(<App Component={Dashboard} pageProps={{}} />, { localStorage: { currentUser: JSON.stringify({ id:1, role: 'primary_admin' }) } })
  resetMockData()
  const queueBtn = await screen.findByText(/الطابور الأول/i)
  fireEvent.click(queueBtn)
  await waitFor(()=> expect(screen.getByText('Ali')).toBeInTheDocument())

  // select both patients
  fireEvent.click(screen.getByLabelText('select-patient-0'))
  fireEvent.click(screen.getByLabelText('select-patient-1'))

  // click delete (confirm dialog will be called; mock window.confirm)
  const origConfirm = window.confirm
  window.confirm = () => true
  fireEvent.click(screen.getByText('حذف المحدد'))

  // wait for success toast and ensure Ali and Sara are gone
  await waitFor(()=> expect(screen.getByText('تم حذف المرضى المحددين')).toBeInTheDocument())
  expect(screen.queryByText('Ali')).toBeNull()
  expect(screen.queryByText('Sara')).toBeNull()

  window.confirm = origConfirm
})

// failure path: server returns 500 for DELETE, expect failure toast and patients remain
test('delete-selected shows failure when API fails', async ()=>{
  renderWithProviders(<App Component={Dashboard} pageProps={{}} />, { localStorage: { currentUser: JSON.stringify({ id:1, role: 'primary_admin' }) } })
  resetMockData()
  const queueBtn = await screen.findByText(/الطابور الأول/i)
  fireEvent.click(queueBtn)
  await waitFor(()=> expect(screen.getByText('Ali')).toBeInTheDocument())

  // override delete handler to return 500
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'
  server.use(rest.delete(API_BASE + '/api/patients/:id', (req, res, ctx) => res(ctx.status(500), ctx.json({ success: false }))))

  // select first patient
  fireEvent.click(screen.getByLabelText('select-patient-0'))

  const origConfirm = window.confirm
  window.confirm = () => true
  fireEvent.click(screen.getByText('حذف المحدد'))

  await waitFor(()=> expect(screen.getByText('بعض الحذف فشل')).toBeInTheDocument())
  // patient should still be present
  expect(screen.getByText('Ali')).toBeInTheDocument()

  window.confirm = origConfirm
})
