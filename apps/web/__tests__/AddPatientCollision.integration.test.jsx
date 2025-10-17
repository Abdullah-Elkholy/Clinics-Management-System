import React from 'react'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import App from '../pages/_app'
import Dashboard from '../pages/dashboard'

test('adding patient with desiredPosition collisions shifts existing patients', async ()=>{
  renderWithProviders(<App Component={Dashboard} pageProps={{}} />, { localStorage: { currentUser: JSON.stringify({ id:1, role: 'primary_admin' }) } })

  // select queue q1
  const queueBtn = await screen.findByText(/الطابور الأول/i)
  fireEvent.click(queueBtn)
  await waitFor(()=> expect(screen.getByText('Ali')).toBeInTheDocument())

  // open add modal
  fireEvent.click(screen.getByText('إضافة مرضى'))
  fireEvent.change(screen.getByPlaceholderText('أدخل الاسم الكامل'), { target: { value: 'NewFirst' } })
  fireEvent.change(screen.getByPlaceholderText('رقم الهاتف'), { target: { value: '0999' } })
  fireEvent.change(screen.getByPlaceholderText('مثال: 3'), { target: { value: '1' } })
  fireEvent.click(screen.getByText('إضافة المرضى'))

  // wait for new patient to appear and positions to reflect shift
  await waitFor(()=> expect(screen.getByText('NewFirst')).toBeInTheDocument())
  // check that NewFirst appears before Ali in DOM table rows
  const rows = Array.from(document.querySelectorAll('tbody tr'))
  const names = rows.map(r => r.cells[2].textContent.trim())
  expect(names[0]).toBe('NewFirst')
  expect(names[1]).toBe('Ali')
})
