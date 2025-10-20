import React from 'react'
import { screen, fireEvent } from '@testing-library/react'
import renderWithProviders from '../test-utils/renderWithProviders'
import RetryPreviewModal from '../components/RetryPreviewModal'

describe('RetryPreviewModal', ()=>{
  test('does not render when open is false', ()=>{
    const tasks = [{ id: 1, retryCount: 0, fullName: 'أحمد', phoneNumber: '0500000000' }]
    const { queryByText } = renderWithProviders(<RetryPreviewModal open={false} tasks={tasks} />)
    expect(queryByText('معاينة المهام الفاشلة')).toBeNull()
  })

  test('renders tasks and calls onRetry and onClose', ()=>{
    const tasks = [
      { id: 1, retryCount: 1, fullName: 'أحمد', phoneNumber: '0500000000' },
      { id: 2, retryCount: 0, fullName: 'سارة', phoneNumber: '0501111111' }
    ]
    const onClose = jest.fn()
    const onRetry = jest.fn()

    renderWithProviders(<RetryPreviewModal open={true} tasks={tasks} onClose={onClose} onRetry={onRetry} />)

    // Header
    expect(screen.getByText('معاينة المهام الفاشلة')).toBeInTheDocument()

    // Task rows
    expect(screen.getByText('أحمد')).toBeInTheDocument()
    expect(screen.getByText('0500000000')).toBeInTheDocument()
    expect(screen.getByText('سارة')).toBeInTheDocument()
    expect(screen.getByText('0501111111')).toBeInTheDocument()

    // Click retry -> should call onRetry with tasks and then onClose
    const retryButton = screen.getByRole('button', { name: /إعادة الإرسال/i })
    fireEvent.click(retryButton)
    expect(onRetry).toHaveBeenCalledTimes(1)
    // onRetry receives the tasks array
    expect(onRetry).toHaveBeenCalledWith(tasks)
    // onClose should also have been called
    expect(onClose).toHaveBeenCalled()
  })
})
