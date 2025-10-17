import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import PatientsTable from '../components/PatientsTable'
import renderWithProviders from '../test-utils/renderWithProviders'

describe('PatientsTable Component', () => {
  const mockPatients = [
    { id: 'p1', fullName: 'أحمد محمد', phoneNumber: '123456789', position: 1 },
    { id: 'p2', fullName: 'محمد علي', phoneNumber: '987654321', position: 2 },
    { id: 'p3', fullName: 'علي حسن', phoneNumber: '456789123', position: 3 }
  ]

  test('renders table structure and headers correctly', async () => {
    const { container } = renderWithProviders(<PatientsTable patients={mockPatients} />)

    // Check table structure
    expect(screen.getByRole('table', { name: 'قائمة المرضى' })).toBeInTheDocument()

  // Check headers (updated to prototype labels)
  expect(screen.getByText('تحديد الكل')).toBeInTheDocument()
  expect(screen.getByText('سحب')).toBeInTheDocument()
  expect(screen.getByText('الاسم الكامل')).toBeInTheDocument()
  expect(screen.getByText('رقم الهاتف')).toBeInTheDocument()
  expect(screen.getByText('الترتيب')).toBeInTheDocument()

    // Accessibility check
    const results = await global.axe(container)
    expect(results).toHaveNoViolations()
  })

  test('renders patient data and handles selection', async () => {
    const toggle = jest.fn()
    const { container } = renderWithProviders(
      <PatientsTable patients={mockPatients} onToggle={toggle} />
    )

    // Check patient data
    mockPatients.forEach((patient, index) => {
      expect(screen.getByText(patient.fullName)).toBeInTheDocument()
      expect(screen.getByText(patient.phoneNumber)).toBeInTheDocument()
      expect(screen.getByText(patient.position.toString())).toBeInTheDocument()
      
      // Check checkbox
      const checkbox = screen.getByLabelText(`select-patient-${index}`)
      fireEvent.click(checkbox)
      expect(toggle).toHaveBeenCalledWith(index)
    })

    // Accessibility check after interactions
    const results = await global.axe(container)
    expect(results).toHaveNoViolations()
  })

  test('handles drag and drop reordering', async () => {
    const reorder = jest.fn()
    const { container } = renderWithProviders(
      <PatientsTable patients={mockPatients} onToggle={() => {}} onReorder={reorder} />
    )

    const rows = screen.getAllByRole('row').slice(1) // Skip header row
    const dataTransfer = {
      setData: jest.fn(),
      getData: jest.fn(),
      effectAllowed: 'move',
      dropEffect: 'move'
    }

    // Test drag and drop
    fireEvent.dragStart(rows[0], { dataTransfer })
    fireEvent.dragOver(rows[2], { dataTransfer })
    fireEvent.drop(rows[2], { dataTransfer })

    expect(reorder).toHaveBeenCalledWith(0, 2)

    // Accessibility check after drag interaction
    const results = await global.axe(container)
    expect(results).toHaveNoViolations()
  })

  test('handles keyboard interactions', async () => {
    const toggle = jest.fn()
    const { container } = renderWithProviders(
      <PatientsTable patients={mockPatients} onToggle={toggle} />
    )

    const rows = screen.getAllByRole('row').slice(1)

    // Test Enter key
    fireEvent.keyDown(rows[0], { key: 'Enter' })
    expect(toggle).toHaveBeenCalledWith(0)

    // Test Space key
    fireEvent.keyDown(rows[1], { key: ' ' })
    expect(toggle).toHaveBeenCalledWith(1)

    // Test invalid key
    fireEvent.keyDown(rows[2], { key: 'A' })
    expect(toggle).toHaveBeenCalledTimes(2)

    // Accessibility check after keyboard interactions
    const results = await global.axe(container)
    expect(results).toHaveNoViolations()
  })

  test('handles optimistic updates', async () => {
    const optimisticPatients = [
      { ...mockPatients[0], _optimistic: true },
      ...mockPatients.slice(1)
    ]

    const { container } = renderWithProviders(
      <PatientsTable patients={optimisticPatients} />
    )

    const rows = screen.getAllByRole('row').slice(1)
    expect(rows[0]).toHaveClass('opacity-70')
    expect(rows[1]).not.toHaveClass('opacity-70')

    // Accessibility check for optimistic UI
    const results = await global.axe(container)
    expect(results).toHaveNoViolations()
  })

  test('handles empty state', async () => {
    const { container } = renderWithProviders(
      <PatientsTable patients={[]} />
    )

    // Should render table structure
    expect(screen.getByRole('table')).toBeInTheDocument()
  // Header row + empty-state row
  expect(screen.getAllByRole('row')).toHaveLength(2)

    // Accessibility check for empty state
    const results = await global.axe(container)
    expect(results).toHaveNoViolations()
  })

  test('has proper RTL support', async () => {
    const { container } = renderWithProviders(
      <PatientsTable patients={mockPatients} />
    )

    // Check text alignment
    const cells = screen.getAllByRole('cell')
    cells.forEach(cell => {
      expect(cell).toHaveClass('text-right')
    })

    // Accessibility check for RTL layout
    const results = await global.axe(container)
    expect(results).toHaveNoViolations()
  })
})
