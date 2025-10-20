import React from 'react'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { rest } from 'msw'
import { server } from '../mocks/server'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import { ROLES } from '../lib/roles'
import Dashboard from '../pages/dashboard'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'

describe('Dashboard error handling and toast behavior', () => {
  test('shows toast when template load fails', async () => {
    server.use(
      rest.get(`${API_BASE}/api/Templates`, (req, res, ctx) => {
        return res(ctx.status(500))
      })
    )

  renderWithProviders(<Dashboard />, { auth: { user: { id:1, role: ROLES.PRIMARY_ADMIN } } })

    // Queues should still load
    await screen.findByText('الطابور الأول')

    // The dashboard should show an error toast.
    // The queries run automatically, so we just need to wait for the result.
    await screen.findByText(/فشل تحميل قوالب الرسائل/i)
  })

  test('handles create-queue 405 by showing an error toast', async () => {
    server.use(
      rest.post(`${API_BASE}/api/Queues`, (req, res, ctx) => {
        return res(ctx.status(405), ctx.json({ message: 'Not allowed' }))
      })
    )

    renderWithProviders(<Dashboard />, { auth: { user: { id:1, role: ROLES.PRIMARY_ADMIN } } })
    await screen.findByText('الطابور الأول')

    // open add queue modal
    fireEvent.click(screen.getByRole('button', { name: 'إضافة طابور' }))
    await screen.findByText('إضافة طابور جديد')

    // fill and submit
    fireEvent.change(screen.getByLabelText('اسم الطابور'), { target: { value: 'New Queue' } })
    fireEvent.click(screen.getByRole('button', { name: 'إضافة' }))

    // check for toast
    await screen.findByText(/Method Not Allowed/i)
  })
})
