import React from 'react'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import App from '../pages/_app'
import Dashboard from '../pages/dashboard'

test('persists selected template to localStorage', async ()=>{
  // ensure clean storage
  localStorage.removeItem('selectedTemplate')

  renderWithProviders(<App Component={Dashboard} pageProps={{}} />, { localStorage: { currentUser: JSON.stringify({ id:1, role: 'primary_admin' }) } })

  // wait for templates to load and select queue
  const queueBtn = await screen.findByText(/الطابور الأول/i)
  fireEvent.click(queueBtn)

  // wait for templates select
  const tplSelect = await screen.findByLabelText(/قائمة القوالب/i)
  // choose the first non-empty option (value t1 from mocks)
  fireEvent.change(tplSelect, { target: { value: 't1' } })

  // assert localStorage updated
  await waitFor(()=> expect(localStorage.getItem('selectedTemplate')).toBe('t1'))

  // unmount and remount to simulate page reload
  const { unmount } = renderWithProviders(<App Component={Dashboard} pageProps={{}} />, { localStorage: { currentUser: JSON.stringify({ id:1, role: 'primary_admin' }), selectedTemplate: 't1' } })

  // Click on queue to show templates section
  const queueBtn2 = await screen.findByText(/الطابور الأول/i)
  fireEvent.click(queueBtn2)

  // the dashboard loads selectedTemplate from localStorage in useEffect; expect the selected option to be present
  const remountedSelect = await screen.findByLabelText(/قائمة القوالب/i)
  await waitFor(()=> expect(remountedSelect.value).toBe('t1'))
})
