import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import MessageSelectionModal from '../components/MessageSelectionModal'
import renderWithProviders from '../test-utils/renderWithProviders'

test('renders modal and sends edited message', async ()=>{
  const onSend = jest.fn()
  const onClose = jest.fn()
  const template = { content: 'Hello {name}' }

  const { container } = renderWithProviders(<MessageSelectionModal open={true} template={template} onClose={onClose} onSend={onSend} />)

  const textarea = screen.getByRole('textbox')

  // a11y smoke check before interactions
  const results = await global.axe(container)
  expect(results).toHaveNoViolations()

  fireEvent.change(textarea, { target: { value: 'Hi there' } })
  const sendBtn = screen.getByText('إرسال')
  fireEvent.click(sendBtn)

  expect(onSend).toHaveBeenCalledWith('Hi there')
  expect(onClose).toHaveBeenCalled()
})
