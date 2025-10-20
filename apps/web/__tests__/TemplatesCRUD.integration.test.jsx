import React from 'react'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import { ROLES } from '../lib/roles'
import Dashboard from '../pages/dashboard'

test('templates create, update and delete via API then observed in UI', async ()=>{
  renderWithProviders(<Dashboard />, { auth: { user: { id:1, role: ROLES.PRIMARY_ADMIN } } })

  // Wait for loading to complete
  await waitFor(() => {
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
  })

  // Click on the first queue to show the templates section
  // Wait for loading to finish and queue buttons to appear  
  await waitFor(() => {
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
  })

  // Click the first queue button
  const queueBtn = screen.getByRole('button', { name: /طابور.*الطابور الأول/i })
  fireEvent.click(queueBtn)

  // Wait for templates dropdown to load
  const templatesSelect = await screen.findByLabelText('القوالب')
  expect(templatesSelect).toBeInTheDocument()

  // Add new template
  fireEvent.click(screen.getByRole('button', { name: 'إضافة قالب' }))
  
  // Wait for modal title
  const modalTitle = await screen.findByText('إضافة قالب')
  fireEvent.change(screen.getByLabelText('عنوان القالب'), { target: { value: 'New Template' } })
  fireEvent.change(screen.getByLabelText('محتوى القالب'), { target: { value: 'Hello test' } })
  fireEvent.click(screen.getByRole('button', { name: 'إضافة' }))

  // New template should appear in dropdown
  await waitFor(() => expect(screen.getByRole('option', { name: 'New Template' })).toBeInTheDocument())

  // Edit template
  fireEvent.click(screen.getByRole('button', { name: 'تعديل القالب' }))
  await screen.findByText('تعديل قالب رسالة')
  fireEvent.change(screen.getByLabelText('محتوى القالب'), { target: { value: 'Hello updated' } })
  fireEvent.click(screen.getByRole('button', { name: 'تحديث' }))

  // Delete template
  fireEvent.click(screen.getByRole('button', { name: 'حذف القالب' }))
  await waitFor(() => expect(screen.queryByRole('option', { name: 'New Template' })).not.toBeInTheDocument())
})
