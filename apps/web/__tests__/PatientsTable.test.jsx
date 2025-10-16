import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import PatientsTable from '../components/PatientsTable'
import renderWithProviders from '../test-utils/renderWithProviders'

test('renders patients and toggles selection', async ()=>{
  const patients = [ { id:1, fullName: 'Ahmed', phoneNumber: '010', position: 1 }, { id:2, fullName: 'Mona', phoneNumber: '011', position: 2 } ]
  const toggle = jest.fn()
  const reorder = jest.fn()
  const { container } = renderWithProviders(<PatientsTable patients={patients} onToggle={toggle} onReorder={reorder} />)

  expect(screen.getByText('Ahmed')).toBeInTheDocument()
  const checkbox = screen.getByLabelText('select-patient-0')
  fireEvent.click(checkbox)
  expect(toggle).toHaveBeenCalledWith(0)

  // a11y check on the table
  const results = await global.axe(container)
  expect(results).toHaveNoViolations()
})

test('calls onReorder when dropping', async ()=>{
  const patients = [ { id:1, fullName: 'A', phoneNumber: '0', position:1 }, { id:2, fullName:'B', phoneNumber:'1', position:2 } ]
  const reorder = jest.fn()
  renderWithProviders(<PatientsTable patients={patients} onToggle={()=>{}} onReorder={reorder} />)
  const rows = screen.getAllByRole('row')
  // header + 2 rows
  expect(rows.length).toBeGreaterThanOrEqual(3)
  const firstDataRow = rows[1]
  const secondDataRow = rows[2]

  const dataTransfer = {
    setData: jest.fn(),
    getData: jest.fn(),
    effectAllowed: 'move',
    dropEffect: 'move'
  }

  fireEvent.dragStart(firstDataRow, { dataTransfer })
  fireEvent.dragOver(secondDataRow, { dataTransfer })
  fireEvent.drop(secondDataRow, { dataTransfer })

  expect(reorder).toHaveBeenCalled()

  // a11y smoke check after reorder interaction (scope to the table)
  const table = document.querySelector('table') || document.body
  const results2 = await global.axe(table)
  expect(results2).toHaveNoViolations()
})
