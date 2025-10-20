import React from 'react'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import { ROLES } from '../lib/roles'
import Dashboard from '../pages/dashboard'

test('CSV upload partial success and invalid format handling', async ()=>{
  renderWithProviders(<Dashboard />, { auth: { user: { id:1, role: ROLES.PRIMARY_ADMIN } } })
  const queueBtn = await screen.findByText(/الطابور الأول/i)
  fireEvent.click(queueBtn)
  await waitFor(()=> expect(screen.getByText('Ali')).toBeInTheDocument())

  // Open CSV modal and get input
  const addPatientButton = screen.getByRole('button', { name: 'إضافة مرضى جدد' })
  fireEvent.click(addPatientButton)
  const csvButton = screen.getByRole('button', { name: 'رفع ملف المرضى' })
  fireEvent.click(csvButton)

  // Create file and upload
  const file = new File([`fullName,phoneNumber,desiredPosition\nGood User,099,\nBad User,,100`], 'patients.csv', { type: 'text/csv' })
  const input = screen.getByLabelText('رفع ملف المرضى (CSV)')
  fireEvent.change(input, { target: { files: [file] } })

  // one user added, one failed
  await waitFor(() => expect(screen.getByText('Good User')).toBeInTheDocument())
  await waitFor(() => expect(screen.getByText(/Bad User.*سطر 3.*phoneNumber/)).toBeInTheDocument())
})
