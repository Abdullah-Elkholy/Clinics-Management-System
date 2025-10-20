import React from 'react'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import { ROLES } from '../lib/roles'
import Dashboard from '../pages/dashboard'
import { resetMockData } from '../mocks/handlers'
import { server } from '../mocks/server'
import { rest } from 'msw'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'


describe('delete-selected', ()=>{
  beforeEach(()=> resetMockData())

  test('removes selected patients on success', async ()=>{
  renderWithProviders(<Dashboard />, { auth: { user: { id:1, role: ROLES.PRIMARY_ADMIN } } })
    const queueBtn = await screen.findByText(/الطابور الأول/i)
    fireEvent.click(queueBtn)
    await waitFor(()=> expect(screen.getByText('Ali')).toBeInTheDocument())

    // select Ali and Sara
    fireEvent.click(screen.getByLabelText('select-patient-0'))
    fireEvent.click(screen.getByLabelText('select-patient-1'))

    // click delete
    fireEvent.click(screen.getByRole('button', { name: 'حذف المحدد' }))

    // Ali and Sara should be gone
    await waitFor(() => {
      expect(screen.queryByText('Ali')).not.toBeInTheDocument()
      expect(screen.queryByText('Sara')).not.toBeInTheDocument()
    })
  })

  test('shows failure when API fails', async ()=>{
    server.use(
      rest.post(`${API_BASE}/api/patients/delete-many`, (req, res, ctx) =>
        res(ctx.status(500), ctx.json({ message: 'Internal Server Error' }))
      )
    )
  renderWithProviders(<Dashboard />, { auth: { user: { id:1, role: ROLES.PRIMARY_ADMIN } } })
    const queueBtn = await screen.findByText(/الطابور الأول/i)
    fireEvent.click(queueBtn)
    await waitFor(()=> expect(screen.getByText('Ali')).toBeInTheDocument())

    // select Ali and Sara
    fireEvent.click(screen.getByLabelText('select-patient-0'))
    fireEvent.click(screen.getByLabelText('select-patient-1'))

    // click delete
    fireEvent.click(screen.getByRole('button', { name: 'حذف المحدد' }))

    // Should show error toast
    await screen.findByText(/فشل حذف المرضى/i)

    // Ali and Sara should still be there
    expect(screen.getByText('Ali')).toBeInTheDocument()
    expect(screen.getByText('Sara')).toBeInTheDocument()
  })
})
