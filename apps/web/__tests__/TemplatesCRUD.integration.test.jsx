import React from 'react'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import App from '../pages/_app'
import Dashboard from '../pages/dashboard'

test('templates create, update and delete via API then observed in UI', async ()=>{
  const base = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'
  // create template via API
  const createRes = await fetch(base + '/api/templates', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ title: 'T_Integration', content: 'Hello {name}' }) })
  const created = await createRes.json()
  expect(created?.success).toBeTruthy()

  // render dashboard and ensure new template appears
  const { unmount } = renderWithProviders(<App Component={Dashboard} pageProps={{}} />, { localStorage: { currentUser: JSON.stringify({ id:1, role: 'primary_admin' }) } })
  await waitFor(()=> expect(screen.getByText(/T_Integration/)).toBeInTheDocument())

  // update template via API
  const updatedRes = await fetch(base + `/api/templates/${created.data.id}`, { method: 'PUT', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ title: 'T_Integration_Edit', content: 'Edited' }) })
  const updated = await updatedRes.json()
  expect(updated?.success).toBeTruthy()
  unmount()
  // re-render to pick up updated templates list
  renderWithProviders(<App Component={Dashboard} pageProps={{}} />, { localStorage: { currentUser: JSON.stringify({ id:1, role: 'primary_admin' }) } })
  await waitFor(()=> expect(screen.getByText(/T_Integration_Edit/)).toBeInTheDocument())

  // delete via API
  const delRes = await fetch(base + `/api/templates/${created.data.id}`, { method: 'DELETE' })
  const del = await delRes.json()
  expect(del?.success).toBeTruthy()
  unmount()
  // re-render and assert deleted template not present
  renderWithProviders(<App Component={Dashboard} pageProps={{}} />, { localStorage: { currentUser: JSON.stringify({ id:1, role: 'primary_admin' }) } })
  await waitFor(()=> expect(screen.queryByText(/T_Integration_Edit/)).not.toBeInTheDocument())
})
