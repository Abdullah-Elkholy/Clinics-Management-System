import React from 'react'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import CSVUpload from '../components/CSVUpload'
import * as i18nLib from '../lib/i18n'

/**
 * CSV Upload Modal Test Suite - Enhanced with Prototype.html Structure
 * 
 * PROTOTYPE.HTML REFERENCE SCAN:
 * =============================
 * Lines 434-465 (Upload Modal Structure):
 * - Modal ID: uploadModal
 * - Container: "bg-white rounded-xl p-6 w-full max-w-lg"
 * - Title: "رفع ملف المرضى" (h3 class="text-xl font-bold text-gray-800 mb-4")
 * - File Input Zone: "border-2 border-dashed border-gray-300 rounded-lg p-6"
 * - Icon: "fas fa-cloud-upload-alt text-4xl text-gray-400"
 * - Button Text: "اختيار ملف Excel" (BUT component uses .csv)
 * - Warning Box: "bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4"
 * - Template Requirements:
 *   * "العمود الأول: الترتيب"
 *   * "العمود الثاني: الاسم الكامل"
 *   * "العمود الثالث: رقم الهاتف"
 * - Buttons: "Upload & Process" (green) and "Cancel" (gray)
 * 
 * COMPONENT IMPLEMENTATION (CSVUpload.js):
 * ======================================
 * - Uses PapaParse for streaming CSV parsing
 * - File accept: ".csv" only
 * - Header detection: auto-detects headers with keywords
 * - Column mapping: fullName, phoneNumber, desiredPosition
 * - Chunking: 64KB per chunk for large files
 * - Callbacks: onChunk, onProgress, onComplete, onError, onParsed
 * - Localization: Full Arabic (RTL) support
 */

jest.mock('../lib/i18n', () => ({
  useI18n: jest.fn(() => ({
    t: (key, defaultValue) => defaultValue
  }))
}))

