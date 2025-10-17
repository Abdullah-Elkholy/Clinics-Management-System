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

  // Click CSV button to show modal 
  const csvButton = screen.getByRole('button', { name: 'رفع ملف المرضى' })
  fireEvent.click(csvButton)

  // Now create CSV file and find input
  const file = makeCSVFile('fullName,phoneNumber\nZaid,099\nLina,098')
  const input = screen.getByLabelText('رفع ملف المرضى (CSV)')
  expect(input).toBeTruthy()
  // fire change event
  fireEvent.change(input, { target: { files: [file] } })

  // wait for added patients to appear
  await waitFor(()=> expect(screen.getByText('Zaid')).toBeInTheDocument())
  await waitFor(()=> expect(screen.getByText('Lina')).toBeInTheDocument())
})
