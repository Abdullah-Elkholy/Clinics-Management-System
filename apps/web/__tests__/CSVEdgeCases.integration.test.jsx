import React from 'react'
import { screen, waitFor, fireEvent, act, prettyDOM } from '@testing-library/react'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import App from '../pages/_app'
import Dashboard from '../pages/dashboard'
import { server } from '../mocks/server'
import { rest } from 'msw'

// Debug logging utility
const debug = (msg, data) => {
  console.log(`[DEBUG] ${msg}:`, data)
}

describe('CSV Edge Cases', () => {
  jest.setTimeout(15000) // Global timeout for all tests
  
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'
  
  // Track API calls for debugging
  let apiCalls = []
  
  beforeEach(() => {
    apiCalls = []
    console.log('\n--- Starting new test ---\n')
    
    // Setup enhanced server mock with debugging
    server.use(
      rest.post(API_BASE + '/api/queues/:queueId/patients', async (req, res, ctx) => {
        const body = await req.json()
        apiCalls.push({ endpoint: 'patients', body })
        debug('API Call', { body })
        
        return res(ctx.status(201), ctx.json({
          success: true,
          data: {
            id: Math.random().toString(36),
            ...body,
            position: apiCalls.length
          }
        }))
      })
    )
  })

  afterEach(() => {
    debug('Total API calls', apiCalls.length)
    if (screen.queryByRole('alert')) {
      debug('Alert content', screen.getByRole('alert').textContent)
    }
  })

  test('CSV large file processes without crashing and adds final rows', async () => {
    const { container } = renderWithProviders(
      <App Component={Dashboard} pageProps={{}} />, 
      { localStorage: { currentUser: JSON.stringify({ id:1, role: 'primary_admin' }) } }
    )
    
    const queueBtn = await screen.findByText(/الطابور الأول/i)
    debug('Queue button found', queueBtn.textContent)
    
    fireEvent.click(queueBtn)
    debug('Clicked queue button')
    
    await waitFor(() => {
      const initialContent = screen.queryByText('Ali')
      debug('Initial content check', initialContent?.textContent)
      expect(initialContent).toBeInTheDocument()
    })

    const uploadBtn = screen.getByRole('button', { name: 'رفع ملف المرضى' })
    debug('Upload button found', uploadBtn.textContent)
    fireEvent.click(uploadBtn)
    
    // Create and upload large CSV
    let csv = 'fullName,phoneNumber\n'
    for (let i = 0; i < 100; i++) {
      csv += `User${i},09${1000+i}\n`
    }
    debug('CSV content created', { rows: csv.split('\n').length })
    
    const file = new File([csv], 'large.csv', { type: 'text/csv' })
    const input = screen.getByLabelText('رفع ملف المرضى (CSV)')
    
    await act(async () => {
      debug('Triggering file upload')
      fireEvent.change(input, { target: { files: [file] } })
      await new Promise(resolve => setTimeout(resolve, 1000))
    })

    await waitFor(() => {
      const table = screen.getByRole('table')
      debug('Table HTML', table.innerHTML)
      
      const rows = screen.getAllByRole('row')
      debug('Found rows', rows.length)
      
      const cellTexts = rows.map(row => row.textContent)
      debug('Cell contents', cellTexts)
      
      expect(cellTexts.join(' ')).toMatch(/User0.*User99/)
    }, { timeout: 10000 })
  })

  test('CSV with empty lines between valid rows processes successfully', async () => {
    const { container } = renderWithProviders(
      <App Component={Dashboard} pageProps={{}} />,
      { localStorage: { currentUser: JSON.stringify({ id:1, role: 'primary_admin' }) } }
    )

    const queueBtn = await screen.findByText(/الطابور الأول/i)
    debug('Queue button found')
    
    fireEvent.click(queueBtn)
    debug('Clicked queue button')

    await waitFor(() => {
      const initialContent = screen.queryByText('Ali')
      debug('Initial content check', initialContent?.textContent)
      expect(initialContent).toBeInTheDocument()
    })

    const uploadBtn = screen.getByRole('button', { name: 'رفع ملف المرضى' })
    debug('Found upload button')
    fireEvent.click(uploadBtn)

    const csv = 'fullName,phoneNumber\nUser1,091111\n\n\nUser2,092222\n\nUser3,093333'
    debug('CSV Content', {
      rawContent: csv,
      lines: csv.split('\n'),
      emptyLines: csv.split('\n').filter(line => !line.trim()).length
    })
    
    const file = new File([csv], 'gaps.csv', { type: 'text/csv' })
    const input = screen.getByLabelText('رفع ملف المرضى (CSV)')
    
    await act(async () => {
      debug('Uploading file with empty lines')
      fireEvent.change(input, { target: { files: [file] } })
      await new Promise(resolve => setTimeout(resolve, 1000))
    })

    await waitFor(() => {
      const table = screen.getByRole('table')
      debug('Table content after upload', table.innerHTML)
      
      const rows = Array.from(screen.getAllByRole('row')).slice(1) // Skip header
      debug('Found rows', rows.length)
      
      // Get text content for all cells
      const rowContents = rows.map(row => {
        const cells = row.querySelectorAll('td')
        return Array.from(cells).map(cell => cell.textContent.trim()).join(',')
      })
      debug('Row contents', rowContents)

      // Check each expected user is present
      const expectedUsers = ['User1', 'User2', 'User3']
      for (const user of expectedUsers) {
        const userFound = rowContents.some(content => content.includes(user))
        if (!userFound) {
          debug('Missing user', { user, currentRows: rowContents })
          throw new Error(`User ${user} not found in table`)
        }
      }
      
      // Verify no empty rows
      const emptyRows = rows.filter(row => !row.textContent.trim())
      debug('Empty rows found', emptyRows.length)
      expect(emptyRows.length).toBe(0)
    }, { timeout: 10000 })
  })

  test('CSV with duplicate entries shows warning and adds unique entries', async () => {
    // Setup duplicate detection mock
    let processedUsers = new Set()
    server.use(
      rest.post(API_BASE + '/api/queues/:queueId/patients', async (req, res, ctx) => {
        const body = await req.json()
        debug('Processing user', body)
        
        if (processedUsers.has(body.fullName)) {
          debug('Duplicate user detected', body.fullName)
          return res(ctx.status(409), ctx.json({
            success: false,
            message: 'Patient already exists'
          }))
        }
        
        processedUsers.add(body.fullName)
        debug('Added new user', body.fullName)
        
        return res(ctx.status(201), ctx.json({
          success: true,
          data: {
            id: Math.random().toString(36),
            ...body,
            position: processedUsers.size
          }
        }))
      })
    )

    const { container } = renderWithProviders(
      <App Component={Dashboard} pageProps={{}} />,
      { localStorage: { currentUser: JSON.stringify({ id:1, role: 'primary_admin' }) } }
    )

    const queueBtn = await screen.findByText(/الطابور الأول/i)
    fireEvent.click(queueBtn)
    
    await waitFor(() => {
      expect(screen.getByText('Ali')).toBeInTheDocument()
    })

    const uploadBtn = screen.getByRole('button', { name: 'رفع ملف المرضى' })
    fireEvent.click(uploadBtn)

    const csv = 'fullName,phoneNumber\nDuplicateUser,091111\nDuplicateUser,091111\nUniqueUser,092222'
    debug('CSV Content', {
      content: csv,
      lines: csv.split('\n')
    })
    
    const file = new File([csv], 'duplicates.csv', { type: 'text/csv' })
    const input = screen.getByLabelText('رفع ملف المرضى (CSV)')
    
    await act(async () => {
      debug('Uploading file with duplicates')
      fireEvent.change(input, { target: { files: [file] } })
      await new Promise(resolve => setTimeout(resolve, 1000))
    })

    // First wait for the unique user to appear
    await waitFor(() => {
      const uniqueUser = screen.getByText((content, element) => {
        return element.textContent.includes('UniqueUser')
      })
      debug('Found unique user', uniqueUser.textContent)
    }, { timeout: 10000 })

    // Then check for duplicate handling
    await waitFor(() => {
      const rows = Array.from(screen.getAllByRole('row')).slice(1) // Skip header
      const cellTexts = rows.map(row => row.textContent)
      debug('Table contents', cellTexts)
      
      // Should only have one instance of DuplicateUser
      const duplicateRows = rows.filter(row => row.textContent.includes('DuplicateUser'))
      debug('Duplicate rows found', duplicateRows.length)
      expect(duplicateRows.length, 'Should only have one instance of duplicate user').toBe(1)
      
      // Should have unique user
      const uniqueRows = rows.filter(row => row.textContent.includes('UniqueUser'))
      expect(uniqueRows.length, 'Should have unique user').toBe(1)
      
      // Should show warning about duplicates
      const alert = screen.getByRole('alert')
      debug('Alert message', alert.textContent)
      expect(alert.textContent).toMatch(/مكررة|duplicate/i)
    }, { timeout: 10000 })
  })

  test('CSV with very long names and numbers processes correctly', async () => {
    const { container } = renderWithProviders(
      <App Component={Dashboard} pageProps={{}} />,
      { localStorage: { currentUser: JSON.stringify({ id:1, role: 'primary_admin' }) } }
    )

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
    
    debug('CSV Content', {
      nameLength: longName.length,
      numberLength: longNumber.length
    })
    
    const file = new File([csv], 'long.csv', { type: 'text/csv' })
    const input = screen.getByLabelText('رفع ملف المرضى (CSV)')
    
    await act(async () => {
      debug('Uploading file with long content')
      fireEvent.change(input, { target: { files: [file] } })
      await new Promise(resolve => setTimeout(resolve, 1000))
    })

    await waitFor(() => {
      const rows = screen.getAllByRole('row')
      debug('Found rows', rows.length)
      
      // Look for the row containing our long name
      const patientRows = Array.from(rows).slice(1) // Skip header
      const longNameRow = patientRows.find(row => {
        const text = row.textContent
        debug('Checking row', { text })
        return text.includes('محمد أحمد علي')
      })
      
      expect(longNameRow, 'Row with long name should exist').toBeTruthy()
      
      const cells = longNameRow.querySelectorAll('td')
      const nameCell = cells[0]
      const phoneCell = cells[1]
      
      debug('Found cells', {
        nameCellText: nameCell?.textContent,
        phoneCellText: phoneCell?.textContent
      })
      
      // Name should be truncated with tooltip
      expect(nameCell.textContent.length).toBeLessThan(longName.length)
      expect(nameCell.textContent.endsWith('...') || nameCell.textContent.endsWith('…')).toBe(true)
      expect(nameCell).toHaveAttribute('title', longName)
      
      // Phone should be formatted
      const cleanPhone = phoneCell.textContent.replace(/\D/g, '')
      expect(cleanPhone.slice(0, 15)).toBe(longNumber.slice(0, 15))
    }, { timeout: 10000 })
  })
})