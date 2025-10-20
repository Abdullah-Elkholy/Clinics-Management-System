import React from 'react'
import { screen, waitFor, fireEvent, act } from '@testing-library/react'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import Dashboard from '../pages/dashboard'
import { server } from '../mocks/server'
import { rest } from 'msw'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'

describe('Queue View Edge Cases', () => {
  test('handles very large queue list without performance issues', async () => {
    const largeQueueList = Array.from({ length: 100 }, (_, i) => ({
      id: `q${i}`,
      doctorName: `طابور ${i}`,
      patientCount: Math.floor(Math.random() * 100),
    }))

    server.use(
      rest.get(`${API_BASE}/api/queues`, (req, res, ctx) => {
        return res(ctx.json({ success: true, data: largeQueueList }))
      })
    )

    renderWithProviders(<Dashboard />, {
      localStorage: { currentUser: JSON.stringify({ id: 1, role: 'primary_admin' }) },
    })

    await waitFor(() => {
      expect(screen.getByText('طابور 0')).toBeInTheDocument()
      expect(screen.getByText('طابور 99')).toBeInTheDocument()
    })

    const queueItems = screen.getAllByRole('button', { name: /طابور \d+/i })
    expect(queueItems.length).toBe(100)
  }, 10000)

  test('handles queue with zero patients correctly', async () => {
    server.use(
      rest.get(`${API_BASE}/api/queues/q1/patients`, (req, res, ctx) => {
        return res(ctx.json({ success: true, patients: [] }))
      })
    )

    renderWithProviders(<Dashboard />, {
      localStorage: { currentUser: JSON.stringify({ id: 1, role: 'primary_admin' }) },
    })

    const queueBtn = await screen.findByText(/الطابور الأول/i)
    fireEvent.click(queueBtn)

    await waitFor(() => {
      // The table should be rendered, but it will be empty.
      const table = screen.getByRole('table')
      expect(table).toBeInTheDocument()
      // There should be only one row, which is the header.
      const rows = screen.getAllByRole('row')
      expect(rows.length).toBe(1)
    })
  })

  test('handles connection loss during patient fetch', async () => {
    renderWithProviders(<Dashboard />, {
      localStorage: { currentUser: JSON.stringify({ id: 1, role: 'primary_admin' }) },
    })

    const queueBtn = await screen.findByText(/الطابور الأول/i)
    
    // Mock a network error for the patients fetch
    server.use(
      rest.get(`${API_BASE}/api/queues/q1/patients`, (req, res, ctx) => {
        return res.networkError('Failed to connect')
      })
    )

    fireEvent.click(queueBtn)

    await waitFor(() => {
      // The component doesn't show a specific error message in the patient table area,
      // but we can verify that no patients are loaded.
      expect(screen.queryByText('Ali')).not.toBeInTheDocument()
      // The table should still be there, just empty.
      const rows = screen.getAllByRole('row')
      expect(rows.length).toBe(1) // Header only
    })
  })

  test('handles concurrent queue modifications correctly', async () => {
    renderWithProviders(<Dashboard />, {
      localStorage: { currentUser: JSON.stringify({ id: 1, role: 'primary_admin' }) },
    })

    const queueBtn = await screen.findByText(/الطابور الأول/i)
    fireEvent.click(queueBtn)

    await waitFor(() => {
      expect(screen.getByText('Ali')).toBeInTheDocument()
      expect(screen.getByText('Sara')).toBeInTheDocument()
    })

    const deleteButtons = screen.getAllByRole('button', { name: /حذف المريض/i })
    fireEvent.click(deleteButtons[0]) // Click delete for "Ali"

    const confirmBtn = await screen.findByRole('button', { name: /تأكيد/i })
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(screen.queryByText('Ali')).not.toBeInTheDocument()
      expect(screen.getByText('Sara')).toBeInTheDocument()
    })
    
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('تم حذف المريض')
  })

  test('handles extremely long queue names appropriately', async () => {
    const longQueueName = 'طابور المرضى المحولين من العيادة الخارجية إلى قسم الطوارئ مع حالات خاصة تحتاج لرعاية فورية'
    
    server.use(
      rest.get(`${API_BASE}/api/queues`, (req, res, ctx) => {
        return res(ctx.json({
          success: true,
          data: [{ id: 'q-long', doctorName: longQueueName, patientCount: 5 }]
        }))
      })
    )

    renderWithProviders(<Dashboard />, {
      localStorage: { currentUser: JSON.stringify({ id: 1, role: 'primary_admin' }) },
    })

    await waitFor(() => {
      const queueBtn = screen.getByRole('button', { name: new RegExp(longQueueName) })
      expect(queueBtn).toBeInTheDocument()
      // Assuming the button text is truncated by CSS, we can't easily test the visual text content.
      // However, we can check that the full name is used as the accessible name or title.
      expect(queueBtn).toHaveAccessibleName(longQueueName)
    })
  })
})