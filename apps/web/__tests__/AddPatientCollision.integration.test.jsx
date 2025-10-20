import React from 'react'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import { ROLES } from '../lib/roles'
import Dashboard from '../pages/dashboard'

test('adding patient with desiredPosition collisions shifts existing patients', async ()=>{
  renderWithProviders(<Dashboard />, { auth: { user: { id:1, role: ROLES.PRIMARY_ADMIN } } })
  // select queue q1
  const queueBtn = await screen.findByText(/الطابور الأول/i)
  fireEvent.click(queueBtn)
  await waitFor(()=> expect(screen.getByText('Ali')).toBeInTheDocument())

  // add new patient at position 1
  fireEvent.click(screen.getByRole('button', { name: 'إضافة مرضى جدد' }))
  await screen.findByText('إضافة مريض جديد')
  fireEvent.change(screen.getByLabelText('الاسم الكامل'), { target: { value: 'Zain' } })
  fireEvent.change(screen.getByLabelText('رقم الهاتف'), { target: { value: '050' } })
  fireEvent.change(screen.getByLabelText('الترتيب المطلوب (اختياري)'), { target: { value: '1' } })
  fireEvent.click(screen.getByRole('button', { name: 'إضافة' }))

  // Zain should be at top, Ali and Sara shifted down
  await waitFor(async () => {
    const rows = await screen.findAllByRole('row')
    const names = rows.slice(1).map(r => r.cells[2].textContent.trim())
    expect(names).toEqual(['Zain', 'Ali', 'Sara'])
  })
})
