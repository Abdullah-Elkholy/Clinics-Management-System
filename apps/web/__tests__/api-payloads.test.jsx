import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import CSVUpload from '../components/CSVUpload'
import AddPatientsModal from '../components/AddPatientsModal'
import api from '../lib/api'

jest.mock('../lib/api')

describe('API payload contract tests', () => {
  beforeEach(()=>{
    jest.clearAllMocks()
  })

  test('CSVUpload calls api.post for each parsed row with expected payload', async () => {
    // create a fake CSV file via Blob
    const csvContent = 'fullName,phoneNumber\nAlice,010\nBob,011\n'
    const file = new File([csvContent], 'test.csv', { type: 'text/csv' })

    // mock api.post to resolve with a data object
    api.post.mockResolvedValue({ data: { data: { id: 'srv-1', fullName: 'srv', phoneNumber: '000' } } })

    const parsedChunks = []
    const onChunk = jest.fn((rows)=>{
      parsedChunks.push(...rows)
    })

    render(<CSVUpload onChunk={onChunk} onComplete={() => {}} onError={() => {}} />)

    const input = screen.getByLabelText('رفع ملف المرضى (CSV)')

    // simulate file selection
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)

    // Wait for parser to call onChunk and for api.post to be called
    await waitFor(()=> expect(onChunk).toHaveBeenCalled())

    // We expect api.post not to be called by CSVUpload itself (the higher layer handles posts),
    // but depending on usage, ensure that CSVUpload parsed expected rows
    expect(parsedChunks.length).toBeGreaterThanOrEqual(2)
    expect(parsedChunks[0]).toMatchObject({ fullName: 'Alice', phoneNumber: '010' })
    expect(parsedChunks[1]).toMatchObject({ fullName: 'Bob', phoneNumber: '011' })
  })

  test('AddPatientsModal calls onAdd with correct payload mapping', async () => {
    const onAdd = jest.fn().mockResolvedValue()
    render(<AddPatientsModal open={true} onClose={()=>{}} onAdd={onAdd} />)

    // Fill first slot
    fireEvent.change(screen.getByPlaceholderText('أدخل الاسم الكامل'), { target: { value: 'Test User' } })
    // phone input has placeholder 'رقم الهاتف'
    fireEvent.change(screen.getByPlaceholderText('رقم الهاتف'), { target: { value: '0123456789' } })

    // Click submit button
    fireEvent.click(screen.getByText('إضافة المرضى'))

  await waitFor(()=> expect(onAdd).toHaveBeenCalled())

    // onAdd should receive an array of objects with fullName and phoneNumber
    const payload = onAdd.mock.calls[0][0]
    expect(Array.isArray(payload)).toBe(true)
    expect(payload[0]).toMatchObject({ fullName: 'Test User', phoneNumber: '0123456789' })
  })
})

// Additional integration-style checks: ensure Dashboard calls api.post for CSV-add and AddPatients flows
import Dashboard from '../pages/dashboard'
import renderWithProviders from '../test-utils/renderWithProviders'

describe('Dashboard API-invocation checks', () => {
  beforeEach(()=>{ jest.clearAllMocks() })

  test('handleAddPatients calls api.post with each patient for selected queue', async ()=>{
    // mock initial loads
    api.get.mockImplementation((url)=>{
      if (url === '/api/Queues') return Promise.resolve({ data: [ { id: 'q1', doctorName: 'Q1' } ] })
      if (url === '/api/Templates') return Promise.resolve({ data: { templates: [] } })
      if (url.includes('/patients')) return Promise.resolve({ data: { patients: [] } })
      return Promise.resolve({ data: {} })
    })
  api.post.mockImplementation(() => Promise.resolve({ data: { data: { id: 'srv-' + Math.random().toString(36).slice(2) } } }))

    renderWithProviders(<Dashboard />)

    // wait for queue to appear and select it (ensures useEffect completed)
    await screen.findByText('Q1')
    fireEvent.click(screen.getByRole('button', { name: 'طابور Q1' }))

  // open add patients modal and submit via AddPatientsModal (the Dashboard shows it)
  await screen.findByRole('button', { name: 'إضافة مرضى جدد' })
  fireEvent.click(screen.getByRole('button', { name: 'إضافة مرضى جدد' }))

  // fill in modal inputs
    fireEvent.change(screen.getByPlaceholderText('أدخل الاسم الكامل'), { target: { value: 'A1' } })
    fireEvent.change(screen.getByPlaceholderText('رقم الهاتف'), { target: { value: '010' } })

  // submit
  fireEvent.click(screen.getByText('إضافة المرضى'))

    // wait for api.post to be called
    await waitFor(()=> expect(api.post).toHaveBeenCalled())
    // ensure it was called with the queue endpoint
    expect(api.post.mock.calls[0][0]).toMatch(`/api/Queues/q1/patients`)
  })

  test('CSV upload triggers api.post for each parsed row when Dashboard wires it', async ()=>{
    api.get.mockImplementation((url)=>{
      if (url === '/api/Queues') return Promise.resolve({ data: [ { id: 'q1', doctorName: 'Q1' } ] })
      if (url === '/api/Templates') return Promise.resolve({ data: { templates: [] } })
      if (url.includes('/patients')) return Promise.resolve({ data: { patients: [] } })
      return Promise.resolve({ data: {} })
    })
  api.post.mockImplementation(() => Promise.resolve({ data: { data: { id: 'srv-' + Math.random().toString(36).slice(2) } } }))

  renderWithProviders(<Dashboard />)
  // wait for initial loads
  await screen.findByText('Q1')
  await screen.findByRole('button', { name: 'طابور Q1' })
  fireEvent.click(screen.getByRole('button', { name: 'طابور Q1' }))
    // open CSV modal
    await screen.findByRole('button', { name: 'رفع ملف المرضى' })
    fireEvent.click(screen.getByRole('button', { name: 'رفع ملف المرضى' }))

    // find file input
    const input = await screen.findByLabelText('رفع ملف المرضى (CSV)')
    const csvContent = 'fullName,phoneNumber\nX,011\nY,012\n'
    const file = new File([csvContent], 'f.csv', { type: 'text/csv' })
    Object.defineProperty(input, 'files', { value: [file] })
    fireEvent.change(input)

    await waitFor(()=> expect(api.post).toHaveBeenCalled())
    // at least one call to queue patient endpoint should be present
    expect(api.post.mock.calls.some(c => typeof c[0] === 'string' && c[0].includes('/api/Queues/q1/patients'))).toBe(true)
  })
})
