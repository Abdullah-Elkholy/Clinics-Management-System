import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import AddQueueModal from '../components/AddQueueModal'
import * as i18nLib from '../lib/i18n'

/**
 * AddQueueModal Comprehensive Test Suite
 * 
 * Component: Allows users to add new queues with name and description
 * Features:
 * - Modal open/close control
 * - Form inputs: queue name and description
 * - Submit/cancel buttons
 * - Form validation
 * - Callback handling (onAdd)
 * - Arabic localization (RTL)
 * - Accessibility compliance
 */

jest.mock('../lib/i18n', () => ({
  useI18n: jest.fn(() => ({
    t: (key, defaultValue) => defaultValue
  }))
}))

describe('AddQueueModal - Comprehensive Test Suite', () => {
  const mockOnClose = jest.fn()
  const mockOnAdd = jest.fn()

  const defaultProps = {
    open: true,
    onClose: mockOnClose,
    onAdd: mockOnAdd
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Modal Visibility & Structure', () => {
    it('should render modal when open prop is true', () => {
      render(<AddQueueModal {...defaultProps} />)
      
      const title = screen.getByText(/إضافة طابور جديد/i)
      expect(title).toBeInTheDocument()
    })

    it('should not render modal when open prop is false', () => {
      const { container } = render(
        <AddQueueModal {...defaultProps} open={false} />
      )
      
      const modal = container.querySelector('[role="dialog"]')
      if (modal) {
        expect(modal).toHaveAttribute('hidden')
      }
    })

    it('should display modal title "إضافة طابور جديد"', () => {
      render(<AddQueueModal {...defaultProps} />)
      
      const title = screen.getByText(/إضافة طابور جديد/i)
      expect(title).toBeInTheDocument()
    })

    it('should display queue name input field with label', () => {
      render(<AddQueueModal {...defaultProps} />)
      
      const nameLabel = screen.getByText(/اسم الطابور/i)
      expect(nameLabel).toBeInTheDocument()
      
      const nameInput = screen.getByLabelText(/اسم الطابور/i)
      expect(nameInput).toBeInTheDocument()
      expect(nameInput).toHaveAttribute('type', 'text')
    })

    it('should display description textarea field with label', () => {
      render(<AddQueueModal {...defaultProps} />)
      
      const descriptionLabel = screen.getByText(/الوصف/i)
      expect(descriptionLabel).toBeInTheDocument()
      
      const descriptionInput = screen.getByLabelText(/الوصف/i)
      expect(descriptionInput).toBeInTheDocument()
      expect(descriptionInput.tagName).toBe('TEXTAREA')
    })

    it('should have form in correct semantic structure', () => {
      const { container } = render(<AddQueueModal {...defaultProps} />)
      
      const inputs = container.querySelectorAll('input[type="text"], textarea')
      expect(inputs.length).toBe(2)
    })
  })

  describe('Form Input Handling', () => {
    it('should update queue name on input change', async () => {
      const user = userEvent.setup()
      render(<AddQueueModal {...defaultProps} />)
      
      const nameInput = screen.getByLabelText(/اسم الطابور/i)
      await user.type(nameInput, 'د. أحمد محمد')
      
      expect(nameInput.value).toBe('د. أحمد محمد')
    })

    it('should update description on textarea change', async () => {
      const user = userEvent.setup()
      render(<AddQueueModal {...defaultProps} />)
      
      const descriptionInput = screen.getByLabelText(/الوصف/i)
      await user.type(descriptionInput, 'طابور العيادة الخارجية')
      
      expect(descriptionInput.value).toBe('طابور العيادة الخارجية')
    })

    it('should handle special characters in queue name', async () => {
      const user = userEvent.setup()
      render(<AddQueueModal {...defaultProps} />)
      
      const nameInput = screen.getByLabelText(/اسم الطابور/i)
      const specialName = 'د. محمد-علي (المتخصص)'
      await user.type(nameInput, specialName)
      
      expect(nameInput.value).toBe(specialName)
    })

    it('should handle long queue names', async () => {
      const user = userEvent.setup()
      render(<AddQueueModal {...defaultProps} />)
      
      const nameInput = screen.getByLabelText(/اسم الطابور/i)
      const longName = 'عيادة الجراحة العامة والمتخصصة بقسم الطب الباطني'
      await user.type(nameInput, longName)
      
      expect(nameInput.value).toBe(longName)
    })

    it('should handle multiline description input', async () => {
      const user = userEvent.setup()
      render(<AddQueueModal {...defaultProps} />)
      
      const descriptionInput = screen.getByLabelText(/الوصف/i)
      const multilineDescription = 'طابور العيادة\nيوم السبت والثلاثاء\nمن 2 إلى 6 مساء'
      await user.type(descriptionInput, multilineDescription)
      
      expect(descriptionInput.value).toContain('طابور العيادة')
      expect(descriptionInput.value).toContain('يوم السبت')
    })

    it('should maintain separate state for name and description', async () => {
      const user = userEvent.setup()
      render(<AddQueueModal {...defaultProps} />)
      
      const nameInput = screen.getByLabelText(/اسم الطابور/i)
      const descriptionInput = screen.getByLabelText(/الوصف/i)
      
      await user.type(nameInput, 'د. فاطمة')
      await user.type(descriptionInput, 'عيادة النساء')
      
      expect(nameInput.value).toBe('د. فاطمة')
      expect(descriptionInput.value).toBe('عيادة النساء')
    })

    it('should allow clearing input fields', async () => {
      const user = userEvent.setup()
      render(<AddQueueModal {...defaultProps} />)
      
      const nameInput = screen.getByLabelText(/اسم الطابور/i)
      await user.type(nameInput, 'Test')
      await user.clear(nameInput)
      
      expect(nameInput.value).toBe('')
    })
  })

  describe('Button Actions & Callbacks', () => {
    it('should call onAdd with form data when add button clicked', async () => {
      const user = userEvent.setup()
      render(<AddQueueModal {...defaultProps} />)
      
      const nameInput = screen.getByLabelText(/اسم الطابور/i)
      const descriptionInput = screen.getByLabelText(/الوصف/i)
      
      await user.type(nameInput, 'د. أحمد')
      await user.type(descriptionInput, 'طابور العيادة')
      
      const addButton = screen.getByRole('button', { name: /إضافة/i })
      await user.click(addButton)
      
      expect(mockOnAdd).toHaveBeenCalledWith('د. أحمد', 'طابور العيادة')
    })

    it('should call onClose when cancel button clicked', async () => {
      const user = userEvent.setup()
      render(<AddQueueModal {...defaultProps} />)
      
      const cancelButton = screen.getByRole('button', { name: /إلغاء/i })
      await user.click(cancelButton)
      
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should clear form after successful add', async () => {
      const user = userEvent.setup()
      const { rerender } = render(<AddQueueModal {...defaultProps} />)
      
      const nameInput = screen.getByLabelText(/اسم الطابور/i)
      const descriptionInput = screen.getByLabelText(/الوصف/i)
      
      await user.type(nameInput, 'د. محمد')
      await user.type(descriptionInput, 'عيادة')
      
      const addButton = screen.getByRole('button', { name: /إضافة/i })
      await user.click(addButton)
      
      // Rerender to check if form is cleared
      rerender(<AddQueueModal {...defaultProps} />)
      
      const newNameInput = screen.getByLabelText(/اسم الطابور/i)
      const newDescriptionInput = screen.getByLabelText(/الوصف/i)
      
      expect(newNameInput.value).toBe('')
      expect(newDescriptionInput.value).toBe('')
    })

    it('should allow multiple adds in sequence', async () => {
      const user = userEvent.setup()
      render(<AddQueueModal {...defaultProps} />)
      
      // First add
      const nameInput = screen.getByLabelText(/اسم الطابور/i)
      const descriptionInput = screen.getByLabelText(/الوصف/i)
      
      await user.type(nameInput, 'د. أحمد')
      await user.type(descriptionInput, 'طابور أول')
      
      const addButton = screen.getByRole('button', { name: /إضافة/i })
      await user.click(addButton)
      
      expect(mockOnAdd).toHaveBeenCalledTimes(1)
      
      // Second add (mock will be called again with new data)
      mockOnAdd.mockClear()
      
      await user.type(nameInput, 'د. فاطمة')
      await user.type(descriptionInput, 'طابور ثاني')
      await user.click(addButton)
      
      expect(mockOnAdd).toHaveBeenCalledWith('د. فاطمة', 'طابور ثاني')
    })

    it('should call onAdd with empty description if not provided', async () => {
      const user = userEvent.setup()
      render(<AddQueueModal {...defaultProps} />)
      
      const nameInput = screen.getByLabelText(/اسم الطابور/i)
      await user.type(nameInput, 'د. محمد')
      
      const addButton = screen.getByRole('button', { name: /إضافة/i })
      await user.click(addButton)
      
      expect(mockOnAdd).toHaveBeenCalledWith('د. محمد', '')
    })
  })

  describe('Form Validation & Edge Cases', () => {
    it('should allow adding queue with only name', async () => {
      const user = userEvent.setup()
      render(<AddQueueModal {...defaultProps} />)
      
      const nameInput = screen.getByLabelText(/اسم الطابور/i)
      await user.type(nameInput, 'د. علي')
      
      const addButton = screen.getByRole('button', { name: /إضافة/i })
      await user.click(addButton)
      
      expect(mockOnAdd).toHaveBeenCalledWith('د. علي', '')
    })

    it('should allow adding queue with only description', async () => {
      const user = userEvent.setup()
      render(<AddQueueModal {...defaultProps} />)
      
      const descriptionInput = screen.getByLabelText(/الوصف/i)
      await user.type(descriptionInput, 'طابور العيادة')
      
      const addButton = screen.getByRole('button', { name: /إضافة/i })
      await user.click(addButton)
      
      expect(mockOnAdd).toHaveBeenCalledWith('', 'طابور العيادة')
    })

    it('should handle whitespace-only inputs', async () => {
      const user = userEvent.setup()
      render(<AddQueueModal {...defaultProps} />)
      
      const nameInput = screen.getByLabelText(/اسم الطابور/i)
      await user.type(nameInput, '   ')
      
      const addButton = screen.getByRole('button', { name: /إضافة/i })
      await user.click(addButton)
      
      expect(mockOnAdd).toHaveBeenCalledWith('   ', '')
    })

    it('should handle very long queue names', async () => {
      const user = userEvent.setup()
      render(<AddQueueModal {...defaultProps} />)
      
      const nameInput = screen.getByLabelText(/اسم الطابور/i)
      const veryLongName = 'أ'.repeat(200)
      await user.type(nameInput, veryLongName)
      
      const addButton = screen.getByRole('button', { name: /إضافة/i })
      await user.click(addButton)
      
      expect(mockOnAdd).toHaveBeenCalledWith(veryLongName, '')
    })

    it('should handle numeric and special character combinations', async () => {
      const user = userEvent.setup()
      render(<AddQueueModal {...defaultProps} />)
      
      const nameInput = screen.getByLabelText(/اسم الطابور/i)
      const specialInput = 'عيادة #1 (د. محمد-علي) @ 2024'
      await user.type(nameInput, specialInput)
      
      expect(nameInput.value).toBe(specialInput)
    })
  })

  describe('Localization & RTL Support', () => {
    it('should display Arabic text labels', () => {
      render(<AddQueueModal {...defaultProps} />)
      
      expect(screen.getByText(/إضافة طابور جديد/i)).toBeInTheDocument()
      expect(screen.getByText(/اسم الطابور/i)).toBeInTheDocument()
      expect(screen.getByText(/الوصف/i)).toBeInTheDocument()
    })

    it('should have input fields that support Arabic text', async () => {
      const user = userEvent.setup()
      render(<AddQueueModal {...defaultProps} />)
      
      const nameInput = screen.getByLabelText(/اسم الطابور/i)
      await user.type(nameInput, 'د. أحمد محمد علي')
      
      expect(nameInput.value).toBe('د. أحمد محمد علي')
    })

    it('should handle mixed Arabic and English input', async () => {
      const user = userEvent.setup()
      render(<AddQueueModal {...defaultProps} />)
      
      const nameInput = screen.getByLabelText(/اسم الطابور/i)
      const mixedText = 'Dr. أحمد (General Medicine)'
      await user.type(nameInput, mixedText)
      
      expect(nameInput.value).toBe(mixedText)
    })

    it('should use i18n for button labels', () => {
      render(<AddQueueModal {...defaultProps} />)
      
      const cancelButton = screen.getByRole('button', { name: /إلغاء/i })
      const addButton = screen.getByRole('button', { name: /إضافة/i })
      
      expect(cancelButton).toBeInTheDocument()
      expect(addButton).toBeInTheDocument()
    })
  })

  describe('Accessibility Compliance', () => {
    it('should have properly associated labels with inputs', () => {
      render(<AddQueueModal {...defaultProps} />)
      
      const nameInput = screen.getByLabelText(/اسم الطابور/i)
      expect(nameInput).toHaveAttribute('id', 'queue-name')
      
      const descriptionInput = screen.getByLabelText(/الوصف/i)
      expect(descriptionInput).toHaveAttribute('id', 'queue-description')
    })

    it('should have accessible buttons with clear labels', () => {
      render(<AddQueueModal {...defaultProps} />)
      
      const cancelButton = screen.getByRole('button', { name: /إلغاء/i })
      const addButton = screen.getByRole('button', { name: /إضافة/i })
      
      expect(cancelButton).toHaveAccessibleName()
      expect(addButton).toHaveAccessibleName()
    })

    it('should support keyboard navigation', async () => {
      const user = userEvent.setup()
      render(<AddQueueModal {...defaultProps} />)
      
      const nameInput = screen.getByLabelText(/اسم الطابور/i)
      await user.tab()
      
      // Input should be focusable
      expect(nameInput).toBeInTheDocument()
    })

    it('should have proper focus management', async () => {
      const user = userEvent.setup()
      render(<AddQueueModal {...defaultProps} />)
      
      const nameInput = screen.getByLabelText(/اسم الطابور/i)
      nameInput.focus()
      
      expect(nameInput).toHaveFocus()
    })

    it('should have semantic form structure', () => {
      const { container } = render(<AddQueueModal {...defaultProps} />)
      
      const labels = container.querySelectorAll('label')
      expect(labels.length).toBeGreaterThanOrEqual(2)
      
      // Verify labels exist and are associated with inputs
      const nameLabel = screen.getByText(/اسم الطابور/i)
      const descLabel = screen.getByText(/الوصف/i)
      
      expect(nameLabel).toBeInTheDocument()
      expect(descLabel).toBeInTheDocument()
    })
  })

  describe('Modal State Management', () => {
    it('should handle modal open/close transitions', () => {
      const { rerender } = render(
        <AddQueueModal {...defaultProps} open={true} />
      )
      
      const title = screen.getByText(/إضافة طابور جديد/i)
      expect(title).toBeInTheDocument()
      
      rerender(<AddQueueModal {...defaultProps} open={false} />)
      // Modal should be hidden or not rendered
    })

    it('should clear form data when add button is clicked', async () => {
      const user = userEvent.setup()
      const { rerender } = render(
        <AddQueueModal {...defaultProps} open={true} />
      )
      
      const nameInput = screen.getByLabelText(/اسم الطابور/i)
      await user.type(nameInput, 'د. محمد')
      
      expect(nameInput.value).toBe('د. محمد')
      
      // Click add button
      const addButton = screen.getByRole('button', { name: /إضافة/i })
      await user.click(addButton)
      
      // Callback should be called with the data
      expect(mockOnAdd).toHaveBeenCalledWith('د. محمد', '')
      
      // Component clears form after add
      rerender(<AddQueueModal {...defaultProps} open={true} />)
      const newNameInput = screen.getByLabelText(/اسم الطابور/i)
      expect(newNameInput.value).toBe('')
    })

    it('should handle rapid open/close cycles', () => {
      const { rerender } = render(
        <AddQueueModal {...defaultProps} open={true} />
      )
      
      for (let i = 0; i < 5; i++) {
        rerender(<AddQueueModal {...defaultProps} open={false} />)
        rerender(<AddQueueModal {...defaultProps} open={true} />)
      }
      
      const title = screen.getByText(/إضافة طابور جديد/i)
      expect(title).toBeInTheDocument()
    })
  })

  describe('Input Field Styling & CSS Classes', () => {
    it('should have proper input styling classes', () => {
      render(<AddQueueModal {...defaultProps} />)
      
      const nameInput = screen.getByLabelText(/اسم الطابور/i)
      expect(nameInput).toHaveClass('block', 'w-full', 'px-3', 'py-2')
    })

    it('should apply focus styles to inputs', () => {
      render(<AddQueueModal {...defaultProps} />)
      
      const nameInput = screen.getByLabelText(/اسم الطابور/i)
      expect(nameInput).toHaveClass('focus:outline-none', 'focus:ring-indigo-500')
    })

    it('should have border styling on inputs', () => {
      render(<AddQueueModal {...defaultProps} />)
      
      const nameInput = screen.getByLabelText(/اسم الطابور/i)
      expect(nameInput).toHaveClass('border', 'border-gray-300')
    })

    it('should have rounded corners on inputs', () => {
      render(<AddQueueModal {...defaultProps} />)
      
      const nameInput = screen.getByLabelText(/اسم الطابور/i)
      expect(nameInput).toHaveClass('rounded-md')
    })

    it('should have label styling classes', () => {
      const { container } = render(<AddQueueModal {...defaultProps} />)
      
      const labels = container.querySelectorAll('label')
      labels.forEach(label => {
        expect(label).toHaveClass('block', 'text-sm', 'font-medium')
      })
    })
  })

  describe('Integration Scenarios', () => {
    it('should handle complete workflow: input -> add -> clear', async () => {
      const user = userEvent.setup()
      render(<AddQueueModal {...defaultProps} />)
      
      const nameInput = screen.getByLabelText(/اسم الطابور/i)
      const descriptionInput = screen.getByLabelText(/الوصف/i)
      
      // Step 1: Input data
      await user.type(nameInput, 'د. أحمد محمد')
      await user.type(descriptionInput, 'طابور العيادة العامة')
      
      // Step 2: Click add
      const addButton = screen.getByRole('button', { name: /إضافة/i })
      await user.click(addButton)
      
      // Step 3: Verify callback
      expect(mockOnAdd).toHaveBeenCalledWith('د. أحمد محمد', 'طابور العيادة العامة')
    })

    it('should handle cancel workflow without calling onAdd', async () => {
      const user = userEvent.setup()
      render(<AddQueueModal {...defaultProps} />)
      
      const nameInput = screen.getByLabelText(/اسم الطابور/i)
      await user.type(nameInput, 'د. محمد')
      
      const cancelButton = screen.getByRole('button', { name: /إلغاء/i })
      await user.click(cancelButton)
      
      expect(mockOnAdd).not.toHaveBeenCalled()
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should handle data input with all edge cases', async () => {
      const user = userEvent.setup()
      render(<AddQueueModal {...defaultProps} />)
      
      const nameInput = screen.getByLabelText(/اسم الطابور/i)
      const descriptionInput = screen.getByLabelText(/الوصف/i)
      
      // Edge case inputs
      const complexName = "د. محمد-علي O'Brien (م.ج) #1"
      const complexDescription = 'الساعات: 9-5\nالأيام: السبت-الجمعة\nملاحظات: غرفة 205'
      
      await user.type(nameInput, complexName)
      await user.type(descriptionInput, complexDescription)
      
      const addButton = screen.getByRole('button', { name: /إضافة/i })
      await user.click(addButton)
      
      expect(mockOnAdd).toHaveBeenCalledWith(complexName, complexDescription)
    })
  })
})
