import React from 'react'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import App from '../pages/_app'
import Dashboard from '../pages/dashboard'

test('reorder patients via API updates table order', async ()=>{
  renderWithProviders(<App Component={Dashboard} pageProps={{}} />, { localStorage: { currentUser: JSON.stringify({ id:1, role: 'primary_admin' }) } })
  const queueBtn = await screen.findByText(/الطابور الأول/i)
  fireEvent.click(queueBtn)
  await waitFor(()=> expect(screen.getByText('Ali')).toBeInTheDocument())

  // call reorder to swap positions: make Sara position 1 and Ali 2 using API
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'
  await fetch(base + '/api/queues/q1/reorder', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ positions: [ { id: 102, position: 1 }, { id: 101, position: 2 } ] }) })

  // refresh queue selection by clicking another queue then back to q1 to force refetch
  const q2 = await screen.findByText(/الطابور الثاني/i)
  fireEvent.click(q2)
  // re-query q1 to get fresh element and click to refetch patients
  const q1Again = await screen.findByText(/الطابور الأول/i)
  fireEvent.click(q1Again)
    // wait for UI to update and assert new order
    await screen.findByText('Sara')
  await waitFor(()=> expect(screen.getByText('Sara')).toBeInTheDocument())
  const rows = Array.from(document.querySelectorAll('tbody tr'))
  const names = rows.map(r => r.cells[2].textContent.trim())
  expect(names[0]).toBe('Sara')
  expect(names[1]).toBe('Ali')
})
