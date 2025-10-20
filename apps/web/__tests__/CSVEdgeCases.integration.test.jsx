import React from 'react'
import { screen, waitFor, fireEvent, act } from '@testing-library/react'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import Dashboard from '../pages/dashboard'
import { server } from '../mocks/server'
import { rest } from 'msw'

describe('CSV Edge Cases', () => {
  jest.setTimeout(20000) // Set a generous timeout for these integration tests

  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'

  test('CSV large file processes without crashing and adds final rows', async () => {
    renderWithProviders(<Dashboard />, {
      localStorage: { currentUser: JSON.stringify({ id: 1, role: 'primary_admin' }) },
    })

    // 1. Select the queue
    const queueBtn = await screen.findByText(/الطابور الأول/i)
    fireEvent.click(queueBtn)

    // 2. Wait for initial patients to load
    await waitFor(() => {
      expect(screen.getByText('Ali')).toBeInTheDocument()
    })

    // 3. Open CSV upload modal
    const uploadBtn = screen.getByRole('button', { name: 'رفع ملف المرضى' })
    fireEvent.click(uploadBtn)

    // 4. Create and upload a large CSV file
    let csv = 'fullName,phoneNumber\n'
    for (let i = 0; i < 100; i++) {
      csv += `User${i},09${1000 + i}\n`
    }
    const file = new File([csv], 'large.csv', { type: 'text/csv' })
    const input = screen.getByLabelText('رفع ملف المرضى (CSV)')

    // 5. Trigger the upload
    // The component now handles the file parsing and mutation calls internally
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } })
      // Give time for the mutations to be called and processed
      await new Promise(resolve => setTimeout(resolve, 2000))
    })

    // 6. Wait for the UI to reflect the new patients
    await waitFor(() => {
      // Check for the first and last users from the CSV
      expect(screen.getByText('User0')).toBeInTheDocument()
      expect(screen.getByText('User99')).toBeInTheDocument()
    }, { timeout: 15000 })

    // 7. Verify the total number of patients
    // 2 initial patients + 100 from CSV
    const rows = screen.getAllByRole('row')
    expect(rows.length).toBe(103) // 1 header row + 102 patient rows
  })

  test('CSV with empty lines between valid rows processes successfully', async () => {
    renderWithProviders(<Dashboard />, {
      localStorage: { currentUser: JSON.stringify({ id: 1, role: 'primary_admin' }) },
    })

    const queueBtn = await screen.findByText(/الطابور الأول/i)
    fireEvent.click(queueBtn)

    await waitFor(() => {
      expect(screen.getByText('Ali')).toBeInTheDocument()
    })

    const uploadBtn = screen.getByRole('button', { name: 'رفع ملف المرضى' })
    fireEvent.click(uploadBtn)

    const csv = 'fullName,phoneNumber\nUser1,091111\n\n\nUser2,092222\n\nUser3,093333'
    const file = new File([csv], 'gaps.csv', { type: 'text/csv' })
    const input = screen.getByLabelText('رفع ملف المرضى (CSV)')

    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } })
      await new Promise(resolve => setTimeout(resolve, 1000))
    })

    await waitFor(() => {
      expect(screen.getByText('User1')).toBeInTheDocument()
      expect(screen.getByText('User2')).toBeInTheDocument()
      expect(screen.getByText('User3')).toBeInTheDocument()
    }, { timeout: 10000 })

    // 2 initial + 3 from CSV
    const rows = screen.getAllByRole('row')
    expect(rows.length).toBe(6) // 1 header + 5 patients
  })

  test('CSV with duplicate entries shows warning and adds unique entries', async () => {
    // Mock the API to return a 409 conflict for duplicates
    server.use(
      rest.post(`${API_BASE}/api/queues/q1/patients`, async (req, res, ctx) => {
        const body = await req.json()
        if (body.fullName === 'DuplicateUser') {
          // Allow the first one, reject the second
          const patientsInQueue = screen.queryAllByRole('row').filter(r => r.textContent.includes('DuplicateUser'))
          if (patientsInQueue.length > 0) {
            return res(ctx.status(409), ctx.json({ message: 'Patient already exists' }))
          }
        }
        return res(ctx.status(201), ctx.json({ success: true, data: { id: Math.random(), ...body } }))
      })
    )

    renderWithProviders(<Dashboard />, {
      localStorage: { currentUser: JSON.stringify({ id: 1, role: 'primary_admin' }) },
    })

    const queueBtn = await screen.findByText(/الطابور الأول/i)
    fireEvent.click(queueBtn)
    
    await waitFor(() => {
      expect(screen.getByText('Ali')).toBeInTheDocument()
    })

    const uploadBtn = screen.getByRole('button', { name: 'رفع ملف المرضى' })
    fireEvent.click(uploadBtn)

    const csv = 'fullName,phoneNumber\nDuplicateUser,091111\nDuplicateUser,091111\nUniqueUser,092222'
    const file = new File([csv], 'duplicates.csv', { type: 'text/csv' })
    const input = screen.getByLabelText('رفع ملف المرضى (CSV)')
    
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } })
      await new Promise(resolve => setTimeout(resolve, 1500))
    })

    await waitFor(() => {
      // Check that the unique user and one instance of the duplicate user are present
      expect(screen.getByText('UniqueUser')).toBeInTheDocument()
      expect(screen.getAllByText('DuplicateUser').length).toBe(1)
    }, { timeout: 10000 })

    // Check for the toast message indicating failure for the duplicate
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/فشل إضافة المرضى|some patients failed/i)
  })

  test('CSV with very long names and numbers processes correctly', async () => {
    renderWithProviders(<Dashboard />, {
      localStorage: { currentUser: JSON.stringify({ id: 1, role: 'primary_admin' }) },
    })

    const queueBtn = await screen.findByText(/الطابور الأول/i)
    fireEvent.click(queueBtn)
    
    await waitFor(() => {
      expect(screen.getByText('Ali')).toBeInTheDocument()
    })

    const uploadBtn = screen.getByRole('button', { name: 'رفع ملف المرضى' })
    fireEvent.click(uploadBtn)

    const longName = 'محمد أحمد علي حسن محمود عبد الرحمن عبد الله'.repeat(3)
    const longNumber = '1234567890'.repeat(5)
    const csv = `fullName,phoneNumber\n${longName},${longNumber}`
    
    const file = new File([csv], 'long.csv', { type: 'text/csv' })
    const input = screen.getByLabelText('رفع ملف المرضى (CSV)')
    
    await act(async () => {
      fireEvent.change(input, { target: { files: [file] } })
      await new Promise(resolve => setTimeout(resolve, 1000))
    })

    await waitFor(() => {
      // Check if a truncated version of the long name is in the document
      expect(screen.getByText(new RegExp(longName.substring(0, 20)))).toBeInTheDocument()
    }, { timeout: 10000 })
  })
})