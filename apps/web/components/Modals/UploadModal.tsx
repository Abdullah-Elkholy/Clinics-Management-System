'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import Modal from './Modal';
import { useState } from 'react';

interface FileError {
  type: string;
  message: string;
}

export default function UploadModal() {
  const { openModals, closeModal } = useModal();
  const { addToast } = useUI();
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileError, setFileError] = useState<FileError | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const isOpen = openModals.has('upload');

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
  const ALLOWED_TYPES = ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'];
  const ALLOWED_EXTENSIONS = ['xls', 'xlsx', 'csv'];

  // Sample data for the Excel file
  const SAMPLE_DATA = [
    ['الترتيب', 'الاسم الكامل', 'كود الدولة', 'رقم الهاتف'],
    [1, 'أحمد محمد علي', '+20', '01012345678'],
    [2, 'فاطمة محمود السيد', '+20', '01087654321'],
    [3, 'محمود حسن أحمد', '+20', '01098765432'],
    [4, 'نور الدين إبراهيم', '+966', '0501234567'],
    [5, 'سارة علي محمد', '+971', '0501234567'],
  ];

  const validateFile = (file: File): FileError | null => {
    // Check file type
    if (!ALLOWED_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext))) {
      return {
        type: 'type',
        message: 'نوع الملف غير مدعوم. يرجى استخدام ملفات Excel أو CSV فقط',
      };
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        type: 'size',
        message: `حجم الملف كبير جداً. الحد الأقصى ${MAX_FILE_SIZE / (1024 * 1024)} MB`,
      };
    }

    return null;
  };

  const downloadSampleExcel = async () => {
    try {
      // Import xlsx library dynamically
      const XLSX = await import('xlsx');
      
      // Create a workbook with formatting
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.aoa_to_sheet(SAMPLE_DATA);
      
      // Set column widths
      worksheet['!cols'] = [
        { wch: 12 }, // الترتيب
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
      for (let i = 0; i < SAMPLE_DATA[0].length; i++) {
        const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
        if (worksheet[cellRef]) {
          worksheet[cellRef].s = headerStyle;
        }
      }
      
      // Style data rows with alternating colors
      for (let i = 1; i < SAMPLE_DATA.length; i++) {
        for (let j = 0; j < SAMPLE_DATA[i].length; j++) {
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
      for (let i = 0; i < SAMPLE_DATA[0].length; i++) {
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
      console.error('Error downloading sample:', error);
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
        addToast(error.message, 'error');
      } else {
        setFile(selectedFile);
        setFileName(selectedFile.name);
        setFileError(null);
        addToast(`تم اختيار الملف: ${selectedFile.name}`, 'info');
      }
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      const selectedFile = droppedFiles[0];
      const error = validateFile(selectedFile);
      
      if (error) {
        setFileError(error);
        setFile(null);
        setFileName('');
        addToast(error.message, 'error');
      } else {
        setFile(selectedFile);
        setFileName(selectedFile.name);
        setFileError(null);
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

    try {
      setIsProcessing(true);
      addToast('جاري معالجة الملف...', 'info');

      // Simulate processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      addToast('تم رفع الملف بنجاح - تم إضافة 3 مرضى', 'success');
      setFile(null);
      setFileName('');
      setFileError(null);
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
      }}
      title="رفع ملف المرضى"
      size="xl"
    >
      <div className="space-y-4">
        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-all ${
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
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
            disabled={isProcessing}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => document.getElementById('excelFile')?.click()}
            disabled={isProcessing}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {file ? 'اختيار ملف آخر' : 'اختيار ملف Excel'}
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-800 mb-3 flex items-center gap-2">
            <i className="fas fa-info-circle"></i>
            متطلبات الملف:
          </h4>
          <div className="text-sm text-blue-700 space-y-2">
            <p className="flex items-center gap-2">
              <i className="fas fa-check-circle text-green-500 flex-shrink-0"></i>
              <span>الصيغ المدعومة: Excel (.xlsx, .xls) أو CSV</span>
            </p>
            <p className="flex items-center gap-2">
              <i className="fas fa-check-circle text-green-500 flex-shrink-0"></i>
              <span>الحد الأقصى لحجم الملف: {MAX_FILE_SIZE / (1024 * 1024)} MB</span>
            </p>
            <p className="flex items-center gap-2">
              <i className="fas fa-check-circle text-green-500 flex-shrink-0"></i>
              <span>العمود الأول: الترتيب (اختياري)</span>
            </p>
            <p className="flex items-center gap-2">
              <i className="fas fa-check-circle text-green-500 flex-shrink-0"></i>
              <span>العمود الثاني: الاسم الكامل (مطلوب)</span>
            </p>
            <p className="flex items-center gap-2">
              <i className="fas fa-check-circle text-green-500 flex-shrink-0"></i>
              <span>العمود الثالث: كود الدولة مثل +20 (اختياري - الافتراضي +20)</span>
            </p>
            <p className="flex items-center gap-2">
              <i className="fas fa-check-circle text-green-500 flex-shrink-0"></i>
              <span>العمود الرابع: رقم الهاتف (مطلوب)</span>
            </p>
          </div>

          {/* Download Sample Button */}
          <button
            onClick={downloadSampleExcel}
            className="mt-4 w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            <i className="fas fa-download"></i>
            تحميل نموذج Excel
          </button>
        </div>

        {/* Sample Data Preview */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="w-full flex items-center justify-between font-medium text-purple-800 hover:text-purple-900"
          >
            <span className="flex items-center gap-2">
              <i className="fas fa-table"></i>
              عرض أمثلة البيانات
            </span>
            <i className={`fas fa-chevron-${showPreview ? 'down' : 'up'}`}></i>
          </button>

          {showPreview && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-purple-100 border-b-2 border-purple-300">
                    {SAMPLE_DATA[0].map((header, idx) => (
                      <th key={idx} className="px-3 py-2 text-right text-purple-800 font-semibold">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE_DATA.slice(1).map((row, rowIdx) => (
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
          )}

          {/* Data Column Description */}
          <div className="mt-3 text-xs text-purple-700 space-y-2 border-t border-purple-200 pt-3">
            <div className="flex gap-2">
              <span className="font-semibold flex-shrink-0">مثال:</span>
              <span>الترتيب: 1, 2, 3... أو اتركها فارغة (سيتم ترقيمها تلقائياً)</span>
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
        </div>

        {file && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="font-medium text-gray-800 mb-2 text-sm">معلومات الملف:</h4>
            <div className="text-xs text-gray-600 space-y-1">
              <p><span className="font-semibold">الاسم:</span> {fileName}</p>
              <p><span className="font-semibold">الحجم:</span> {(file.size / 1024).toFixed(2)} KB</p>
              <p><span className="font-semibold">النوع:</span> {file.type || 'غير محدد'}</p>
            </div>
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
