import React from 'react'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import App from '../pages/_app'
import Dashboard from '../pages/dashboard'

test('select template and send message to selected patient', async ()=>{
  renderWithProviders(<App Component={Dashboard} pageProps={{}} />, { localStorage: { currentUser: JSON.stringify({ id:1, role: 'primary_admin' }) } })

  // select queue and wait for patients
  const queueBtn = await screen.findByText(/الطابور الأول/i)
  fireEvent.click(queueBtn)
  await waitFor(()=> expect(screen.getByText('Ali')).toBeInTheDocument())

  // select first patient
  const checkbox = screen.getByLabelText('select-patient-0')
  fireEvent.click(checkbox)

  // choose template from select
  const tplSelect = screen.getByLabelText('القوالب') || screen.getByLabelText(/القوالب/i) || screen.getByRole('combobox')
  if (tplSelect){
    fireEvent.change(tplSelect, { target: { value: 't1' } })
  } else {
    // fallback: find option and click
    const option = await screen.findByText('تأكيد')
    fireEvent.click(option)
  }

  // open message modal
  const sendOpenBtn = screen.getByText('إرسال رسالة')
  fireEvent.click(sendOpenBtn)

  // click send in modal
  const sendBtn = await screen.findByText('إرسال')
  fireEvent.click(sendBtn)

  // wait for success toast
  await waitFor(()=> expect(screen.getByText('تم إرسال الرسالة')).toBeInTheDocument())
})
