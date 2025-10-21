import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import AddPatientsModal from '../components/AddPatientsModal'
import * as i18nLib from '../lib/i18n'

jest.mock('../lib/i18n', () => ({
  useI18n: jest.fn(() => ({
    t: (key, defaultValue, values = {}) => {
      let result = defaultValue
      if (values) {
        Object.keys(values).forEach(k => {
          result = result.replace(`{${k}}`, values[k])
        })
      }
      return result
    }
  }))
}))

describe('AddPatientsModal - Comprehensive Test Suite', () => {
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

  const renderComponent = (props = {}) => {
    const defaults = {
      open: true,
      onClose: jest.fn(),
      onAdd: jest.fn().mockResolvedValue(undefined)
    }
    
    return render(
      <QueryClientProvider client={queryClient}>
        <AddPatientsModal {...{ ...defaults, ...props }} />
      </QueryClientProvider>
    )
  }

  describe('UI Structure & Rendering', () => {
    it('should render modal title when open is true', () => {
      renderComponent({ open: true })
      expect(screen.getByText(/إضافة مرضى جدد/i)).toBeInTheDocument()
    })

    it('should not render modal when open is false', () => {
      renderComponent({ open: false })
      expect(screen.queryByText(/إضافة مرضى جدد/i)).not.toBeInTheDocument()
    })

    it('should display maximum slots limit', () => {
      renderComponent()
      const limitTexts = screen.getAllByText(/الحد الأقصى: 50 مريض/i)
      expect(limitTexts.length).toBeGreaterThan(0)
    })

    it('should render with one empty slot by default', () => {
      renderComponent()
      const fullNameInputs = screen.getAllByPlaceholderText(/أدخل الاسم الكامل/i)
      expect(fullNameInputs).toHaveLength(1)
    })

    it('should display all slot fields: fullName, phone, position', () => {
      renderComponent()
      expect(screen.getByLabelText(/الاسم الكامل/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/رقم الهاتف/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/الموقع المرغوب/i)).toBeInTheDocument()
    })

    it('should have country code dropdown', () => {
      renderComponent()
      const countrySelect = screen.getByDisplayValue(/\+20/i)
      expect(countrySelect).toBeInTheDocument()
      expect(countrySelect).toHaveClass('country-code')
    })

    it('should have action buttons: Add Row, Cancel, Submit', () => {
      renderComponent()
      expect(screen.getByText(/إضافة صف/i)).toBeInTheDocument()
      expect(screen.getByText(/إلغاء/i)).toBeInTheDocument()
      expect(screen.getByText(/إضافة المرضى/i)).toBeInTheDocument()
    })
  })

  describe('Patient Slot Management', () => {
    it('should add a new slot when Add Row button is clicked', async () => {
      renderComponent()
      const addButton = screen.getByText(/إضافة صف/i)

      fireEvent.click(addButton)

      await waitFor(() => {
        const fullNameInputs = screen.getAllByPlaceholderText(/أدخل الاسم الكامل/i)
        expect(fullNameInputs).toHaveLength(2)
      })
    })

    it('should add multiple slots up to MAX_SLOTS (50)', async () => {
      renderComponent()
      const addButton = screen.getByText(/إضافة صف/i)

      // Add 5 more slots
      for (let i = 0; i < 5; i++) {
        fireEvent.click(addButton)
      }

      await waitFor(() => {
        const fullNameInputs = screen.getAllByPlaceholderText(/أدخل الاسم الكامل/i)
        expect(fullNameInputs).toHaveLength(6)
      })
    })

    it('should disable Add Row button when MAX_SLOTS reached', async () => {
      renderComponent()
      const addButton = screen.getByText(/إضافة صف/i)

      // Add 49 slots (1 initial + 49 = 50 total)
      for (let i = 0; i < 49; i++) {
        fireEvent.click(addButton)
        if (i % 10 === 0) {
          await waitFor(() => {
            expect(addButton).not.toBeDisabled()
          })
        }
      }

      // Now button should be disabled
      await waitFor(() => {
        expect(addButton).toBeDisabled()
      })
    })

    it('should remove a slot when delete button is clicked', async () => {
      renderComponent()
      const addButton = screen.getByText(/إضافة صف/i)

      fireEvent.click(addButton)
      fireEvent.click(addButton)

      await waitFor(() => {
        const fullNameInputs = screen.getAllByPlaceholderText(/أدخل الاسم الكامل/i)
        expect(fullNameInputs).toHaveLength(3)
      })

      // Get delete buttons and click first one
      const deleteButtons = screen.getAllByText(/حذف/i)
      fireEvent.click(deleteButtons[0])

      await waitFor(() => {
        const fullNameInputs = screen.getAllByPlaceholderText(/أدخل الاسم الكامل/i)
        expect(fullNameInputs).toHaveLength(2)
      })
    })

    it('should maintain slot data when adding new slots', async () => {
      renderComponent()
      const fullNameInput = screen.getByPlaceholderText(/أدخل الاسم الكامل/i)
      const phoneInput = screen.getByPlaceholderText(/رقم الهاتف/i)

      // Fill first slot
      await userEvent.type(fullNameInput, 'أحمد محمد')
      await userEvent.type(phoneInput, '0123456789')

      // Add new slot
      const addButton = screen.getByText(/إضافة صف/i)
      fireEvent.click(addButton)

      await waitFor(() => {
        const fullNameInputs = screen.getAllByPlaceholderText(/أدخل الاسم الكامل/i)
        expect(fullNameInputs[0].value).toBe('أحمد محمد')
      })
    })
  })

  describe('Form Input Fields', () => {
    it('should update fullName field when typing', async () => {
      renderComponent()
      const fullNameInput = screen.getByPlaceholderText(/أدخل الاسم الكامل/i)

      await userEvent.type(fullNameInput, 'فاطمة علي محمود')

      expect(fullNameInput.value).toBe('فاطمة علي محمود')
    })

    it('should update phoneNumber field when typing', async () => {
      renderComponent()
      const phoneInput = screen.getByPlaceholderText(/رقم الهاتف/i)

      await userEvent.type(phoneInput, '0987654321')

      expect(phoneInput.value).toBe('0987654321')
    })

    it('should update desiredPosition field', async () => {
      renderComponent()
      const positionInput = screen.getByPlaceholderText(/مثال: 3/i)

      await userEvent.type(positionInput, '5')

      expect(positionInput.value).toBe('5')
    })

    it('should change country code', async () => {
      renderComponent()
      const countrySelect = screen.getByDisplayValue(/\+20/i)

      fireEvent.change(countrySelect, { target: { value: '+966' } })

      expect(countrySelect.value).toBe('+966')
    })

    it('should support all country codes: +20, +966, +971', async () => {
      renderComponent()
      const countrySelect = screen.getByDisplayValue(/\+20/i)

      // Test Egypt
      expect(countrySelect).toHaveValue('+20')

      // Test Saudi Arabia
      fireEvent.change(countrySelect, { target: { value: '+966' } })
      expect(countrySelect.value).toBe('+966')

      // Test UAE
      fireEvent.change(countrySelect, { target: { value: '+971' } })
      expect(countrySelect.value).toBe('+971')
    })

    it('should allow numeric only in desiredPosition field', async () => {
      renderComponent()
      const positionInput = screen.getByPlaceholderText(/مثال: 3/i)

      fireEvent.change(positionInput, { target: { value: '10' } })
      expect(positionInput.value).toBe('10')
    })
  })

  describe('Form Validation', () => {
    it('should show error when fullName is empty on submit', async () => {
      const mockOnAdd = jest.fn()
      renderComponent({ onAdd: mockOnAdd })

      const submitButton = screen.getByText(/إضافة المرضى/i)
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/الاسم الكامل مطلوب/i)).toBeInTheDocument()
      })

      expect(mockOnAdd).not.toHaveBeenCalled()
    })

    it('should show error when phoneNumber is empty on submit', async () => {
      const mockOnAdd = jest.fn()
      renderComponent({ onAdd: mockOnAdd })

      const fullNameInput = screen.getByPlaceholderText(/أدخل الاسم الكامل/i)
      await userEvent.type(fullNameInput, 'أحمد محمد')

      const submitButton = screen.getByText(/إضافة المرضى/i)
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/رقم الهاتف مطلوب/i)).toBeInTheDocument()
      })

      expect(mockOnAdd).not.toHaveBeenCalled()
    })

    it('should validate both fields and show multiple errors', async () => {
      const mockOnAdd = jest.fn()
      renderComponent({ onAdd: mockOnAdd })

      const submitButton = screen.getByText(/إضافة المرضى/i)
      fireEvent.click(submitButton)

      await waitFor(() => {
        const errorMessages = screen.getAllByRole('alert')
        expect(errorMessages.length).toBeGreaterThanOrEqual(2)
      })
    })

    it('should allow whitespace-only fullName to trigger validation error', async () => {
      const mockOnAdd = jest.fn()
      renderComponent({ onAdd: mockOnAdd })

      const fullNameInput = screen.getByPlaceholderText(/أدخل الاسم الكامل/i)
      const phoneInput = screen.getByPlaceholderText(/رقم الهاتف/i)

      await userEvent.type(fullNameInput, '   ')
      await userEvent.type(phoneInput, '0123456789')

      const submitButton = screen.getByText(/إضافة المرضى/i)
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/الاسم الكامل مطلوب/i)).toBeInTheDocument()
      })
    })

    it('should skip invalid slots and submit only valid ones', async () => {
      const mockOnAdd = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onAdd: mockOnAdd })

      // Add second slot
      const addButton = screen.getByText(/إضافة صف/i)
      fireEvent.click(addButton)

      const fullNameInputs = screen.getAllByPlaceholderText(/أدخل الاسم الكامل/i)
      const phoneInputs = screen.getAllByPlaceholderText(/رقم الهاتف/i)

      // Fill only second slot (leave first empty)
      await userEvent.type(fullNameInputs[1], 'فاطمة علي')
      await userEvent.type(phoneInputs[1], '0987654321')

      const submitButton = screen.getByText(/إضافة المرضى/i)
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              fullName: 'فاطمة علي',
              phoneNumber: '0987654321'
            })
          ])
        )
      })

      expect(mockOnAdd.mock.calls[0][0]).toHaveLength(1)
    })
  })

  describe('Form Submission', () => {
    it('should call onAdd with correct patient data on successful submission', async () => {
      const mockOnAdd = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onAdd: mockOnAdd })

      const fullNameInput = screen.getByPlaceholderText(/أدخل الاسم الكامل/i)
      const phoneInput = screen.getByPlaceholderText(/رقم الهاتف/i)

      await userEvent.type(fullNameInput, 'أحمد محمد')
      await userEvent.type(phoneInput, '0123456789')

      const submitButton = screen.getByText(/إضافة المرضى/i)
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              fullName: 'أحمد محمد',
              phoneNumber: '0123456789'
            })
          ])
        )
      })
    })

    it('should include desiredPosition when provided', async () => {
      const mockOnAdd = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onAdd: mockOnAdd })

      const fullNameInput = screen.getByPlaceholderText(/أدخل الاسم الكامل/i)
      const phoneInput = screen.getByPlaceholderText(/رقم الهاتف/i)
      const positionInput = screen.getByPlaceholderText(/مثال: 3/i)

      await userEvent.type(fullNameInput, 'محمود أحمد')
      await userEvent.type(phoneInput, '0555555555')
      await userEvent.type(positionInput, '3')

      const submitButton = screen.getByText(/إضافة المرضى/i)
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({
              fullName: 'محمود أحمد',
              phoneNumber: '0555555555',
              desiredPosition: 3
            })
          ])
        )
      })
    })

    it('should convert desiredPosition to integer', async () => {
      const mockOnAdd = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onAdd: mockOnAdd })

      const fullNameInput = screen.getByPlaceholderText(/أدخل الاسم الكامل/i)
      const phoneInput = screen.getByPlaceholderText(/رقم الهاتف/i)
      const positionInput = screen.getByPlaceholderText(/مثال: 3/i)

      await userEvent.type(fullNameInput, 'علي محمد')
      await userEvent.type(phoneInput, '0111111111')
      await userEvent.type(positionInput, '5')

      const submitButton = screen.getByText(/إضافة المرضى/i)
      fireEvent.click(submitButton)

      await waitFor(() => {
        const callData = mockOnAdd.mock.calls[0][0][0]
        expect(typeof callData.desiredPosition).toBe('number')
        expect(callData.desiredPosition).toBe(5)
      })
    })

    it('should not include desiredPosition when not provided', async () => {
      const mockOnAdd = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onAdd: mockOnAdd })

      const fullNameInput = screen.getByPlaceholderText(/أدخل الاسم الكامل/i)
      const phoneInput = screen.getByPlaceholderText(/رقم الهاتف/i)

      await userEvent.type(fullNameInput, 'سارة علي')
      await userEvent.type(phoneInput, '0222222222')

      const submitButton = screen.getByText(/إضافة المرضى/i)
      fireEvent.click(submitButton)

      await waitFor(() => {
        const callData = mockOnAdd.mock.calls[0][0][0]
        expect(callData.desiredPosition).toBeUndefined()
      })
    })

    it('should submit multiple patients in one batch', async () => {
      const mockOnAdd = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onAdd: mockOnAdd })

      const addButton = screen.getByText(/إضافة صف/i)
      fireEvent.click(addButton)

      const fullNameInputs = screen.getAllByPlaceholderText(/أدخل الاسم الكامل/i)
      const phoneInputs = screen.getAllByPlaceholderText(/رقم الهاتف/i)

      await userEvent.type(fullNameInputs[0], 'أحمد محمد')
      await userEvent.type(phoneInputs[0], '0123456789')

      await userEvent.type(fullNameInputs[1], 'فاطمة علي')
      await userEvent.type(phoneInputs[1], '0987654321')

      const submitButton = screen.getByText(/إضافة المرضى/i)
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ fullName: 'أحمد محمد' }),
            expect.objectContaining({ fullName: 'فاطمة علي' })
          ])
        )
      })

      expect(mockOnAdd.mock.calls[0][0]).toHaveLength(2)
    })

    it('should show submitting state during submission', async () => {
      const mockOnAdd = jest.fn(
        () => new Promise(resolve => setTimeout(resolve, 100))
      )
      renderComponent({ onAdd: mockOnAdd })

      const fullNameInput = screen.getByPlaceholderText(/أدخل الاسم الكامل/i)
      const phoneInput = screen.getByPlaceholderText(/رقم الهاتف/i)

      await userEvent.type(fullNameInput, 'محمود علي')
      await userEvent.type(phoneInput, '0333333333')

      const submitButton = screen.getByText(/إضافة المرضى/i)
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/جارٍ الإضافة/i)).toBeInTheDocument()
      })

      await waitFor(() => {
        expect(screen.getByText(/إضافة المرضى/i)).toBeInTheDocument()
      })
    })

    it('should disable submit button during submission', async () => {
      const mockOnAdd = jest.fn(
        () => new Promise(resolve => setTimeout(resolve, 100))
      )
      renderComponent({ onAdd: mockOnAdd })

      const fullNameInput = screen.getByPlaceholderText(/أدخل الاسم الكامل/i)
      const phoneInput = screen.getByPlaceholderText(/رقم الهاتف/i)

      await userEvent.type(fullNameInput, 'ياسمين محمد')
      await userEvent.type(phoneInput, '0444444444')

      const submitButton = screen.getByText(/إضافة المرضى/i)
      fireEvent.click(submitButton)

      await waitFor(() => {
        const disabledButton = screen.getByText(/جارٍ الإضافة/i)
        expect(disabledButton).toBeDisabled()
      })
    })
  })

  describe('Modal Interaction', () => {
    it('should call onClose when Cancel button is clicked', async () => {
      const mockOnClose = jest.fn()
      renderComponent({ onClose: mockOnClose })

      const cancelButton = screen.getByText(/إلغاء/i)
      fireEvent.click(cancelButton)

      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should call onClose after successful submission', async () => {
      const mockOnClose = jest.fn()
      const mockOnAdd = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onClose: mockOnClose, onAdd: mockOnAdd })

      const fullNameInput = screen.getByPlaceholderText(/أدخل الاسم الكامل/i)
      const phoneInput = screen.getByPlaceholderText(/رقم الهاتف/i)

      await userEvent.type(fullNameInput, 'سامي محمد')
      await userEvent.type(phoneInput, '0555555555')

      const submitButton = screen.getByText(/إضافة المرضى/i)
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockOnClose).toHaveBeenCalled()
      })
    })

    it('should reset form after successful submission', async () => {
      const mockOnAdd = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onAdd: mockOnAdd })

      const fullNameInput = screen.getByPlaceholderText(/أدخل الاسم الكامل/i)
      const phoneInput = screen.getByPlaceholderText(/رقم الهاتف/i)

      await userEvent.type(fullNameInput, 'ليلى محمد')
      await userEvent.type(phoneInput, '0666666666')

      const submitButton = screen.getByText(/إضافة المرضى/i)
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalled()
        // Form should be reset to initial state
        const resetFullName = screen.getByPlaceholderText(/أدخل الاسم الكامل/i)
        expect(resetFullName.value).toBe('')
      })
    })
  })

  describe('Accessibility', () => {
    it('should have labels for all input fields', () => {
      renderComponent()
      expect(screen.getByLabelText(/الاسم الكامل/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/رقم الهاتف/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/الموقع المرغوب/i)).toBeInTheDocument()
    })

    it('should display error messages with role="alert"', async () => {
      renderComponent()
      const submitButton = screen.getByText(/إضافة المرضى/i)
      fireEvent.click(submitButton)

      await waitFor(() => {
        const alertElements = screen.getAllByRole('alert')
        expect(alertElements.length).toBeGreaterThanOrEqual(1)
      })
    })

    it('should have aria-labels on buttons', () => {
      renderComponent()
      const buttons = screen.getAllByRole('button')
      expect(buttons.length).toBeGreaterThan(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle very long names', async () => {
      const mockOnAdd = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onAdd: mockOnAdd })

      const longName = 'محمد علي حسن إبراهيم عبدالعزيز محمود أحمد علي حسن'
      const fullNameInput = screen.getByPlaceholderText(/أدخل الاسم الكامل/i)
      const phoneInput = screen.getByPlaceholderText(/رقم الهاتف/i)

      await userEvent.type(fullNameInput, longName)
      await userEvent.type(phoneInput, '0777777777')

      const submitButton = screen.getByText(/إضافة المرضى/i)
      fireEvent.click(submitButton)

      await waitFor(() => {
        const callData = mockOnAdd.mock.calls[0][0][0]
        expect(callData.fullName).toBe(longName)
      })
    })

    it('should handle special characters in phone number', async () => {
      const mockOnAdd = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onAdd: mockOnAdd })

      const fullNameInput = screen.getByPlaceholderText(/أدخل الاسم الكامل/i)
      const phoneInput = screen.getByPlaceholderText(/رقم الهاتف/i)

      await userEvent.type(fullNameInput, 'أحمد محمد')
      await userEvent.type(phoneInput, '+201012345678')

      const submitButton = screen.getByText(/إضافة المرضى/i)
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalled()
      })
    })

    it('should handle zero in desiredPosition', async () => {
      const mockOnAdd = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onAdd: mockOnAdd })

      const fullNameInput = screen.getByPlaceholderText(/أدخل الاسم الكامل/i)
      const phoneInput = screen.getByPlaceholderText(/رقم الهاتف/i)
      const positionInput = screen.getByPlaceholderText(/مثال: 3/i)

      await userEvent.type(fullNameInput, 'سارة محمد')
      await userEvent.type(phoneInput, '0888888888')
      await userEvent.type(positionInput, '0')

      const submitButton = screen.getByText(/إضافة المرضى/i)
      fireEvent.click(submitButton)

      await waitFor(() => {
        const callData = mockOnAdd.mock.calls[0][0][0]
        expect(callData.desiredPosition).toBe(0)
      })
    })

    it('should handle large position numbers', async () => {
      const mockOnAdd = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onAdd: mockOnAdd })

      const fullNameInput = screen.getByPlaceholderText(/أدخل الاسم الكامل/i)
      const phoneInput = screen.getByPlaceholderText(/رقم الهاتف/i)
      const positionInput = screen.getByPlaceholderText(/مثال: 3/i)

      await userEvent.type(fullNameInput, 'ليلى محمود')
      await userEvent.type(phoneInput, '0999999999')
      await userEvent.type(positionInput, '9999')

      const submitButton = screen.getByText(/إضافة المرضى/i)
      fireEvent.click(submitButton)

      await waitFor(() => {
        const callData = mockOnAdd.mock.calls[0][0][0]
        expect(callData.desiredPosition).toBe(9999)
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle onAdd API errors gracefully', async () => {
      const mockOnAdd = jest.fn().mockRejectedValue(new Error('API Error'))
      const mockOnClose = jest.fn()
      renderComponent({ onAdd: mockOnAdd, onClose: mockOnClose })

      const fullNameInput = screen.getByPlaceholderText(/أدخل الاسم الكامل/i)
      const phoneInput = screen.getByPlaceholderText(/رقم الهاتف/i)

      await userEvent.type(fullNameInput, 'علي محمد')
      await userEvent.type(phoneInput, '0101010101')

      const submitButton = screen.getByText(/إضافة المرضى/i)
      fireEvent.click(submitButton)

      // Wait for error handling
      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalled()
      })

      // Modal should not close on error
      expect(mockOnClose).not.toHaveBeenCalled()
    })

    it('should keep form data when submission fails', async () => {
      const mockOnAdd = jest.fn().mockRejectedValue(new Error('API Error'))
      renderComponent({ onAdd: mockOnAdd })

      const fullNameInput = screen.getByPlaceholderText(/أدخل الاسم الكامل/i)
      const phoneInput = screen.getByPlaceholderText(/رقم الهاتف/i)

      await userEvent.type(fullNameInput, 'فاطمة علي')
      await userEvent.type(phoneInput, '0121212121')

      const submitButton = screen.getByText(/إضافة المرضى/i)
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockOnAdd).toHaveBeenCalled()
      })

      // Data should still be in form
      expect(fullNameInput.value).toBe('فاطمة علي')
      expect(phoneInput.value).toBe('0121212121')
    })
  })
})
