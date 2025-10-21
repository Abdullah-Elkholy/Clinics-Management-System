import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nProvider } from '../lib/i18n'
import { renderWithProviders } from '../test-utils/renderWithProviders'
import DashboardTabs from '../components/DashboardTabs'
import OngoingTab from '../components/OngoingTab'
import FailedTab from '../components/FailedTab'

// Mock Icon component
jest.mock('../components/Icon', () => {
  return function MockIcon({ name, className }) {
    return <i className={`icon-${name} ${className}`} data-testid={`icon-${name}`} />
  }
})

// Mock toast
jest.mock('../lib/toast', () => ({
  showToast: jest.fn(),
}))

describe('Tabs Integration Tests', () => {
  let queryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
  })

  describe('DashboardTabs with real data', () => {
    it('shows correct counts from props', () => {
      const mockOnTabChange = jest.fn()
      renderWithProviders(
        <DashboardTabs
          activeTab="dashboard"
          onTabChange={mockOnTabChange}
          counts={{ ongoing: 2, failed: 3 }}
        />
      )

      expect(screen.getByText('2')).toBeInTheDocument() // ongoing count
      expect(screen.getByText('3')).toBeInTheDocument() // failed count
    })

    it('switches between tabs correctly', () => {
      const mockOnTabChange = jest.fn()
      renderWithProviders(
        <DashboardTabs
          activeTab="dashboard"
          onTabChange={mockOnTabChange}
          counts={{ ongoing: 2, failed: 3 }}
        />
      )

      const ongoingTab = screen.getByRole('tab', { name: /الجاري/i })
      fireEvent.click(ongoingTab)

      expect(mockOnTabChange).toHaveBeenCalledWith('ongoing')
    })
  })

  describe('OngoingTab with sessions data', () => {
    const mockSessions = [
      {
        sessionId: 'session-001',
        queueName: 'د. أحمد محمد',
        startTime: '10:30 AM',
        total: 50,
        sent: 23,
        patients: [
          { id: 1, position: 1, name: 'محمد علي', phone: '+966501234567', message: 'رسالة', status: 'sent' },
          { id: 2, position: 2, name: 'فاطمة أحمد', phone: '+966501234568', message: 'رسالة', status: 'pending' },
        ],
      },
    ]

    it('displays session information correctly', () => {
      renderWithProviders(
        <OngoingTab
          sessions={mockSessions}
          onPause={jest.fn()}
          onResume={jest.fn()}
          onDelete={jest.fn()}
        />
      )

      expect(screen.getByText('د. أحمد محمد')).toBeInTheDocument()
      expect(screen.getByText('session-001')).toBeInTheDocument()
      expect(screen.getByText('10:30 AM')).toBeInTheDocument()
    })

    it('calculates and displays progress correctly', () => {
      renderWithProviders(
        <OngoingTab
          sessions={mockSessions}
          onPause={jest.fn()}
          onResume={jest.fn()}
          onDelete={jest.fn()}
        />
      )

      // Progress percentage should be 23/50 = 46%
      expect(screen.getByText('46%')).toBeInTheDocument()
    })

    it('expands session to show patient list', async () => {
      renderWithProviders(
        <OngoingTab
          sessions={mockSessions}
          onPause={jest.fn()}
          onResume={jest.fn()}
          onDelete={jest.fn()}
        />
      )

      // Initially, patient list should not be visible
      expect(screen.queryByText('محمد علي')).not.toBeInTheDocument()

      // Click to expand
      const expandButton = screen.getByRole('button', { expanded: false })
      fireEvent.click(expandButton)

      // Now patient list should be visible
      await waitFor(() => {
        expect(screen.getByText('محمد علي')).toBeInTheDocument()
        expect(screen.getByText('فاطمة أحمد')).toBeInTheDocument()
      })
    })

    it('shows empty state when no sessions', () => {
      renderWithProviders(
        <OngoingTab sessions={[]} onPause={jest.fn()} onResume={jest.fn()} onDelete={jest.fn()} />
      )

      expect(screen.getByText(/لا توجد مهام جارية حالياً/i)).toBeInTheDocument()
    })
  })

  describe('FailedTab with failed tasks data', () => {
    const mockFailedTasks = [
      {
        taskId: 'task-001',
        queueName: 'د. أحمد محمد',
        patientName: 'محمد علي',
        phone: '+966501234567',
        message: 'رسالة تذكير',
        error: 'فشل الاتصال',
        errorDetails: 'Connection timeout',
        retryCount: 2,
        failedAt: '10:45 AM',
        retryHistory: [],
      },
      {
        taskId: 'task-002',
        queueName: 'د. سارة خالد',
        patientName: 'فاطمة أحمد',
        phone: '+966501234568',
        message: 'رسالة',
        error: 'رقم غير صالح',
        errorDetails: 'Invalid phone',
        retryCount: 1,
        failedAt: '11:00 AM',
        retryHistory: [],
      },
    ]

    it('displays failed tasks table correctly', () => {
      renderWithProviders(
        <FailedTab
          failedTasks={mockFailedTasks}
          onRetry={jest.fn()}
          onRetryAll={jest.fn()}
          onDelete={jest.fn()}
        />
      )

      expect(screen.getByText('محمد علي')).toBeInTheDocument()
      expect(screen.getByText('فاطمة أحمد')).toBeInTheDocument()
      expect(screen.getByText('فشل الاتصال')).toBeInTheDocument()
      expect(screen.getByText('رقم غير صالح')).toBeInTheDocument()
    })

    it('shows correct total count in summary', () => {
      renderWithProviders(
        <FailedTab
          failedTasks={mockFailedTasks}
          onRetry={jest.fn()}
          onRetryAll={jest.fn()}
          onDelete={jest.fn()}
        />
      )

      // Should show total of 2 failed tasks
      expect(screen.getByText(/إجمالي الفاشل: 2/i)).toBeInTheDocument()
    })

    it('allows selecting tasks', () => {
      renderWithProviders(
        <FailedTab
          failedTasks={mockFailedTasks}
          onRetry={jest.fn()}
          onRetryAll={jest.fn()}
          onDelete={jest.fn()}
        />
      )

      const checkboxes = screen.getAllByRole('checkbox')
      // First checkbox is "select all", so skip it
      const firstTaskCheckbox = checkboxes[1]

      fireEvent.click(firstTaskCheckbox)

      // Retry button should now show count
      expect(screen.getByText(/إعادة محاولة المحدد \(1\)/i)).toBeInTheDocument()
    })

    it('calls onRetry with selected task IDs', () => {
      const mockOnRetry = jest.fn()
      renderWithProviders(
        <FailedTab
          failedTasks={mockFailedTasks}
          onRetry={mockOnRetry}
          onRetryAll={jest.fn()}
          onDelete={jest.fn()}
        />
      )

      // Select first task
      const checkboxes = screen.getAllByRole('checkbox')
      fireEvent.click(checkboxes[1])

      // Click retry button
      const retryButton = screen.getByText(/إعادة محاولة المحدد/i)
      fireEvent.click(retryButton)

      expect(mockOnRetry).toHaveBeenCalledWith(['task-001'])
    })

    it('calls onRetryAll when retry all clicked', () => {
      const mockOnRetryAll = jest.fn()
      renderWithProviders(
        <FailedTab
          failedTasks={mockFailedTasks}
          onRetry={jest.fn()}
          onRetryAll={mockOnRetryAll}
          onDelete={jest.fn()}
        />
      )

      const retryAllButton = screen.getByText(/إعادة محاولة الكل/i)
      fireEvent.click(retryAllButton)

      expect(mockOnRetryAll).toHaveBeenCalled()
    })

    it('shows empty state when no failed tasks', () => {
      renderWithProviders(
        <FailedTab failedTasks={[]} onRetry={jest.fn()} onRetryAll={jest.fn()} onDelete={jest.fn()} />
      )

      expect(screen.getByText(/لا توجد مهام فاشلة/i)).toBeInTheDocument()
      expect(screen.getByText(/جميع الرسائل تم إرسالها بنجاح/i)).toBeInTheDocument()
    })

    it('shows high retry count warning', () => {
      const highRetryTask = [
        {
          taskId: 'task-003',
          queueName: 'د. أحمد',
          patientName: 'علي',
          phone: '+966501234569',
          message: 'رسالة',
          error: 'خطأ',
          errorDetails: 'Error',
          retryCount: 3,
          failedAt: '12:00 PM',
          retryHistory: [],
        },
      ]

      renderWithProviders(
        <FailedTab
          failedTasks={highRetryTask}
          onRetry={jest.fn()}
          onRetryAll={jest.fn()}
          onDelete={jest.fn()}
        />
      )

      // Task with retryCount >= 3 should be in high retry stats
      expect(screen.getByText(/محاولات عالية \(≥3\)/i)).toBeInTheDocument()
    })
  })

  describe('Full workflow integration', () => {
    it('switches tabs and shows appropriate content', () => {
      const mockOnTabChange = jest.fn()

      const TestComponent = () => {
        const [tab, setTab] = React.useState('dashboard')

        return (
          <div>
            <DashboardTabs
              activeTab={tab}
              onTabChange={setTab}
              counts={{ ongoing: 1, failed: 1 }}
            />
            {tab === 'ongoing' && (
              <OngoingTab
                sessions={[
                  {
                    sessionId: 'test',
                    queueName: 'Test Queue',
                    startTime: '10:00 AM',
                    total: 10,
                    sent: 5,
                    patients: [],
                  },
                ]}
                onPause={jest.fn()}
                onResume={jest.fn()}
                onDelete={jest.fn()}
              />
            )}
            {tab === 'failed' && (
              <FailedTab
                failedTasks={[
                  {
                    taskId: 'fail-1',
                    queueName: 'Test',
                    patientName: 'Test Patient',
                    phone: '123',
                    message: 'Test',
                    error: 'Test Error',
                    retryCount: 1,
                    failedAt: '11:00 AM',
                  },
                ]}
                onRetry={jest.fn()}
                onRetryAll={jest.fn()}
                onDelete={jest.fn()}
              />
            )}
          </div>
        )
      }

      renderWithProviders(<TestComponent />)

      // Click ongoing tab
      const ongoingTab = screen.getByRole('tab', { name: /الجاري/i })
      fireEvent.click(ongoingTab)

      // Should show ongoing content
      expect(screen.getByText('Test Queue')).toBeInTheDocument()

      // Click failed tab
      const failedTab = screen.getByRole('tab', { name: /الفاشل/i })
      fireEvent.click(failedTab)

      // Should show failed content
      expect(screen.getByText('Test Patient')).toBeInTheDocument()
    })
  })
})
