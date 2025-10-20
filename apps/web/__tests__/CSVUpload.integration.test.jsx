import React from 'react'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import { ROLES } from '../lib/roles'
import App from '../pages/_app'
import Dashboard from '../pages/dashboard'

function makeCSVFile(content, name='patients.csv'){
  const blob = new Blob([content], { type: 'text/csv' })
  return new File([blob], name, { type: 'text/csv' })
}

test('CSV upload parse flow adds patients', async ()=>{
  renderWithProviders(<App Component={Dashboard} pageProps={{}} />, { localStorage: { currentUser: JSON.stringify({ id:1, role: ROLES.PRIMARY_ADMIN }) } })

  // Wait for loading to finish and queue to appear
  await waitFor(() => {
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
  })
  
  // Select queue
  const queueBtn = screen.getByRole('button', { name: /طابور.*الطابور الأول/i })
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
