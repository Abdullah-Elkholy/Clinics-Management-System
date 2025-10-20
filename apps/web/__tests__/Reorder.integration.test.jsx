import React from 'react'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import { ROLES } from '../lib/roles'
import Dashboard from '../pages/dashboard'
import api from '../lib/api'

test('reorder patients via API updates table order', async ()=>{
  renderWithProviders(<Dashboard />, { auth: { user: { id:1, role: ROLES.PRIMARY_ADMIN } } })
  const queueBtn = await screen.findByText(/الطابور الأول/i)
  fireEvent.click(queueBtn)
  await waitFor(()=> expect(screen.getByText('Ali')).toBeInTheDocument())

  // call reorder to swap positions: make Sara position 1 and Ali 2 using API
  await api.post('/api/Queues/q1/reorder', { positions: [ { id: 102, position: 1 }, { id: 101, position: 2 } ] })

  // refresh queue selection by clicking another queue then back to q1 to force refetch
  const q2 = await screen.findByText(/الطابور الثاني/i)
  fireEvent.click(q2)
  // re-query q1 to get fresh element and click to refetch patients
  const q1Again = await screen.findByText(/الطابور الأول/i)
  fireEvent.click(q1Again)
    // wait for UI to update and assert new order
  await waitFor(async () => {
    const rows = await screen.findAllByRole('row')
    const names = rows.slice(1).map(r => r.cells[3].textContent.trim()) // slice(1) to skip header row
    expect(names[0]).toBe('Sara')
    expect(names[1]).toBe('Ali')
  })
})
