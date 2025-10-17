import React from 'react'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import App from '../pages/_app'
import Dashboard from '../pages/dashboard'

function makeCSVFile(content, name='patients.csv'){
  const blob = new Blob([content], { type: 'text/csv' })
  return new File([blob], name, { type: 'text/csv' })
}

test('CSV upload parse flow adds patients', async ()=>{
  renderWithProviders(<App Component={Dashboard} pageProps={{}} />, { localStorage: { currentUser: JSON.stringify({ id:1, role: 'primary_admin' }) } })

  // select queue
  const queueBtn = await screen.findByText(/الطابور الأول/i)
  fireEvent.click(queueBtn)

  // create CSV: fullName,phoneNumber
  const file = makeCSVFile('fullName,phoneNumber\nZaid,099\nLina,098')
  const input = screen.getByLabelText('رفع ملف المرضى (CSV)') || screen.getByLabelText('csv-upload-input') || document.getElementById('csv-upload-input')
  // fallback to querySelector
  const fileInput = input || document.querySelector('#csv-upload-input')
  expect(fileInput).toBeTruthy()
  // fire change event
  fireEvent.change(fileInput, { target: { files: [file] } })

  // wait for added patients to appear
  await waitFor(()=> expect(screen.getByText('Zaid')).toBeInTheDocument())
  await waitFor(()=> expect(screen.getByText('Lina')).toBeInTheDocument())
})
