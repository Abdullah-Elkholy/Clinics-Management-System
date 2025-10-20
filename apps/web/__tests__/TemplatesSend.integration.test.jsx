import React from 'react'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import { ROLES } from '../lib/roles'
import Dashboard from '../pages/dashboard'

test('select template and send message to selected patient', async ()=>{
  renderWithProviders(<Dashboard />, { auth: { user: { id:1, role: ROLES.PRIMARY_ADMIN } } })

  // select queue and wait for patients
  const queueBtn = await screen.findByText(/الطابور الأول/i)
  fireEvent.click(queueBtn)
  await waitFor(()=> expect(screen.getByText('Ali')).toBeInTheDocument())

  // select patient and template
  fireEvent.click(screen.getByLabelText('select-patient-0'))
  fireEvent.change(screen.getByLabelText('القوالب'), { target: { value: 't1' } })

  // send message
  fireEvent.click(screen.getByRole('button', { name: /إرسال رسالة واتساب/i }))

  // check for success toast
  await waitFor(() => expect(screen.getByText(/تم إرسال رسالة للمريض Ali بنجاح/i)).toBeInTheDocument())
})
