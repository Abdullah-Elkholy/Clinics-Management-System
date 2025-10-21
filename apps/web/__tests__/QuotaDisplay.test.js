import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import QuotaDisplay from '../components/QuotaDisplay'
import * as hooks from '../lib/hooks'

// Mock hooks
jest.mock('../lib/hooks', () => ({
  useMyQuota: jest.fn()
}))

// Mock heroicons
jest.mock('@heroicons/react/24/outline', () => ({
  ExclamationTriangleIcon: () => <span data-testid="warning-icon">⚠️</span>
}))

describe('QuotaDisplay Component', () => {
  let queryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    })
    jest.clearAllMocks()
  })

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <QuotaDisplay />
      </QueryClientProvider>
    )
  }

  it('should render nothing when loading', () => {
    hooks.useMyQuota.mockReturnValue({ data: null, isLoading: true })
    const { container } = renderComponent()
    expect(container.firstChild).toBeNull()
  })

  it('should render nothing when no quota data', () => {
    hooks.useMyQuota.mockReturnValue({ data: null, isLoading: false })
    const { container } = renderComponent()
    expect(container.firstChild).toBeNull()
  })

  it('should render nothing for users with unlimited quota', () => {
    hooks.useMyQuota.mockReturnValue({
      data: { hasUnlimitedQuota: true },
      isLoading: false
    })
    const { container } = renderComponent()
    expect(container.firstChild).toBeNull()
  })

  it('should display quota information for normal users', () => {
    hooks.useMyQuota.mockReturnValue({
      data: {
        hasUnlimitedQuota: false,
        messagesQuota: 100,
        remainingMessages: 75,
        queuesQuota: 10,
        remainingQueues: 8,
        isMessagesQuotaLow: false,
        isQueuesQuotaLow: false
      },
      isLoading: false
    })

    renderComponent()

    // Check messages quota display
    expect(screen.getByText('الرسائل')).toBeInTheDocument()
    expect(screen.getByText('75 / 100')).toBeInTheDocument()

    // Check queues quota display
    expect(screen.getByText('الطوابير')).toBeInTheDocument()
    expect(screen.getByText('8 / 10')).toBeInTheDocument()
  })

  it('should show warning icon when messages quota is low', () => {
    hooks.useMyQuota.mockReturnValue({
      data: {
        hasUnlimitedQuota: false,
        messagesQuota: 100,
        remainingMessages: 15,
        queuesQuota: 10,
        remainingQueues: 8,
        isMessagesQuotaLow: true,
        isQueuesQuotaLow: false
      },
      isLoading: false
    })

    renderComponent()

    const warningIcons = screen.getAllByTestId('warning-icon')
    expect(warningIcons.length).toBeGreaterThanOrEqual(1)
  })

  it('should show warning icon when queues quota is low', () => {
    hooks.useMyQuota.mockReturnValue({
      data: {
        hasUnlimitedQuota: false,
        messagesQuota: 100,
        remainingMessages: 75,
        queuesQuota: 10,
        remainingQueues: 2,
        isMessagesQuotaLow: false,
        isQueuesQuotaLow: true
      },
      isLoading: false
    })

    renderComponent()

    const warningIcons = screen.getAllByTestId('warning-icon')
    expect(warningIcons.length).toBeGreaterThanOrEqual(1)
  })

  it('should show warnings for both when both quotas are low', () => {
    hooks.useMyQuota.mockReturnValue({
      data: {
        hasUnlimitedQuota: false,
        messagesQuota: 100,
        remainingMessages: 5,
        queuesQuota: 10,
        remainingQueues: 1,
        isMessagesQuotaLow: true,
        isQueuesQuotaLow: true
      },
      isLoading: false
    })

    renderComponent()

    const warningIcons = screen.getAllByTestId('warning-icon')
    expect(warningIcons.length).toBe(2)
  })

  it('should display zero remaining messages correctly', () => {
    hooks.useMyQuota.mockReturnValue({
      data: {
        hasUnlimitedQuota: false,
        messagesQuota: 100,
        remainingMessages: 0,
        queuesQuota: 10,
        remainingQueues: 5,
        isMessagesQuotaLow: true,
        isQueuesQuotaLow: false
      },
      isLoading: false
    })

    renderComponent()

    expect(screen.getByText('0 / 100')).toBeInTheDocument()
  })

  it('should display zero remaining queues correctly', () => {
    hooks.useMyQuota.mockReturnValue({
      data: {
        hasUnlimitedQuota: false,
        messagesQuota: 100,
        remainingMessages: 50,
        queuesQuota: 10,
        remainingQueues: 0,
        isMessagesQuotaLow: false,
        isQueuesQuotaLow: true
      },
      isLoading: false
    })

    renderComponent()

    expect(screen.getByText('0 / 10')).toBeInTheDocument()
  })

  it('should apply correct styling for low quota', () => {
    hooks.useMyQuota.mockReturnValue({
      data: {
        hasUnlimitedQuota: false,
        messagesQuota: 100,
        remainingMessages: 10,
        queuesQuota: 10,
        remainingQueues: 1,
        isMessagesQuotaLow: true,
        isQueuesQuotaLow: true
      },
      isLoading: false
    })

    const { container } = renderComponent()

    // Check for yellow text class (low quota indicator)
    const yellowTexts = container.querySelectorAll('.text-yellow-300')
    expect(yellowTexts.length).toBeGreaterThan(0)
  })

  it('should handle edge case: quota is zero', () => {
    hooks.useMyQuota.mockReturnValue({
      data: {
        hasUnlimitedQuota: false,
        messagesQuota: 0,
        remainingMessages: 0,
        queuesQuota: 0,
        remainingQueues: 0,
        isMessagesQuotaLow: true,
        isQueuesQuotaLow: true
      },
      isLoading: false
    })

    renderComponent()

    expect(screen.getByText('0 / 0')).toBeInTheDocument()
  })
})