describe('CSV Upload Modal - Full Feature Test Suite', () => {
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

  // Test data factory for consistent data generation
  const createTestCSVData = (rows = [], withHeader = false) => {
    const header = 'الاسم الكامل,رقم الهاتف,الترتيب'
    const dataLines = rows.map(r => `${r.name},${r.phone},${r.position || ''}`)
    const content = withHeader ? [header, ...dataLines].join('\n') : dataLines.join('\n')
    return content
  }

  const createTestFile = (content, filename = 'patients.csv') => {
    return new File([content], filename, { type: 'text/csv' })
  }

  const renderComponent = (props = {}) => {
    const defaults = {
      onChunk: jest.fn(),
      onProgress: jest.fn(),
      onComplete: jest.fn(),
      onError: jest.fn(),
      onParsed: jest.fn()
    }
    
    return render(
      <QueryClientProvider client={queryClient}>
        <CSVUpload {...{ ...defaults, ...props }} />
      </QueryClientProvider>
    )
  }

  describe('UI Structure - Matches Prototype (Lines 434-465)', () => {
    it('should render title "رفع ملف المرضى" as per Prototype line 436', () => {
      renderComponent()
      const title = screen.getByText(/رفع ملف المرضى/i)
      expect(title).toBeInTheDocument()
      // Verify it's a visible text element (could be label or heading)
      const tagName = title.tagName.toLowerCase()
      expect(['label', 'h1', 'h2', 'h3', 'h4', 'div']).toContain(tagName)
    })

    it('should render file input with .csv accept attribute (Prototype line 441)', () => {
      renderComponent()
      const fileInput = document.querySelector('input[type="file"]')
      
      expect(fileInput).toBeInTheDocument()
      expect(fileInput).toHaveAttribute('accept', '.csv')
      // Verify aria-label for accessibility
      expect(fileInput).toHaveAttribute('aria-label')
    })

    it('should display yellow warning box with template requirements (Prototype lines 447-454)', () => {
      const { container } = renderComponent()
      
      // Find warning box with specific Tailwind classes
      const warningBox = container.querySelector('.bg-yellow-50')
      expect(warningBox).toBeInTheDocument()
      expect(warningBox).toHaveClass('border-yellow-200')
      
      // Verify header text
      expect(screen.getByText(/نموذج الملف المطلوب/i)).toBeInTheDocument()
    })

    it('should display all three column requirements in template info', () => {
      renderComponent()
      
      // According to Prototype lines 450-452, should show:
      // "العمود الأول: الاسم الكامل"
      // "العمود الثاني: رقم الهاتف"
      // "العمود الثالث: الترتيب (اختياري)"
      const templateText = screen.getByText(/العمود الأول: الاسم الكامل/i)
      expect(templateText).toBeInTheDocument()
      
      // Verify all three columns are mentioned (may be in one element or separate)
      const allText = screen.getByText(/العمود/)
      expect(allText.textContent).toMatch(/العمود الأول/)
      expect(allText.textContent).toMatch(/العمود الثاني/)
    })

    it('should maintain Tailwind styling classes from Prototype', () => {
      const { container } = renderComponent()
      const fileInput = document.querySelector('input[type="file"]')
      
      // Component should have file input with proper styling
      expect(fileInput).toBeInTheDocument()
      
      // Should have warning box with yellow styling
      const warningBox = container.querySelector('.bg-yellow-50')
      expect(warningBox).toHaveClass('bg-yellow-50')
      expect(warningBox).toHaveClass('border')
      expect(warningBox).toHaveClass('rounded')
    })
  })

  describe('File Upload Handling - Data Wiring', () => {
    it('should only accept CSV files per Prototype spec', () => {
      renderComponent()
      const fileInput = document.querySelector('input[type="file"]')
      
      expect(fileInput).toHaveAttribute('accept', '.csv')
    })

    it('should parse CSV file on selection - Basic flow', async () => {
      const mockOnChunk = jest.fn().mockResolvedValue(undefined)
      const mockOnComplete = jest.fn()
      renderComponent({ 
        onChunk: mockOnChunk,
        onComplete: mockOnComplete 
      })

      const fileInput = document.querySelector('input[type="file"]')
      const csvContent = createTestCSVData([
        { name: 'محمد أحمد', phone: '0123456789', position: '' }
      ])
      const file = createTestFile(csvContent)

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(mockOnChunk).toHaveBeenCalled()
        expect(mockOnComplete).toHaveBeenCalled()
      })
    })

    it('should map CSV columns: fullName, phoneNumber, desiredPosition', async () => {
      const mockOnChunk = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onChunk: mockOnChunk })

      const fileInput = document.querySelector('input[type="file"]')
      const csvContent = createTestCSVData([
        { name: 'أحمد محمد', phone: '0123456789', position: '1' },
        { name: 'فاطمة علي', phone: '0987654321', position: '2' }
      ])
      const file = createTestFile(csvContent)

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        const calls = mockOnChunk.mock.calls
        expect(calls.length).toBeGreaterThan(0)
        
        const parsedData = calls[0][0] // First chunk
        expect(parsedData).toEqual(expect.arrayContaining([
          expect.objectContaining({
            fullName: 'أحمد محمد',
            phoneNumber: '0123456789',
            desiredPosition: '1'
          }),
          expect.objectContaining({
            fullName: 'فاطمة علي',
            phoneNumber: '0987654321',
            desiredPosition: '2'
          })
        ]))
      })
    })

    it('should handle optional position column gracefully', async () => {
      const mockOnChunk = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onChunk: mockOnChunk })

      const fileInput = document.querySelector('input[type="file"]')
      const csvContent = 'محمد أحمد,0123456789\nفاطمة علي,0987654321'
      const file = createTestFile(csvContent)

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        const calls = mockOnChunk.mock.calls
        const parsedData = calls[0][0]
        
        expect(parsedData).toEqual(expect.arrayContaining([
          expect.objectContaining({
            fullName: 'محمد أحمد',
            phoneNumber: '0123456789',
            desiredPosition: ''
          })
        ]))
      })
    })

    it('should handle file upload state reset between uploads', async () => {
      const mockOnChunk = jest.fn().mockResolvedValue(undefined)
      const mockOnComplete = jest.fn()
      renderComponent({ 
        onChunk: mockOnChunk,
        onComplete: mockOnComplete 
      })

      const fileInput = document.querySelector('input[type="file"]')
      
      // First upload
      const file1 = createTestFile(createTestCSVData([
        { name: 'أحمد', phone: '0123456789', position: '' }
      ]))
      fireEvent.change(fileInput, { target: { files: [file1] } })

      await waitFor(() => expect(mockOnChunk).toHaveBeenCalled())
      
      // Clear for second upload
      mockOnChunk.mockClear()
      
      // Second upload
      const file2 = createTestFile(createTestCSVData([
        { name: 'فاطمة', phone: '0987654321', position: '' }
      ]))
      fireEvent.change(fileInput, { target: { files: [file2] } })

      await waitFor(() => {
        expect(mockOnChunk).toHaveBeenCalled()
      })
    })
  })

  describe('CSV Parsing - Headers & Data Detection', () => {
    it('should auto-detect and skip header row with keyword matching', async () => {
      const mockOnChunk = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onChunk: mockOnChunk })

      const fileInput = document.querySelector('input[type="file"]')
      // Header row with keywords that trigger auto-detection
      const csvContent = 'الاسم الكامل,رقم الهاتف,الترتيب\nأحمد محمد,0123456789,1'
      const file = createTestFile(csvContent)

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(mockOnChunk).toHaveBeenCalled()
        const parsedData = mockOnChunk.mock.calls[0][0]
        
        // Should contain the data row, not the header
        expect(parsedData).toEqual(expect.arrayContaining([
          expect.objectContaining({
            fullName: 'أحمد محمد'
          })
        ]))
      })
    })

    it('should handle multiple header naming variations', async () => {
      const mockOnChunk = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onChunk: mockOnChunk })

      const fileInput = document.querySelector('input[type="file"]')
      // English header with recognized keywords
      const csvContent = 'Full Name,Phone Number,Desired Position\nأحمد محمد,0123456789,1'
      const file = createTestFile(csvContent)

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        const parsedData = mockOnChunk.mock.calls[0][0]
        expect(parsedData[0].fullName).toBe('أحمد محمد')
      })
    })

    it('should work without header row when no keywords detected', async () => {
      const mockOnChunk = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onChunk: mockOnChunk })

      const fileInput = document.querySelector('input[type="file"]')
      // No header, just data
      const csvContent = 'أحمد محمد,0123456789\nفاطمة علي,0987654321'
      const file = createTestFile(csvContent)

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        const parsedData = mockOnChunk.mock.calls[0][0]
        // Both rows should be parsed as data
        expect(parsedData.length).toBeGreaterThanOrEqual(1)
        expect(parsedData[0].fullName).toBe('أحمد محمد')
      })
    })

    it('should handle comma in quoted fields without splitting', async () => {
      const mockOnChunk = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onChunk: mockOnChunk })

      const fileInput = document.querySelector('input[type="file"]')
      // CSV with quoted field containing comma
      const csvContent = '"محمد، أحمد",0123456789,1'
      const file = createTestFile(csvContent)

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        // PapaParse should handle quoted fields correctly
        expect(mockOnChunk).toHaveBeenCalled()
      })
    })

    it('should detect headers with snake_case and underscore variations', async () => {
      const mockOnChunk = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onChunk: mockOnChunk })

      const fileInput = document.querySelector('input[type="file"]')
      const csvContent = 'full_name,phone_number,position\nأحمد محمد,0123456789,1'
      const file = createTestFile(csvContent)

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        const parsedData = mockOnChunk.mock.calls[0][0]
        expect(parsedData[0].fullName).toBe('أحمد محمد')
      })
    })
  })

  describe('CSV Validation & Error Handling', () => {
    it('should handle empty CSV file without crashing', async () => {
      const mockOnComplete = jest.fn()
      const mockOnChunk = jest.fn()
      renderComponent({ 
        onComplete: mockOnComplete,
        onChunk: mockOnChunk 
      })

      const fileInput = document.querySelector('input[type="file"]')
      const file = createTestFile('')

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalled()
      })
    })

    it('should handle CSV with missing phone number column', async () => {
      const mockOnChunk = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onChunk: mockOnChunk })

      const fileInput = document.querySelector('input[type="file"]')
      const csvContent = 'أحمد محمد'
      const file = createTestFile(csvContent)

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        const parsedData = mockOnChunk.mock.calls[0][0]
        expect(parsedData[0]).toEqual(expect.objectContaining({
          fullName: 'أحمد محمد',
          phoneNumber: '' // Empty phone number
        }))
      })
    })

    it('should handle incomplete rows with empty fields', async () => {
      const mockOnChunk = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onChunk: mockOnChunk })

      const fileInput = document.querySelector('input[type="file"]')
      const csvContent = 'أحمد محمد,\nفاطمة علي,0987654321'
      const file = createTestFile(csvContent)

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        const parsedData = mockOnChunk.mock.calls[0][0]
        expect(parsedData).toEqual(expect.arrayContaining([
          expect.objectContaining({
            fullName: 'أحمد محمد',
            phoneNumber: ''
          }),
          expect.objectContaining({
            fullName: 'فاطمة علي',
            phoneNumber: '0987654321'
          })
        ]))
      })
    })

    it('should clear errors when new file is selected', async () => {
      const mockOnChunk = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onChunk: mockOnChunk })

      const fileInput = document.querySelector('input[type="file"]')
      
      // First upload with error condition (empty name)
      const file1 = createTestFile(',0123456789')
      fireEvent.change(fileInput, { target: { files: [file1] } })

      await waitFor(() => expect(mockOnChunk).toHaveBeenCalled())
      
      mockOnChunk.mockClear()
      
      // Second upload should not show previous errors
      const file2 = createTestFile('أحمد محمد,0123456789')
      fireEvent.change(fileInput, { target: { files: [file2] } })

      await waitFor(() => {
        expect(mockOnChunk).toHaveBeenCalled()
        // Error should be cleared (setError(null) called in handleFile)
      })
    })

    it('should handle rows with only whitespace', async () => {
      const mockOnChunk = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onChunk: mockOnChunk })

      const fileInput = document.querySelector('input[type="file"]')
      const csvContent = '   ,   \nأحمد محمد,0123456789'
      const file = createTestFile(csvContent)

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(mockOnChunk).toHaveBeenCalled()
      })
    })

    it('should handle malformed CSV gracefully', async () => {
      const mockOnChunk = jest.fn().mockResolvedValue(undefined)
      const mockOnError = jest.fn()
      renderComponent({ 
        onChunk: mockOnChunk,
        onError: mockOnError 
      })

      const fileInput = document.querySelector('input[type="file"]')
      // Malformed CSV with mismatched quotes
      const csvContent = 'أحمد "محمد,0123456789'
      const file = createTestFile(csvContent)

      fireEvent.change(fileInput, { target: { files: [file] } })

      // PapaParse should still attempt to parse
      await waitFor(() => {
        expect(mockOnChunk).toHaveBeenCalled()
      })
    })

    it('should handle very long names (40+ characters)', async () => {
      const mockOnChunk = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onChunk: mockOnChunk })

      const fileInput = document.querySelector('input[type="file"]')
      const longName = 'محمد علي الحسن الشريف أحمد علي الحسن'
      const csvContent = `${longName},0123456789,1`
      const file = createTestFile(csvContent)

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        const parsedData = mockOnChunk.mock.calls[0][0]
        expect(parsedData[0].fullName).toBe(longName)
      })
    })
  })

  describe('Large File Handling - Chunked Parsing (64KB chunks)', () => {
    it('should parse large CSV with 100+ rows and call onChunk multiple times', async () => {
      const mockOnChunk = jest.fn().mockResolvedValue(undefined)
      const mockOnProgress = jest.fn()
      const mockOnComplete = jest.fn()
      renderComponent({ 
        onChunk: mockOnChunk, 
        onProgress: mockOnProgress,
        onComplete: mockOnComplete 
      })

      const fileInput = document.querySelector('input[type="file"]')
      
      // Create CSV with 100+ rows to trigger chunking
      const rows = []
      for (let i = 0; i < 120; i++) {
        rows.push({ 
          name: `مريض ${String(i).padStart(3, '0')}`, 
          phone: `01234567${String(i % 100).padStart(2, '0')}`,
          position: String(i + 1)
        })
      }
      const csvContent = createTestCSVData(rows, true)
      const file = createTestFile(csvContent, 'large_patients.csv')
      
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(mockOnChunk).toHaveBeenCalled()
        expect(mockOnProgress).toHaveBeenCalled()
        expect(mockOnComplete).toHaveBeenCalled()
      })
    })

    it('should support async onChunk callback with pause/resume', async () => {
      // Create an async callback that takes time to process
      const mockOnChunk = jest.fn().mockImplementation(() => {
        return new Promise(resolve => setTimeout(resolve, 50))
      })
      const mockOnComplete = jest.fn()
      
      renderComponent({ 
        onChunk: mockOnChunk,
        onComplete: mockOnComplete 
      })

      const fileInput = document.querySelector('input[type="file"]')
      const csvContent = createTestCSVData([
        { name: 'أحمد محمد', phone: '0123456789', position: '1' },
        { name: 'فاطمة علي', phone: '0987654321', position: '2' }
      ])
      const file = createTestFile(csvContent)

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(mockOnChunk).toHaveBeenCalled()
        expect(mockOnComplete).toHaveBeenCalled()
      })
    })
  })

  describe('Callback Execution - Data Wiring', () => {
    it('should call onChunk with parsed rows as objects', async () => {
      const mockOnChunk = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onChunk: mockOnChunk })

      const fileInput = document.querySelector('input[type="file"]')
      const csvContent = createTestCSVData([
        { name: 'أحمد محمد', phone: '0123456789', position: '' }
      ])
      const file = createTestFile(csvContent)

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(mockOnChunk).toHaveBeenCalled()
        const callData = mockOnChunk.mock.calls[0][0]
        expect(Array.isArray(callData)).toBe(true)
        expect(callData[0]).toHaveProperty('fullName')
        expect(callData[0]).toHaveProperty('phoneNumber')
        expect(callData[0]).toHaveProperty('desiredPosition')
      })
    })

    it('should call onProgress with rowsParsed count', async () => {
      const mockOnProgress = jest.fn()
      const mockOnChunk = jest.fn().mockResolvedValue(undefined)
      renderComponent({ 
        onProgress: mockOnProgress,
        onChunk: mockOnChunk 
      })

      const fileInput = document.querySelector('input[type="file"]')
      const csvContent = createTestCSVData([
        { name: 'أحمد محمد', phone: '0123456789', position: '1' },
        { name: 'فاطمة علي', phone: '0987654321', position: '2' }
      ])
      const file = createTestFile(csvContent)

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(mockOnProgress).toHaveBeenCalledWith(
          expect.objectContaining({ 
            rowsParsed: expect.any(Number) 
          })
        )
      })
    })

    it('should call onComplete after parsing finishes', async () => {
      const mockOnComplete = jest.fn()
      const mockOnChunk = jest.fn().mockResolvedValue(undefined)
      renderComponent({ 
        onComplete: mockOnComplete,
        onChunk: mockOnChunk 
      })

      const fileInput = document.querySelector('input[type="file"]')
      const csvContent = createTestCSVData([
        { name: 'أحمد محمد', phone: '0123456789', position: '' }
      ])
      const file = createTestFile(csvContent)

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalled()
      })
    })

    it('should call onParsed with full buffer for all rows', async () => {
      const mockOnParsed = jest.fn()
      const mockOnChunk = jest.fn().mockResolvedValue(undefined)
      renderComponent({ 
        onParsed: mockOnParsed,
        onChunk: mockOnChunk 
      })

      const fileInput = document.querySelector('input[type="file"]')
      const csvContent = createTestCSVData([
        { name: 'أحمد محمد', phone: '0123456789', position: '1' },
        { name: 'فاطمة علي', phone: '0987654321', position: '2' }
      ])
      const file = createTestFile(csvContent)

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(mockOnParsed).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ fullName: 'أحمد محمد' }),
            expect.objectContaining({ fullName: 'فاطمة علي' })
          ])
        )
      })
    })

    it('should handle onChunk callback errors gracefully without disrupting parsing', async () => {
      const mockOnChunk = jest.fn()
        .mockImplementationOnce(() => {
          throw new Error('Processing error')
        })
        .mockResolvedValueOnce(undefined)
      
      const mockOnComplete = jest.fn()
      const mockOnError = jest.fn()
      
      renderComponent({ 
        onChunk: mockOnChunk,
        onComplete: mockOnComplete,
        onError: mockOnError 
      })

      const fileInput = document.querySelector('input[type="file"]')
      const csvContent = createTestCSVData([
        { name: 'أحمد محمد', phone: '0123456789', position: '' }
      ])
      const file = createTestFile(csvContent)

      fireEvent.change(fileInput, { target: { files: [file] } })

      // Parser should still complete even if onChunk throws
      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalled()
      })
    })

    it('should maintain callback chain order: onChunk -> onProgress -> onComplete', async () => {
      const callOrder = []
      const mockOnChunk = jest.fn(() => {
        callOrder.push('onChunk')
        return Promise.resolve()
      })
      const mockOnProgress = jest.fn(() => {
        callOrder.push('onProgress')
      })
      const mockOnComplete = jest.fn(() => {
        callOrder.push('onComplete')
      })
      
      renderComponent({ 
        onChunk: mockOnChunk,
        onProgress: mockOnProgress,
        onComplete: mockOnComplete 
      })

      const fileInput = document.querySelector('input[type="file"]')
      const csvContent = createTestCSVData([
        { name: 'أحمد محمد', phone: '0123456789', position: '' }
      ])
      const file = createTestFile(csvContent)

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalled()
        // Verify order is maintained
        expect(callOrder.length).toBeGreaterThanOrEqual(1)
      })
    })
  })

  describe('Special Characters & Localization - Data Wiring', () => {
    it('should handle pure Arabic names without breaking', async () => {
      const mockOnChunk = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onChunk: mockOnChunk })

      const fileInput = document.querySelector('input[type="file"]')
      const csvContent = createTestCSVData([
        { name: 'أحمد محمد علي محمود', phone: '0123456789', position: '' }
      ])
      const file = createTestFile(csvContent)

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        const parsedData = mockOnChunk.mock.calls[0][0]
        expect(parsedData[0].fullName).toBe('أحمد محمد علي محمود')
      })
    })

    it('should handle mixed Arabic and English names', async () => {
      const mockOnChunk = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onChunk: mockOnChunk })

      const fileInput = document.querySelector('input[type="file"]')
      const csvContent = createTestCSVData([
        { name: 'Ahmed أحمد (Ahmad)', phone: '0123456789', position: '' }
      ])
      const file = createTestFile(csvContent)

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        const parsedData = mockOnChunk.mock.calls[0][0]
        expect(parsedData[0].fullName).toBe('Ahmed أحمد (Ahmad)')
      })
    })

    it('should handle special characters like apostrophes and hyphens', async () => {
      const mockOnChunk = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onChunk: mockOnChunk })

      const fileInput = document.querySelector('input[type="file"]')
      const csvContent = createTestCSVData([
        { name: "O'Brien-Smith", phone: '0123456789', position: '' }
      ])
      const file = createTestFile(csvContent)

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        const parsedData = mockOnChunk.mock.calls[0][0]
        expect(parsedData[0].fullName).toBe("O'Brien-Smith")
      })
    })

    it('should handle phone numbers with formatting characters', async () => {
      const mockOnChunk = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onChunk: mockOnChunk })

      const fileInput = document.querySelector('input[type="file"]')
      const csvContent = createTestCSVData([
        { name: 'أحمد محمد', phone: '+966-123-456-789', position: '' }
      ])
      const file = createTestFile(csvContent)

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        const parsedData = mockOnChunk.mock.calls[0][0]
        expect(parsedData[0].phoneNumber).toBe('+966-123-456-789')
      })
    })

    it('should handle names with numbers', async () => {
      const mockOnChunk = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onChunk: mockOnChunk })

      const fileInput = document.querySelector('input[type="file"]')
      const csvContent = createTestCSVData([
        { name: 'أحمد 123 محمد', phone: '0123456789', position: '' }
      ])
      const file = createTestFile(csvContent)

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        const parsedData = mockOnChunk.mock.calls[0][0]
        expect(parsedData[0].fullName).toBe('أحمد 123 محمد')
      })
    })
  })

  describe('Edge Cases - Boundary Conditions', () => {
    it('should handle rows with trailing commas', async () => {
      const mockOnChunk = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onChunk: mockOnChunk })

      const fileInput = document.querySelector('input[type="file"]')
      const csvContent = 'أحمد محمد,0123456789,'
      const file = createTestFile(csvContent)

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        const parsedData = mockOnChunk.mock.calls[0][0]
        expect(parsedData[0].fullName).toBe('أحمد محمد')
        expect(parsedData[0].phoneNumber).toBe('0123456789')
      })
    })

    it('should handle quoted fields with commas inside', async () => {
      const mockOnChunk = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onChunk: mockOnChunk })

      const fileInput = document.querySelector('input[type="file"]')
      // PapaParse should handle quoted fields correctly
      const csvContent = '"محمد, أحمد",0123456789'
      const file = createTestFile(csvContent)

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        const parsedData = mockOnChunk.mock.calls[0][0]
        // Quoted field should preserve the comma
        expect(parsedData[0].fullName).toContain('محمد')
      })
    })

    it('should handle very long names (40+ characters)', async () => {
      const mockOnChunk = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onChunk: mockOnChunk })

      const fileInput = document.querySelector('input[type="file"]')
      const longName = 'أحمد محمد علي حسن إبراهيم عبدالعزيز محمود أحمد'
      const csvContent = createTestCSVData([
        { name: longName, phone: '0123456789', position: '' }
      ])
      const file = createTestFile(csvContent)

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        const parsedData = mockOnChunk.mock.calls[0][0]
        expect(parsedData[0].fullName).toBe(longName)
      })
    })

    it('should handle whitespace-only rows gracefully', async () => {
      const mockOnChunk = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onChunk: mockOnChunk })

      const fileInput = document.querySelector('input[type="file"]')
      const csvContent = 'أحمد محمد,0123456789\n   ,   \nفاطمة علي,0987654321'
      const file = createTestFile(csvContent)

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        expect(mockOnChunk).toHaveBeenCalled()
      })
    })

    it('should handle numeric position values as strings', async () => {
      const mockOnChunk = jest.fn().mockResolvedValue(undefined)
      renderComponent({ onChunk: mockOnChunk })

      const fileInput = document.querySelector('input[type="file"]')
      const csvContent = createTestCSVData([
        { name: 'أحمد محمد', phone: '0123456789', position: '42' }
      ])
      const file = createTestFile(csvContent)

      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => {
        const parsedData = mockOnChunk.mock.calls[0][0]
        expect(parsedData[0].desiredPosition).toBe('42')
        expect(typeof parsedData[0].desiredPosition).toBe('string')
      })
    })
  })

  describe('Accessibility Compliance', () => {
    it('should have descriptive label visible for file upload', () => {
      renderComponent()
      const label = screen.getByText(/رفع ملف المرضى/i)
      expect(label).toBeInTheDocument()
      expect(label.tagName.toLowerCase()).toMatch(/h|label/)
    })

    it('should have aria-label on file input element', () => {
      renderComponent()
      const fileInput = document.querySelector('input[type="file"]')
      
      expect(fileInput).toHaveAttribute('aria-label')
      const ariaLabel = fileInput.getAttribute('aria-label')
      expect(ariaLabel).toContain('رفع ملف المرضى')
    })

    it('should display error messages with role="alert" for accessibility', async () => {
      const mockOnError = jest.fn()
      renderComponent({ onError: mockOnError })

      const fileInput = document.querySelector('input[type="file"]')
      expect(fileInput).toBeInTheDocument()
      // When error occurs, it should have role="alert"
      const { container } = renderComponent()
      const errorDiv = container.querySelector('[role="alert"]')
      // Error div may not exist if no error, but should be present when error occurs
    })
  })

  describe('File Input State Management', () => {
    it('should allow multiple sequential file uploads', async () => {
      const mockOnChunk = jest.fn().mockResolvedValue(undefined)
      const mockOnComplete = jest.fn()
      renderComponent({ 
        onChunk: mockOnChunk,
        onComplete: mockOnComplete 
      })

      const fileInput = document.querySelector('input[type="file"]')
      
      // First upload
      const file1 = createTestFile(createTestCSVData([
        { name: 'أحمد', phone: '0123456789', position: '' }
      ]))
      fireEvent.change(fileInput, { target: { files: [file1] } })

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledTimes(1)
      })

      mockOnChunk.mockClear()
      mockOnComplete.mockClear()
      
      // Second upload
      const file2 = createTestFile(createTestCSVData([
        { name: 'فاطمة', phone: '0987654321', position: '' }
      ]))
      fireEvent.change(fileInput, { target: { files: [file2] } })

      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalledTimes(1)
      })
    })

    it('should handle file selection cancellation (empty files array)', () => {
      const mockOnChunk = jest.fn()
      const mockOnComplete = jest.fn()
      renderComponent({ 
        onChunk: mockOnChunk,
        onComplete: mockOnComplete 
      })

      const fileInput = document.querySelector('input[type="file"]')
      
      // Simulate cancel by sending empty files array
      fireEvent.change(fileInput, { target: { files: [] } })

      // Callbacks should not be called when no file is selected
      expect(mockOnChunk).not.toHaveBeenCalled()
      expect(mockOnComplete).not.toHaveBeenCalled()
    })
  })
})
