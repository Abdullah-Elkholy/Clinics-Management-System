'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import Modal from './Modal';
import { useState } from 'react';
import { validateCellValue, validateExcelRow, sanitizeInput, validateCountryCode } from '@/utils/validation';
import { COUNTRY_CODES } from '@/constants';
import CountryCodeSelector from '@/components/Common/CountryCodeSelector';
import CustomCountryCodeInput from '@/components/Common/CustomCountryCodeInput';
import { getEffectiveCountryCode, normalizePhoneNumber } from '@/utils/core.utils';
import { FILE_UPLOAD_CONFIG } from '@/config/app.config';

interface FileError {
  type: string;
  message: string;
}

interface PreviewData {
  data: (string | number)[][];
  fileName: string;
}

export default function UploadModal() {
  const { openModals, closeModal } = useModal();
  const { addToast } = useUI();
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileError, setFileError] = useState<FileError | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showRequirements, setShowRequirements] = useState(false);
  const [showFileInfo, setShowFileInfo] = useState(false);
  const [editablePreview, setEditablePreview] = useState<(string | number)[][] | null>(null);
  const [selectedCountryCode, setSelectedCountryCode] = useState('+20');
  const [customCountryCode, setCustomCountryCode] = useState('');
  const [cellErrors, setCellErrors] = useState<{[key: string]: string}>({});
  const [rowCustomCountries, setRowCustomCountries] = useState<{[key: string]: string}>({});

  const isOpen = openModals.has('upload');

  const validateFile = (file: File): FileError | null => {
    // Check file type
    const fileType = file.type as any;
    if (!FILE_UPLOAD_CONFIG.ALLOWED_TYPES.includes(fileType) && !FILE_UPLOAD_CONFIG.ALLOWED_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext))) {
      return {
        type: 'type',
        message: 'نوع الملف غير مدعوم. يرجى استخدام ملفات Excel أو CSV فقط',
      };
    }

    // Check file size
    if (file.size > FILE_UPLOAD_CONFIG.MAX_FILE_SIZE) {
      return {
        type: 'size',
        message: `حجم الملف كبير جداً. الحد الأقصى ${FILE_UPLOAD_CONFIG.MAX_FILE_SIZE / (1024 * 1024)} MB`,
      };
    }

    return null;
  };

  const parseExcelPreview = async (file: File) => {
    try {
      const XLSX = await import('xlsx');
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as (string | number)[][];
      
      if (data.length < 2) {
        addToast('الملف يجب أن يحتوي على رأس أعمدة وبيانات', 'error');
        return;
      }
      
      // Get headers from first row
      const headers = data[0].map(h => h?.toString() || '');
      const phoneColIdx = headers.findIndex(h => h.includes('هاتف') || h.toLowerCase().includes('phone'));
      const countryColIdx = headers.findIndex(h => h.includes('كود') || h.toLowerCase().includes('country'));
      
      // Process data: normalize phone numbers and validate
      const processedData = data.map((row, rowIdx) => {
        if (rowIdx === 0) return row; // Skip header
        
        const processedRow = [...row];
        const effectiveCountryCode = getEffectiveCountryCode(selectedCountryCode, customCountryCode);
        
        // Normalize phone numbers
        if (phoneColIdx >= 0 && processedRow[phoneColIdx]) {
          const countryCode = countryColIdx >= 0 ? processedRow[countryColIdx]?.toString() : effectiveCountryCode;
          processedRow[phoneColIdx] = normalizePhoneNumber(processedRow[phoneColIdx]?.toString() || '', countryCode || effectiveCountryCode);
        }
        
        return processedRow;
      });
      
      // Validate data rows (skip header)
      let validationWarnings = 0;
      const newCellErrors: {[key: string]: string} = {};
      
      for (let i = 1; i < Math.min(processedData.length, 6); i++) {
        const row = processedData[i];
        
        // Validate phone number format if exists
        if (phoneColIdx >= 0 && row[phoneColIdx]) {
          const phoneRegex = /^\+\d{2,3}\d{8,12}$/;
          if (!phoneRegex.test(row[phoneColIdx]?.toString() || '')) {
            newCellErrors[`${i}-${phoneColIdx}`] = 'صيغة هاتف غير صحيحة';
            validationWarnings++;
          }
        }
        
        // Validate country code if exists
        if (countryColIdx >= 0 && row[countryColIdx]) {
          const countryCodeError = validateCountryCode(row[countryColIdx]?.toString() || '', true);
          if (countryCodeError) {
            newCellErrors[`${i}-${countryColIdx}`] = countryCodeError;
            validationWarnings++;
          }
        }
      }
      
      setCellErrors(newCellErrors);
      
      if (validationWarnings > 0) {
        addToast(`تحذير: ${validationWarnings} خطأ في البيانات (يمكن تصحيحها)`, 'warning');
      }
      
      const previewSlice = processedData.slice(0, 6);
      setPreviewData({
        data: previewSlice,
        fileName: file.name
      });
      setEditablePreview(previewSlice);
    } catch (error) {
      // Swallow console to avoid noisy logs; surface feedback to user
      addToast('حدث خطأ في قراءة الملف', 'error');
    }
  };

  const handleCellEdit = (rowIdx: number, cellIdx: number, value: string) => {
    if (!editablePreview || !previewData) return;
    
    const columnName = previewData.data[0][cellIdx]?.toString() || '';
    let processedValue = sanitizeInput(value);
    const cellKey = `${rowIdx}-${cellIdx}`;
    
    // Special handling for country code columns
    if (columnName === 'كود الدولة' || columnName.toLowerCase().includes('country')) {
      // If "OTHER" is selected, store the custom code in a separate state
      if (value === 'OTHER') {
        // Just set to OTHER marker, actual code will be in rowCustomCountries
        processedValue = 'OTHER';
      } else {
        // It's a regular code, validate it
        const validationError = validateCountryCode(processedValue, true);
        if (validationError) {
          setCellErrors({...cellErrors, [cellKey]: validationError});
          addToast(`خطأ في كود الدولة: ${validationError}`, 'error');
          return;
        }
        // Clear any custom code for this row since they selected a predefined one
        const newCustomCountries = {...rowCustomCountries};
        delete newCustomCountries[`${rowIdx}-${cellIdx}`];
        setRowCustomCountries(newCustomCountries);
      }
    }
    // Special handling for phone numbers
    else if (columnName === 'رقم الهاتف' || columnName.toLowerCase().includes('phone')) {
      // Get country code from the same row
      const countryCodeIdx = previewData.data[0].findIndex(h => 
        h?.toString().includes('كود') || h?.toString().toLowerCase().includes('country')
      );
      let rowCountryCode = countryCodeIdx >= 0 ? editablePreview[rowIdx][countryCodeIdx]?.toString() : selectedCountryCode;
      
      // If it's "OTHER", use the custom code from rowCustomCountries
      if (rowCountryCode === 'OTHER') {
        rowCountryCode = rowCustomCountries[`${rowIdx}-${countryCodeIdx}`] || getEffectiveCountryCode(selectedCountryCode, customCountryCode);
      }
      
      processedValue = normalizePhoneNumber(value, rowCountryCode || getEffectiveCountryCode(selectedCountryCode, customCountryCode));
      
      // Validate phone format
      const phoneRegex = /^\+\d{2,3}\d{8,12}$/;
      if (!phoneRegex.test(processedValue)) {
        setCellErrors({...cellErrors, [cellKey]: 'صيغة الهاتف غير صحيحة'});
        addToast('صيغة الهاتف غير صحيحة. يجب أن تكون: +كود الدولة + الرقم', 'error');
        return;
      }
    }
    
    // Clear error for this cell if validation passed
    const newErrors = {...cellErrors};
    delete newErrors[cellKey];
    setCellErrors(newErrors);
    
    const updated = editablePreview.map((row, rIdx) =>
      rIdx === rowIdx
        ? row.map((cell, cIdx) => (cIdx === cellIdx ? processedValue : cell))
        : row
    );
    setEditablePreview(updated);
  };

  const handleCustomCountryCodeInput = (rowIdx: number, cellIdx: number, customCode: string) => {
    const cellKey = `${rowIdx}-${cellIdx}`;
    const sanitizedCode = sanitizeInput(customCode);
    
    // Validate the custom code format
    const validationError = validateCountryCode(sanitizedCode, true);
    
    if (sanitizedCode && validationError) {
      setCellErrors({...cellErrors, [cellKey]: validationError});
      return;
    }
    
    // Clear error if validation passed
    const newErrors = {...cellErrors};
    delete newErrors[cellKey];
    setCellErrors(newErrors);
    
    // Store the custom code
    setRowCustomCountries({
      ...rowCustomCountries,
      [cellKey]: sanitizedCode
    });
  };

  const addNewRowToPreview = () => {
    if (!editablePreview) return;
    
    // Create new row with same structure as headers
    const newRow = editablePreview[0].map((header, idx) => {
      const headerName = header?.toString() || '';
      // Initialize country code column with selected value
      if (headerName.includes('كود') || headerName.toLowerCase().includes('country')) {
        return getEffectiveCountryCode(selectedCountryCode, customCountryCode);
      }
      return '';
    });
    
    const updated = [...editablePreview, newRow];
    setEditablePreview(updated);
    addToast('تم إضافة صف جديد بنجاح', 'success');
  };

  const downloadSampleExcel = async () => {
    try {
      // Import xlsx library dynamically
      const XLSX = await import('xlsx');
      
      // Create a workbook with formatting
      const workbook = XLSX.utils.book_new();
      const sampleData = FILE_UPLOAD_CONFIG.SAMPLE_DATA.map(row => [...row]) as any[];
      const worksheet = XLSX.utils.aoa_to_sheet(sampleData);
      
      // Set column widths
      worksheet['!cols'] = [
        { wch: 25 }, // الاسم الكامل
        { wch: 15 }, // كود الدولة
        { wch: 18 }, // رقم الهاتف
      ];
      
      // Style header row
      const headerStyle = {
        fill: { fgColor: { rgb: 'FF4472C4' } },
        font: { bold: true, color: { rgb: 'FFFFFFFF' }, size: 12 },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      };
      
      // Apply header styling
      for (let i = 0; i < FILE_UPLOAD_CONFIG.SAMPLE_DATA[0].length; i++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
        if (worksheet[cellRef]) {
          worksheet[cellRef].s = headerStyle;
        }
      }
      
      // Style data rows with alternating colors
      for (let i = 1; i < FILE_UPLOAD_CONFIG.SAMPLE_DATA.length; i++) {
        for (let j = 0; j < FILE_UPLOAD_CONFIG.SAMPLE_DATA[i].length; j++) {
          const cellRef = XLSX.utils.encode_cell({ r: i, c: j });
          if (worksheet[cellRef]) {
            const rowStyle = {
              fill: { fgColor: { rgb: i % 2 === 1 ? 'FFFFFFFF' : 'FFF2F2F2' } },
              font: { size: 11 },
              alignment: { horizontal: 'right', vertical: 'center', wrapText: true },
              border: {
                top: { style: 'thin', color: { rgb: 'FFD3D3D3' } },
                bottom: { style: 'thin', color: { rgb: 'FFD3D3D3' } },
                left: { style: 'thin', color: { rgb: 'FFD3D3D3' } },
                right: { style: 'thin', color: { rgb: 'FFD3D3D3' } },
              },
            };
            worksheet[cellRef].s = rowStyle;
          }
        }
      }
      
      // Add header border
      for (let i = 0; i < FILE_UPLOAD_CONFIG.SAMPLE_DATA[0].length; i++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
        if (worksheet[cellRef]) {
          worksheet[cellRef].s.border = {
            top: { style: 'medium', color: { rgb: 'FF4472C4' } },
            bottom: { style: 'medium', color: { rgb: 'FF4472C4' } },
            left: { style: 'thin', color: { rgb: 'FF4472C4' } },
            right: { style: 'thin', color: { rgb: 'FF4472C4' } },
          };
        }
      }
      
      XLSX.utils.book_append_sheet(workbook, worksheet, 'نموذج المرضى');
      XLSX.writeFile(workbook, 'نموذج_المرضى.xlsx');
      
      addToast('تم تحميل النموذج بنجاح', 'success');
    } catch (error) {
      addToast('حدث خطأ أثناء تحميل النموذج', 'error');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const error = validateFile(selectedFile);
      
      if (error) {
        setFileError(error);
        setFile(null);
        setFileName('');
        setPreviewData(null);
        addToast(error.message, 'error');
      } else {
        setFile(selectedFile);
        setFileName(selectedFile.name);
        setFileError(null);
        parseExcelPreview(selectedFile);
        addToast(`تم اختيار الملف: ${selectedFile.name}`, 'info');
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      const selectedFile = droppedFiles[0];
      const error = validateFile(selectedFile);
      
      if (error) {
        setFileError(error);
        setFile(null);
        setFileName('');
        setPreviewData(null);
        addToast(error.message, 'error');
      } else {
        setFile(selectedFile);
        setFileName(selectedFile.name);
        setFileError(null);
        parseExcelPreview(selectedFile);
        addToast(`تم اختيار الملف: ${selectedFile.name}`, 'info');
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      addToast('يرجى اختيار ملف', 'error');
      return;
    }

    const error = validateFile(file);
    if (error) {
      setFileError(error);
      addToast(error.message, 'error');
      return;
    }

    // Validate that edited preview data is ready
    if (!editablePreview || editablePreview.length < 2) {
      addToast('لا توجد بيانات للرفع', 'error');
      return;
    }

    // Check for any remaining errors
    if (Object.keys(cellErrors).length > 0) {
      addToast('يرجى تصحيح الأخطاء في البيانات قبل الرفع', 'error');
      return;
    }

    // Validate all rows and get country code column index
    const countryCodeIdx = editablePreview[0].findIndex(h => 
      h?.toString().includes('كود') || h?.toString().toLowerCase().includes('country')
    );

    try {
      setIsProcessing(true);
      addToast('جاري معالجة الملف...', 'info');

      // Process data with custom country codes
      const processedData = editablePreview.slice(1).map((row, rowIdx) => {
        const actualRowIdx = rowIdx + 1;
        let countryCode = row[countryCodeIdx]?.toString() || getEffectiveCountryCode(selectedCountryCode, customCountryCode);
        
        // If country code is "OTHER", use the custom code from rowCustomCountries
        if (countryCode === 'OTHER') {
          const cellKey = `${actualRowIdx}-${countryCodeIdx}`;
          countryCode = rowCustomCountries[cellKey] || getEffectiveCountryCode(selectedCountryCode, customCountryCode);
        }
        
        return {
          ...row,
          countryCode
        };
      });

      // Simulate processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      addToast(`تم رفع الملف بنجاح - تم إضافة ${processedData.length} مريض`, 'success');
      
      // Reset all states
      setFile(null);
      setFileName('');
      setFileError(null);
      setPreviewData(null);
      setEditablePreview(null);
      setSelectedCountryCode('+20');
      setCustomCountryCode('');
      setRowCustomCountries({});
      setCellErrors({});
      closeModal('upload');
    } catch (error) {
      addToast('حدث خطأ أثناء رفع الملف', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        closeModal('upload');
        setFile(null);
        setFileName('');
        setFileError(null);
        setPreviewData(null);
        setShowPreview(false);
        setEditablePreview(null);
        setShowFileInfo(false);
        setShowRequirements(false);
        setSelectedCountryCode('+20');
        setCustomCountryCode('');
        setCellErrors({});
        setRowCustomCountries({});
      }}
      title="رفع ملف المرضى"
      size="xl"
    >
      <div className="space-y-4">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${
            isDragging ? 'bg-blue-100 border-blue-400 opacity-60' : ''
          } ${
            fileError
              ? 'border-red-300 bg-red-50'
              : file
              ? 'border-green-300 bg-green-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
        >
          <i
            className={`text-4xl mb-4 block ${
              fileError
                ? 'fas fa-exclamation-circle text-red-400'
                : file
                ? 'fas fa-check-circle text-green-500'
                : 'fas fa-cloud-upload-alt text-gray-400'
            }`}
          ></i>
          <p className={`mb-2 ${fileError ? 'text-red-600' : file ? 'text-green-600' : 'text-gray-600'}`}>
            {fileError
              ? fileError.message
              : file
              ? `تم اختيار: ${fileName}`
              : 'اسحب الملف هنا أو انقر للاختيار'}
          </p>
          <input
            type="file"
            id="excelFile"
            name="excelFile"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
            disabled={isProcessing}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => document.getElementById('excelFile')?.click()}
            disabled={isProcessing}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mx-auto"
          >
            <i className="fas fa-upload"></i>
            {file ? 'رفع ملف آخر' : 'رفع ملف Excel'}
          </button>
        </div>

        {/* File Preview from Uploaded File - moved to top */}
        {previewData && editablePreview && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-green-800 flex items-center gap-2">
                <i className="fas fa-eye"></i>
                معاينة البيانات المرفوعة
              </h4>
              <div className="text-xs text-green-700">
                <span className="font-semibold">{editablePreview.length - 1}</span> صف متوفر للمراجعة
              </div>
            </div>

            {/* Country Code Selector */}
            <div className="bg-white border border-green-200 rounded-lg p-3 space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  <i className="fas fa-globe ml-2"></i>
                  اختر كود الدولة الافتراضي:
                </label>
                <CountryCodeSelector
                  value={selectedCountryCode}
                  onChange={setSelectedCountryCode}
                  size="md"
                  showOptgroups={true}
                />
                <p className="text-xs text-gray-500 mt-1">
                  <i className="fas fa-info-circle ml-1"></i>
                  💡 سيتم تطبيق هذا على أرقام الهاتف الجديدة
                </p>
              </div>

              {/* Custom Country Code Input */}
              {selectedCountryCode === 'OTHER' && (
                <CustomCountryCodeInput
                  value={customCountryCode}
                  onChange={setCustomCountryCode}
                  size="md"
                  placeholder="مثال: +44 (بريطانيا) أو +1 (أمريكا) أو +33 (فرنسا)"
                  showFullInfo={true}
                />
              )}
            </div>

            {/* Data Table */}
            <div className="overflow-x-auto border border-green-200 rounded-lg">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-green-100 border-b-2 border-green-300">
                    {editablePreview[0]?.map((header, idx) => (
                      <th key={idx} className="px-4 py-2 text-right text-green-800 font-semibold whitespace-nowrap">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {editablePreview.slice(1).map((row, rowIdx) => {
                    const actualRowIdx = rowIdx + 1;
                    return (
                      <tr key={rowIdx} className={`border-b ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-green-25 opacity-60'}`}>
                        {row.map((cell, cellIdx) => {
                          const cellKey = `${actualRowIdx}-${cellIdx}`;
                          const headerName = editablePreview[0][cellIdx]?.toString() || '';
                          const hasError = cellErrors[cellKey];
                          const isCountryCol = headerName.includes('كود') || headerName.toLowerCase().includes('country');
                          const isPhoneCol = headerName.includes('هاتف') || headerName.toLowerCase().includes('phone');
                          
                          // Determine if this is a known country code or "OTHER"
                          const isKnownCountry = COUNTRY_CODES.some(c => c.code === cell);
                          const isOtherCountry = cell === 'OTHER' || (!isKnownCountry && cell !== '');
                          
                          return (
                            <td key={cellIdx} className="px-4 py-2 text-right">
                              {isCountryCol ? (
                                <div className="flex flex-col gap-1">
                                  {/* Country Code Selector */}
                                  <CountryCodeSelector
                                    value={isOtherCountry ? 'OTHER' : String(cell)}
                                    onChange={(value) => {
                                      if (value === 'OTHER') {
                                        handleCellEdit(actualRowIdx, cellIdx, 'OTHER');
                                      } else {
                                        handleCellEdit(actualRowIdx, cellIdx, value);
                                        // Clear custom country code when selecting a known country
                                        setRowCustomCountries(prev => {
                                          const updated = { ...prev };
                                          delete updated[cellKey];
                                          return updated;
                                        });
                                      }
                                    }}
                                    size="sm"
                                    hasError={!!hasError}
                                    showOptgroups={true}
                                  />
                                  
                                  {/* Custom Country Code Input - Show for 'OTHER' or unknown codes */}
                                  {isOtherCountry && (
                                    <CustomCountryCodeInput
                                      value={cell === 'OTHER' ? (rowCustomCountries[cellKey] || '') : String(cell)}
                                      onChange={(value) => {
                                        if (cell === 'OTHER') {
                                          handleCustomCountryCodeInput(actualRowIdx, cellIdx, value);
                                        } else {
                                          handleCellEdit(actualRowIdx, cellIdx, value);
                                        }
                                      }}
                                      size="sm"
                                      hasError={!!hasError}
                                      placeholder="مثال: +44 أو +1 أو +33 (ابدأ بـ +)"
                                      showFullInfo={false}
                                    />
                                  )}
                                  
                                  {hasError && (
                                    <div className="text-xs text-red-600">
                                      <i className="fas fa-exclamation-circle ml-1"></i>
                                      {hasError}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                // Text Input
                                <div className="relative">
                                  <input
                                    type="text"
                                    name={`cell-${actualRowIdx}-${cellIdx}`}
                                    value={cell}
                                    onChange={(e) => handleCellEdit(actualRowIdx, cellIdx, e.target.value)}
                                    className={`w-full px-2 py-1 border rounded text-gray-700 focus:outline-none focus:ring-2 text-sm ${
                                      hasError 
                                        ? 'border-red-400 bg-red-50 focus:ring-red-400'
                                        : 'border-green-300 focus:ring-green-400'
                                    }`}
                                    placeholder={isPhoneCol ? '01012345678' : ''}
                                  />
                                  {hasError && (
                                    <div className="absolute -bottom-5 right-0 text-xs text-red-600 whitespace-nowrap">
                                      <i className="fas fa-exclamation-circle ml-1"></i>
                                      {hasError}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Add New Row Button */}
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={addNewRowToPreview}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm"
              >
                <i className="fas fa-plus"></i>
                إضافة صف جديد
              </button>
            </div>

            {Object.keys(cellErrors).length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                <p className="font-semibold flex items-center gap-2">
                  <i className="fas fa-exclamation-triangle"></i>
                  تنبيهات التحقق من البيانات:
                </p>
                <ul className="mt-2 space-y-1 text-xs">
                  {Object.entries(cellErrors).map(([key, error]) => (
                    <li key={key}>
                      <span className="font-semibold">صف {key.split('-')[0]}:</span> {error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* File Info */}
        {file && !previewData && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <button
              onClick={() => setShowFileInfo(!showFileInfo)}
              className="w-full flex items-center justify-between font-medium text-gray-800 hover:text-gray-900"
            >
              <span className="flex items-center gap-2">
                <i className="fas fa-file-alt"></i>
                معلومات الملف:
              </span>
              <i className={`fas fa-chevron-down transition-transform ${showFileInfo ? 'rotate-180' : ''}`}></i>
            </button>

            {showFileInfo && (
              <div className="text-xs text-gray-600 space-y-1 mt-3">
                <p><span className="font-semibold">الاسم:</span> {fileName}</p>
                <p><span className="font-semibold">الحجم:</span> {(file.size / 1024).toFixed(2)} KB</p>
              </div>
            )}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          {!previewData && (
            <button
              onClick={() => setShowRequirements(!showRequirements)}
              className="w-full flex items-center justify-between font-medium text-blue-800 hover:text-blue-900"
            >
              <span className="flex flex-col items-start gap-1">
                <span className="flex items-center gap-2">
                  <i className="fas fa-info-circle"></i>
                  متطلبات الملف:
                </span>
                <span className="text-xs font-normal text-blue-600 opacity-75">مع نموذج كمثال قابل للتحميل</span>
              </span>
              <i className={`fas fa-chevron-down transition-transform ${showRequirements ? 'rotate-180' : ''}`}></i>
            </button>
          )}

          {showRequirements && !previewData && (
            <>
              <div className="text-sm text-blue-700 space-y-2 mt-3">
                <p className="flex items-center gap-2">
                  <i className="fas fa-check-circle text-green-500 flex-shrink-0"></i>
                  <span>الصيغ المدعومة: Excel (.xlsx, .xls) أو CSV</span>
                </p>
                <p className="flex items-center gap-2">
                  <i className="fas fa-check-circle text-green-500 flex-shrink-0"></i>
                  <span>الحد الأقصى لحجم الملف: {FILE_UPLOAD_CONFIG.MAX_FILE_SIZE / (1024 * 1024)} MB</span>
                </p>
                <p className="flex items-center gap-2">
                  <i className="fas fa-check-circle text-green-500 flex-shrink-0"></i>
                  <span>العمود الأول: الاسم الكامل (مطلوب)</span>
                </p>
                <p className="flex items-center gap-2">
                  <i className="fas fa-check-circle text-green-500 flex-shrink-0"></i>
                  <span>العمود الثاني: كود الدولة مثل +20 (اختياري - الافتراضي +20)</span>
                </p>
                <p className="flex items-center gap-2">
                  <i className="fas fa-check-circle text-green-500 flex-shrink-0"></i>
                  <span>العمود الثالث: رقم الهاتف (مطلوب)</span>
                </p>
              </div>

              {/* Download Sample Button */}
              <div className="mt-4 p-3 bg-blue-100 border border-blue-300 rounded-lg">
                <p className="text-xs text-blue-700 mb-2">
                  💡 <span className="font-semibold">نموذج قالب:</span> قم بتحميل الملف أدناه كمثال على الصيغة الصحيحة
                </p>
                <button
                  onClick={downloadSampleExcel}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                >
                  <i className="fas fa-download"></i>
                  تحميل نموذج Excel (مثال)
                </button>
              </div>
            </>
          )}
        </div>

        {/* Sample Data Preview */}
        {!previewData && (
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="w-full flex items-center justify-between font-medium text-purple-800 hover:text-purple-900"
            >
              <span className="flex items-center gap-2">
                <i className="fas fa-table"></i>
                عرض أمثلة البيانات
              </span>
              <i className={`fas fa-chevron-down transition-transform ${showPreview ? 'rotate-180' : ''}`}></i>
            </button>

            {showPreview && (
              <>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-purple-100 border-b-2 border-purple-300">
                        {FILE_UPLOAD_CONFIG.SAMPLE_DATA[0].map((header, idx) => (
                          <th key={idx} className="px-3 py-2 text-right text-purple-800 font-semibold">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {FILE_UPLOAD_CONFIG.SAMPLE_DATA.slice(1).map((row, rowIdx) => (
                        <tr key={rowIdx} className={`border-b ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-purple-25'}`}>
                          {row.map((cell, cellIdx) => (
                            <td key={cellIdx} className="px-3 py-2 text-right text-gray-700">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Data Column Description */}
                <div className="mt-3 text-xs text-purple-700 space-y-2 border-t border-purple-200 pt-3">
                  <div className="flex gap-2">
                    <span className="font-semibold flex-shrink-0">ملاحظة:</span>
                    <span>سيتم تعيين ترتيب الانتظار تلقائياً بناءً على ترتيب الصفوف في الملف</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold flex-shrink-0">مثال:</span>
                    <span>الاسم: أحمد محمد علي، فاطمة محمود السيد</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold flex-shrink-0">مثال:</span>
                    <span>كود الدولة: +20 (مصر)، +966 (السعودية)، +971 (الإمارات)</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="font-semibold flex-shrink-0">مثال:</span>
                    <span>الهاتف: 01012345678 أو 0501234567</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={handleUpload}
            disabled={isProcessing || !file}
            className={`flex-1 py-2 rounded-lg transition-all flex items-center justify-center gap-2 ${
              isProcessing || !file
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isProcessing ? (
              <>
                <i className="fas fa-spinner fa-spin"></i>
                جاري الرفع...
              </>
            ) : (
              <>
                <i className="fas fa-upload"></i>
                رفع ومعالجة
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              closeModal('upload');
              setFile(null);
              setFileName('');
              setFileError(null);
              setPreviewData(null);
              setShowPreview(false);
              setEditablePreview(null);
              setShowFileInfo(false);
              setShowRequirements(false);
            }}
            disabled={isProcessing}
            className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            إلغاء
          </button>
        </div>
      </div>
    </Modal>
  );
}
