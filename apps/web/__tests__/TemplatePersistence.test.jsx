import React from 'react'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import { ROLES } from '../lib/roles'
import { ROLES } from '../lib/roles'
import Dashboard from '../pages/dashboard'

test('persists selected template to localStorage', async ()=>{
  const { unmount } = renderWithProviders(<Dashboard />, { auth: { user: { id:1, role: ROLES.PRIMARY_ADMIN } } })

  // wait for templates to load and select queue
  const queueBtn = await screen.findByText(/الطابور الأول/i)
  fireEvent.click(queueBtn)

  // wait for templates select
  const templatesSelect = await screen.findByLabelText('القوالب')
  fireEvent.change(templatesSelect, { target: { value: 't1' } })
  // Wait for localStorage to be called
  await waitFor(() => {
    expect(localStorage.setItem).toHaveBeenCalledWith('selectedTemplate-q1', 't1')
  })

  // unmount and remount
  unmount()
  renderWithProviders(<Dashboard />, { auth: { user: { id:1, role: ROLES.PRIMARY_ADMIN } }, localStorage: { 'selectedTemplate-q1': 't1' } })

  // select queue again
  const queueBtn2 = await screen.findByText(/الطابور الأول/i)
  fireEvent.click(queueBtn2)

  // should have restored selection
  await waitFor(() => expect(screen.getByRole('option', { name: 'تأكيد' }).selected).toBe(true))
})
