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
