import React from 'react'
import { screen, waitFor, fireEvent, act } from '@testing-library/react'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import App from '../pages/_app'
import Dashboard from '../pages/dashboard'
import { server } from '../mocks/server'
import { rest } from 'msw'

describe('Queue View Edge Cases', () => {
  test('handles very large queue list without performance issues', async () => {
    // Mock API to return large queue list
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'
    const largeQueueList = Array.from({ length: 100 }, (_, i) => ({
      id: `q${i}`,
      name: `طابور ${i}`,
      patientCount: Math.floor(Math.random() * 100)
    }))

    server.use(
      rest.get(API_BASE + '/api/queues', (req, res, ctx) => {
        return res(ctx.status(200), ctx.json({ success: true, data: largeQueueList }))
      })
    )

    renderWithProviders(<App Component={Dashboard} pageProps={{}} />, 
      { localStorage: { currentUser: JSON.stringify({ id:1, role: 'primary_admin' }) } }
    )

    // Wait for queues to load and check rendering
    await waitFor(() => {
      const queueItems = screen.getAllByRole('button', { name: /طابور \d+/i })
      expect(queueItems.length).toBe(100)
      
      // Check virtualization - not all items should be in DOM
      const actualDOMItems = document.querySelectorAll('[data-queue-item]')
      expect(actualDOMItems.length).toBeLessThan(100)
    })

    // Test scroll behavior
    const queueList = screen.getByRole('list', { name: /قائمة الطوابير/i })
    fireEvent.scroll(queueList, { target: { scrollTop: 1000 } })

    // Wait for new items to load after scroll
    await waitFor(() => {
      const lastQueueVisible = screen.getByText('طابور 99')
      expect(lastQueueVisible).toBeInTheDocument()
    })
  })

  test('handles queue with zero patients correctly', async () => {
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'
    server.use(
      rest.get(API_BASE + '/api/queues/:queueId/patients', (req, res, ctx) => {
        return res(ctx.status(200), ctx.json({ success: true, data: [] }))
      })
    )

    renderWithProviders(<App Component={Dashboard} pageProps={{}} />,
      { localStorage: { currentUser: JSON.stringify({ id:1, role: 'primary_admin' }) } }
    )

    const queueBtn = await screen.findByText(/الطابور الأول/i)
    fireEvent.click(queueBtn)

    // Should show empty state message
    await waitFor(() => {
      expect(screen.getByText('لا يوجد مرضى في هذا الطابور')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'رفع ملف المرضى' })).toBeInTheDocument()
    })
  })

  test('handles connection loss during queue operations', async () => {
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'
    let connectionLost = false

    server.use(
      rest.get(API_BASE + '/api/queues/:queueId/patients', (req, res, ctx) => {
        if (connectionLost) {
          return res(ctx.status(503), ctx.json({ success: false, message: 'Service Unavailable' }))
        }
        return res(ctx.status(200), ctx.json({ success: true, data: [] }))
      })
    )

    renderWithProviders(<App Component={Dashboard} pageProps={{}} />,
      { localStorage: { currentUser: JSON.stringify({ id:1, role: 'primary_admin' }) } }
    )

    // Load queue initially
    const queueBtn = await screen.findByText(/الطابور الأول/i)
    fireEvent.click(queueBtn)
    await waitFor(() => {
      expect(screen.getByText('لا يوجد مرضى في هذا الطابور')).toBeInTheDocument()
    })

    // Simulate connection loss
    connectionLost = true
    
    // Try to refresh queue
    const refreshBtn = screen.getByRole('button', { name: 'تحديث القائمة' })
    fireEvent.click(refreshBtn)

    // Should show connection error
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('فشل الاتصال بالخادم')
    })
  })

  test('handles concurrent queue modifications correctly', async () => {
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'
    let patients = [
      { id: 'p1', fullName: 'مريض 1', phoneNumber: '123456789', position: 1 },
      { id: 'p2', fullName: 'مريض 2', phoneNumber: '987654321', position: 2 }
    ]

    server.use(
      rest.get(API_BASE + '/api/queues/:queueId/patients', (req, res, ctx) => {
        return res(ctx.status(200), ctx.json({ success: true, data: patients }))
      }),
      rest.delete(API_BASE + '/api/queues/:queueId/patients/:patientId', (req, res, ctx) => {
        const { patientId } = req.params
        patients = patients.filter(p => p.id !== patientId)
        return res(ctx.status(200), ctx.json({ success: true }))
      })
    )

    renderWithProviders(<App Component={Dashboard} pageProps={{}} />,
      { localStorage: { currentUser: JSON.stringify({ id:1, role: 'primary_admin' }) } }
    )

    // Load queue
    const queueBtn = await screen.findByText(/الطابور الأول/i)
    fireEvent.click(queueBtn)

    // Wait for patients to load
    await waitFor(() => {
      expect(screen.getByText('مريض 1')).toBeInTheDocument()
      expect(screen.getByText('مريض 2')).toBeInTheDocument()
    })

    // Delete first patient
    const deleteBtn = screen.getAllByRole('button', { name: /حذف المريض/i })[0]
    fireEvent.click(deleteBtn)

    // Confirm deletion
    const confirmBtn = screen.getByRole('button', { name: /تأكيد/i })
    fireEvent.click(confirmBtn)

    // Check that UI updates correctly
    await waitFor(() => {
      expect(screen.queryByText('مريض 1')).not.toBeInTheDocument()
      expect(screen.getByText('مريض 2')).toBeInTheDocument()
    })
  })

  test('handles extremely long queue names appropriately', async () => {
    const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'
    const longQueueName = 'طابور المرضى المحولين من العيادة الخارجية إلى قسم الطوارئ مع حالات خاصة تحتاج لرعاية فورية'
    
    server.use(
      rest.get(API_BASE + '/api/queues', (req, res, ctx) => {
        return res(ctx.status(200), ctx.json({
          success: true,
          data: [{ id: 'q1', name: longQueueName, patientCount: 5 }]
        }))
      })
    )

    renderWithProviders(<App Component={Dashboard} pageProps={{}} />,
      { localStorage: { currentUser: JSON.stringify({ id:1, role: 'primary_admin' }) } }
    )

    // Wait for queue to load
    await waitFor(() => {
      const queueBtn = screen.getByRole('button', { name: new RegExp(longQueueName.slice(0, 20)) })
      
      // Should be truncated in UI
      expect(queueBtn.textContent).not.toBe(longQueueName)
      
      // Full name should be available in title/tooltip
      expect(queueBtn).toHaveAttribute('title', longQueueName)
    })
  })
})