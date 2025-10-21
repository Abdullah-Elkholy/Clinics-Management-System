import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ManagementPanel from '../components/ManagementPanel'
import * as authorization from '../lib/authorization'

// Mock authorization
jest.mock('../lib/authorization', () => ({
  useAuthorization: jest.fn()
}))

// Mock Icon component
jest.mock('../components/Icon', () => {
  return function Icon({ name }) {
    return <i className={name} data-testid={`icon-${name}`} />
  }
})

describe('ManagementPanel Component', () => {
  let queryClient
  const mockOnOpenQuotas = jest.fn()
  const mockOnOpenWhatsApp = jest.fn()
  const mockOnOpenTemplates = jest.fn()
  const mockOnOpenUsers = jest.fn()

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    })
    jest.clearAllMocks()
  })

  const renderComponent = (permissions = {}) => {
    authorization.useAuthorization.mockReturnValue({
      canManageUsers: false,
      canManageQuotas: false,
      canManageWhatsApp: false,
      canManageTemplates: false,
      ...permissions
    })

    return render(
      <QueryClientProvider client={queryClient}>
        <ManagementPanel
          onOpenQuotas={mockOnOpenQuotas}
          onOpenWhatsApp={mockOnOpenWhatsApp}
          onOpenTemplates={mockOnOpenTemplates}
          onOpenUsers={mockOnOpenUsers}
        />
      </QueryClientProvider>
    )
  }

  describe('Permission-based Rendering', () => {
    it('should render nothing when user has no management permissions', () => {
      const { container } = renderComponent()
      expect(container.querySelector('.grid')).toBeInTheDocument()
      expect(screen.queryByText('المستخدمون')).not.toBeInTheDocument()
      expect(screen.queryByText('الحصص والإعدادات')).not.toBeInTheDocument()
      expect(screen.queryByText('واتساب')).not.toBeInTheDocument()
      expect(screen.queryByText('قوالب الرسائل')).not.toBeInTheDocument()
    })

    it('should render Users section when user can manage users', () => {
      renderComponent({ canManageUsers: true })
      expect(screen.getByText('المستخدمون')).toBeInTheDocument()
      expect(screen.getByText('إدارة المستخدمين، الصلاحيات وتغيير كلمات المرور')).toBeInTheDocument()
      expect(screen.getByText('فتح المستخدمين')).toBeInTheDocument()
    })

    it('should render Quotas section when user can manage quotas', () => {
      renderComponent({ canManageQuotas: true })
      expect(screen.getByText('الحصص والإعدادات')).toBeInTheDocument()
      expect(screen.getByText('إعدادات الحصص وحدود الاستخدام')).toBeInTheDocument()
      expect(screen.getByText('إدارة الحصص')).toBeInTheDocument()
    })

    it('should render WhatsApp section when user can manage WhatsApp', () => {
      renderComponent({ canManageWhatsApp: true })
      expect(screen.getByText('واتساب')).toBeInTheDocument()
      expect(screen.getByText('ربط ومراقبة حالة اتصال واتساب')).toBeInTheDocument()
      expect(screen.getByText('فتح واتساب')).toBeInTheDocument()
    })

    it('should render Templates section when user can manage templates', () => {
      renderComponent({ canManageTemplates: true })
      expect(screen.getByText('قوالب الرسائل')).toBeInTheDocument()
      expect(screen.getByText('استعراض، تحرير وإنشاء قوالب الرسائل')).toBeInTheDocument()
      expect(screen.getByText('ادارة القوالب')).toBeInTheDocument()
    })

    it('should render all sections when user has all permissions', () => {
      renderComponent({
        canManageUsers: true,
        canManageQuotas: true,
        canManageWhatsApp: true,
        canManageTemplates: true
      })

      expect(screen.getByText('المستخدمون')).toBeInTheDocument()
      expect(screen.getByText('الحصص والإعدادات')).toBeInTheDocument()
      expect(screen.getByText('واتساب')).toBeInTheDocument()
      expect(screen.getByText('قوالب الرسائل')).toBeInTheDocument()
    })
  })

  describe('Button Click Handlers', () => {
    it('should call onOpenUsers when Users button is clicked', () => {
      renderComponent({ canManageUsers: true })
      
      const usersButton = screen.getByText('فتح المستخدمين')
      fireEvent.click(usersButton)
      
      expect(mockOnOpenUsers).toHaveBeenCalledTimes(1)
      expect(mockOnOpenQuotas).not.toHaveBeenCalled()
      expect(mockOnOpenWhatsApp).not.toHaveBeenCalled()
      expect(mockOnOpenTemplates).not.toHaveBeenCalled()
    })

    it('should call onOpenQuotas when Quotas button is clicked', () => {
      renderComponent({ canManageQuotas: true })
      
      const quotasButton = screen.getByText('إدارة الحصص')
      fireEvent.click(quotasButton)
      
      expect(mockOnOpenQuotas).toHaveBeenCalledTimes(1)
      expect(mockOnOpenUsers).not.toHaveBeenCalled()
      expect(mockOnOpenWhatsApp).not.toHaveBeenCalled()
      expect(mockOnOpenTemplates).not.toHaveBeenCalled()
    })

    it('should call onOpenWhatsApp when WhatsApp button is clicked', () => {
      renderComponent({ canManageWhatsApp: true })
      
      const whatsappButton = screen.getByText('فتح واتساب')
      fireEvent.click(whatsappButton)
      
      expect(mockOnOpenWhatsApp).toHaveBeenCalledTimes(1)
      expect(mockOnOpenUsers).not.toHaveBeenCalled()
      expect(mockOnOpenQuotas).not.toHaveBeenCalled()
      expect(mockOnOpenTemplates).not.toHaveBeenCalled()
    })

    it('should call onOpenTemplates when Templates button is clicked', () => {
      renderComponent({ canManageTemplates: true })
      
      const templatesButton = screen.getByText('ادارة القوالب')
      fireEvent.click(templatesButton)
      
      expect(mockOnOpenTemplates).toHaveBeenCalledTimes(1)
      expect(mockOnOpenUsers).not.toHaveBeenCalled()
      expect(mockOnOpenQuotas).not.toHaveBeenCalled()
      expect(mockOnOpenWhatsApp).not.toHaveBeenCalled()
    })

    it('should handle multiple button clicks correctly', () => {
      renderComponent({
        canManageUsers: true,
        canManageQuotas: true
      })
      
      const usersButton = screen.getByText('فتح المستخدمين')
      const quotasButton = screen.getByText('إدارة الحصص')
      
      fireEvent.click(usersButton)
      fireEvent.click(quotasButton)
      fireEvent.click(usersButton)
      
      expect(mockOnOpenUsers).toHaveBeenCalledTimes(2)
      expect(mockOnOpenQuotas).toHaveBeenCalledTimes(1)
    })
  })

  describe('Icon Rendering', () => {
    it('should render correct icon for Users section', () => {
      renderComponent({ canManageUsers: true })
      expect(screen.getByTestId('icon-fas fa-users')).toBeInTheDocument()
    })

    it('should render correct icon for Quotas section', () => {
      renderComponent({ canManageQuotas: true })
      expect(screen.getByTestId('icon-fas fa-sliders-h')).toBeInTheDocument()
    })

    it('should render correct icon for WhatsApp section', () => {
      renderComponent({ canManageWhatsApp: true })
      expect(screen.getByTestId('icon-fab fa-whatsapp')).toBeInTheDocument()
    })

    it('should render correct icon for Templates section', () => {
      renderComponent({ canManageTemplates: true })
      expect(screen.getByTestId('icon-fas fa-file-alt')).toBeInTheDocument()
    })
  })

  describe('Styling and Layout', () => {
    it('should apply hover effect classes to cards', () => {
      const { container } = renderComponent({ canManageUsers: true })
      
      const card = container.querySelector('.hover\\:-translate-y-1')
      expect(card).toBeInTheDocument()
    })

    it('should use grid layout for management cards', () => {
      const { container } = renderComponent({
        canManageUsers: true,
        canManageQuotas: true
      })
      
      const grid = container.querySelector('.grid')
      expect(grid).toHaveClass('grid-cols-1')
      expect(grid).toHaveClass('md:grid-cols-3')
    })

    it('should span full width for Templates section', () => {
      const { container } = renderComponent({ canManageTemplates: true })
      
      const templateCard = container.querySelector('.md\\:col-span-3')
      expect(templateCard).toBeInTheDocument()
    })

    it('should apply animation classes', () => {
      const { container } = renderComponent({ canManageUsers: true })
      
      const animatedCard = container.querySelector('.animate-slide-in')
      expect(animatedCard).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper button types', () => {
      renderComponent({
        canManageUsers: true,
        canManageQuotas: true,
        canManageWhatsApp: true,
        canManageTemplates: true
      })
      
      const buttons = screen.getAllByRole('button')
      buttons.forEach(button => {
        expect(button).toHaveAttribute('type', 'button')
      })
    })

    it('should have descriptive button text', () => {
      renderComponent({
        canManageUsers: true,
        canManageQuotas: true,
        canManageWhatsApp: true,
        canManageTemplates: true
      })
      
      expect(screen.getByText('فتح المستخدمين')).toBeInTheDocument()
      expect(screen.getByText('إدارة الحصص')).toBeInTheDocument()
      expect(screen.getByText('فتح واتساب')).toBeInTheDocument()
      expect(screen.getByText('ادارة القوالب')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle missing callback props gracefully', () => {
      authorization.useAuthorization.mockReturnValue({
        canManageUsers: true,
        canManageQuotas: false,
        canManageWhatsApp: false,
        canManageTemplates: false
      })

      render(
        <QueryClientProvider client={queryClient}>
          <ManagementPanel
            onOpenQuotas={undefined}
            onOpenWhatsApp={undefined}
            onOpenTemplates={undefined}
            onOpenUsers={mockOnOpenUsers}
          />
        </QueryClientProvider>
      )
      
      const usersButton = screen.getByText('فتح المستخدمين')
      fireEvent.click(usersButton)
      
      expect(mockOnOpenUsers).toHaveBeenCalled()
    })

    it('should not crash when all callbacks are undefined', () => {
      authorization.useAuthorization.mockReturnValue({
        canManageUsers: true,
        canManageQuotas: false,
        canManageWhatsApp: false,
        canManageTemplates: false
      })

      expect(() => {
        render(
          <QueryClientProvider client={queryClient}>
            <ManagementPanel />
          </QueryClientProvider>
        )
      }).not.toThrow()
    })
  })
})
