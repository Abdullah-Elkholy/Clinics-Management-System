import React from 'react'
import { screen, waitFor, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import App from '../pages/_app'
import Dashboard from '../pages/dashboard'
import { server } from '../mocks/server'
import { rest } from 'msw'

function makeCSVFile(content, name='patients.csv'){
  const blob = new Blob([content], { type: 'text/csv' })
  return new File([blob], name, { type: 'text/csv' })
}

test('CSV upload partial success and invalid format handling', async ()=>{
  // override POST patients to return 400 for phone 'BADNUM'
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000'
  server.use(rest.post(API_BASE + '/api/queues/:queueId/patients', async (req, res, ctx) => {
    const body = await req.json()
    if (body.phoneNumber === 'BADNUM') return res(ctx.status(400), ctx.json({ success: false, error: 'Invalid phone' }))
    // otherwise use default handler behavior by delegating to fallback - but we can't here, so simulate success
    return res(ctx.status(201), ctx.json({ success: true, data: { id: Math.floor(Math.random()*1000), ...body } }))
  }))

  renderWithProviders(<App Component={Dashboard} pageProps={{}} />, { localStorage: { currentUser: JSON.stringify({ id:1, role: 'primary_admin' }) } })
  const queueBtn = await screen.findByText(/الطابور الأول/i)
  fireEvent.click(queueBtn)
  await waitFor(()=> expect(screen.getByText('Ali')).toBeInTheDocument())

  // Click the Upload CSV button to open the modal
  const uploadBtn = screen.getByRole('button', { name: 'رفع ملف المرضى' })
  fireEvent.click(uploadBtn)

  // Wait for the modal and file input to be available
  const fileInput = await waitFor(() => screen.getByLabelText('رفع ملف المرضى (CSV)'))

  // upload CSV with one bad row
  const file = makeCSVFile('fullName,phoneNumber\nGoodGuy,0123\nBadGuy,BADNUM')
  fireEvent.change(fileInput, { target: { files: [file] } })

  // expect either success toast or partial-failure toast, and that GoodGuy appears but BadGuy does not
  await waitFor(()=> expect(screen.getByText((content)=> /تم رفع ملف المرضى|بعض السجلات فشلت/.test(content))).toBeInTheDocument())
  await waitFor(()=> expect(screen.getByText('GoodGuy')).toBeInTheDocument())
  expect(screen.queryByText('BadGuy')).toBeNull()
})
