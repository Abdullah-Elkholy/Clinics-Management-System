import React from 'react'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import CSVUpload from '../components/CSVUpload'
import { renderWithProviders } from '../test-utils/renderWithProviders'

function makeFile(text, name='patients.csv'){
  return new File([text], name, { type: 'text/csv' })
}

test('parses CSV and calls onParsed', async ()=>{
  const cb = jest.fn()
  const { container } = renderWithProviders(<CSVUpload onParsed={cb} />)
  const input = screen.getByLabelText(/رفع ملف المرضى/i)
  const file = makeFile('Ali,010,1\nFatma,011,2')
  // fire change
  fireEvent.change(input, { target: { files: [file] } })
  await waitFor(()=> expect(cb).toHaveBeenCalled())
  const rows = cb.mock.calls[0][0]
  expect(rows.length).toBe(2)
  expect(rows[0].fullName).toBe('Ali')

  // a11y - quick axe smoke test
  const results = await global.axe(container)
  expect(results).toHaveNoViolations()
})
