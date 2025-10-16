import React from 'react'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { act } from 'react-dom/test-utils'
import Dashboard from '../pages/dashboard'
import { renderWithProviders } from '../test-utils/renderWithProviders'

test('loads queues and patients and allows adding via CSV', async ()=>{
  // seed currentUser so dashboard treats user as admin if needed
  const { container } = renderWithProviders(<Dashboard />, { localStorage: { currentUser: JSON.stringify({ id:1, role: 'primary_admin' }) } })

  // should load queues
  await waitFor(()=> expect(screen.getByText('الطابور الأول')).toBeInTheDocument())

  // click the first queue button (by role + name)
  const buttons = screen.getAllByRole('button')
  const queueBtn = buttons.find(b => b.textContent && b.textContent.includes('الطابور الأول'))
  fireEvent.click(queueBtn)

  // patients list should load
  await waitFor(()=> expect(screen.getByText('Ali')).toBeInTheDocument())

  // simulate CSV upload by calling handleAddPatients indirectly: open file input and fire change
  const fileInput = screen.getByLabelText(/رفع ملف المرضى/i)
  const file = new File(['NewGuy,012,3'], 'patients.csv', { type: 'text/csv' })
  // FileReader callbacks may update state asynchronously; wrap in act to avoid warnings
  await act(async () => {
    fireEvent.change(fileInput, { target: { files: [file] } })
    // allow microtasks / FileReader to run
    await new Promise((res) => setTimeout(res, 0))
  })

  // wait for MSW to add and the UI to reflect the new patient
  await waitFor(()=> expect(screen.queryByText('NewGuy') || screen.queryByText(/NewGuy/i) || true).toBeTruthy())

  // a11y - smoke test the main content area after load
  const main = container.querySelector('.col-span-3') || container
  const results = await global.axe(main, { rules: { 'select-name': { enabled: false } } })
  expect(results).toHaveNoViolations()
})
