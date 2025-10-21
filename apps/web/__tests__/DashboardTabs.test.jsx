import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import DashboardTabs from '../components/DashboardTabs'
import { I18nProvider } from '../lib/i18n'

// Mock Font Awesome icons
jest.mock('../components/Icon', () => {
  return function MockIcon({ name, className }) {
    return <i className={`icon-${name} ${className}`} data-testid={`icon-${name}`} />
  }
})

describe('DashboardTabs Component', () => {
  const mockOnTabChange = jest.fn()

  const defaultProps = {
    activeTab: 'dashboard',
    onTabChange: mockOnTabChange,
    counts: {
      ongoing: 5,
      failed: 3,
    },
  }

  beforeEach(() => {
    mockOnTabChange.mockClear()
  })

  const renderWithI18n = (component) => {
    return render(<I18nProvider>{component}</I18nProvider>)
  }

  it('renders all three tabs', () => {
    renderWithI18n(<DashboardTabs {...defaultProps} />)

    expect(screen.getByText('لوحة التحكم')).toBeInTheDocument()
    expect(screen.getByText('الجاري')).toBeInTheDocument() // i18n shortens to "الجاري"
    expect(screen.getByText('الفاشل')).toBeInTheDocument() // i18n shortens to "الفاشل"
  })

  it('highlights the active tab', () => {
    renderWithI18n(<DashboardTabs {...defaultProps} activeTab="ongoing" />)

    const ongoingTab = screen.getByRole('tab', { name: /الجاري/i })
    expect(ongoingTab).toHaveClass('border-blue-600') // Uses border-blue-600 not 500
    expect(ongoingTab).toHaveClass('text-blue-600')
  })

  it('displays count badges for ongoing and failed tabs', () => {
    renderWithI18n(<DashboardTabs {...defaultProps} />)

    expect(screen.getByText('5')).toBeInTheDocument() // ongoing count
    expect(screen.getByText('3')).toBeInTheDocument() // failed count
  })

  it('calls onTabChange when clicking a different tab', () => {
    renderWithI18n(<DashboardTabs {...defaultProps} />)

    const ongoingTab = screen.getByRole('tab', { name: /الجاري/i })
    fireEvent.click(ongoingTab)

    expect(mockOnTabChange).toHaveBeenCalledWith('ongoing')
  })

  it('renders correct icons for each tab', () => {
    renderWithI18n(<DashboardTabs {...defaultProps} />)

    expect(screen.getByTestId('icon-fa-th-large')).toBeInTheDocument() // dashboard
    expect(screen.getByTestId('icon-fa-spinner')).toBeInTheDocument() // ongoing
    expect(screen.getByTestId('icon-fa-exclamation-triangle')).toBeInTheDocument() // failed
  })

  it('has proper ARIA attributes', () => {
    renderWithI18n(<DashboardTabs {...defaultProps} />)

    const dashboardTab = screen.getByRole('tab', { name: /لوحة التحكم/i })
    expect(dashboardTab).toHaveAttribute('aria-selected', 'true')
    expect(dashboardTab).toHaveAttribute('aria-controls', 'dashboard-panel')

    const ongoingTab = screen.getByRole('tab', { name: /الجاري/i })
    expect(ongoingTab).toHaveAttribute('aria-selected', 'false')
    expect(ongoingTab).toHaveAttribute('aria-controls', 'ongoing-panel')
  })

  it('hides count badges when counts are zero', () => {
    renderWithI18n(
      <DashboardTabs {...defaultProps} counts={{ ongoing: 0, failed: 0 }} />
    )

    const badges = screen.queryAllByText('0')
    expect(badges.length).toBe(0) // Should not render badges with 0 count
  })

  it('updates active state when activeTab prop changes', () => {
    const { rerender } = renderWithI18n(<DashboardTabs {...defaultProps} />)

    let dashboardTab = screen.getByRole('tab', { name: /لوحة التحكم/i })
    expect(dashboardTab).toHaveAttribute('aria-selected', 'true')

    rerender(
      <I18nProvider>
        <DashboardTabs {...defaultProps} activeTab="failed" />
      </I18nProvider>
    )

    dashboardTab = screen.getByRole('tab', { name: /لوحة التحكم/i })
    const failedTab = screen.getByRole('tab', { name: /الفاشل/i })
    
    expect(dashboardTab).toHaveAttribute('aria-selected', 'false')
    expect(failedTab).toHaveAttribute('aria-selected', 'true')
  })
})
