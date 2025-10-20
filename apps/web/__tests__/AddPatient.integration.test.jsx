import React from 'react'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import { ROLES } from '../lib/roles'
import App from '../pages/_app'
import Dashboard from '../pages/dashboard'

test('add patient flow: opens modal and adds patient to queue', async ()=>{
  renderWithProviders(<App Component={Dashboard} pageProps={{}} />, { 
  auth: { user: { id:1, role: ROLES.PRIMARY_ADMIN } }
  })

  // Wait for initial load and navigation
  await waitFor(async () => {
    // First the loading indicator should appear
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  // Then wait for nav buttons to appear
  await waitFor(async () => {
    expect(screen.getByRole('button', { name: 'قسم الرسائل' })).toBeInTheDocument()
  })

  // Then wait for queue list
  const queueBtn = await screen.findByRole('button', { name: /طابور.*الطابور الأول/i })
  fireEvent.click(queueBtn)

  // wait for patient 'Ali' to confirm queue loaded
  await waitFor(()=> expect(screen.getByText('Ali')).toBeInTheDocument())

  // open add patients modal by clicking 'إضافة مرضى'
  const addBtn = screen.getByText('إضافة مرضى')
  fireEvent.click(addBtn)

  // fill the modal inputs (there is initially one slot)
  const nameInput = screen.getByPlaceholderText('أدخل الاسم الكامل')
  const phoneInput = screen.getByPlaceholderText('رقم الهاتف')
  fireEvent.change(nameInput, { target: { value: 'Hassan' } })
  fireEvent.change(phoneInput, { target: { value: '012345' } })

  // submit
  const submitBtn = screen.getByText('إضافة المرضى')
  fireEvent.click(submitBtn)

  // wait for the new patient to appear in table (MSW handler persists in-memory)
  await waitFor(()=> expect(screen.getByText('Hassan')).toBeInTheDocument())
})
