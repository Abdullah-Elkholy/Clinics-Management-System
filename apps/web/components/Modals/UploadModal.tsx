'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import Modal from './Modal';
import { useState } from 'react';

export default function UploadModal() {
  const { openModals, closeModal } = useModal();
  const { addToast } = useUI();
  const [fileName, setFileName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const isOpen = openModals.has('upload');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      addToast(`تم اختيار الملف: ${file.name}`, 'info');
    }
  };

  const handleUpload = async () => {
    if (!fileName) {
      addToast('يرجى اختيار ملف Excel', 'error');
      return;
    }

    setIsProcessing(true);
    addToast('جاري معالجة الملف...', 'info');

    // Simulate processing
    setTimeout(() => {
      addToast('تم رفع الملف بنجاح - تم إضافة 3 مرضى', 'success');
      setFileName('');
      setIsProcessing(false);
      closeModal('upload');
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => closeModal('upload')}
      title="رفع ملف المرضى"
      size="xl"
    >
      <div className="space-y-4">
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <i className="fas fa-cloud-upload-alt text-4xl text-gray-400 mb-4 block"></i>
          <p className="text-gray-600 mb-2">اسحب الملف هنا أو انقر للاختيار</p>
          <input
            type="file"
            id="excelFile"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => document.getElementById('excelFile')?.click()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            اختيار ملف Excel
          </button>
          {fileName && (
            <p className="text-sm text-green-600 mt-2">
              <i className="fas fa-check-circle ml-1"></i>
              تم اختيار: {fileName}
            </p>
          )}
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-medium text-yellow-800 mb-2">نموذج الملف المطلوب:</h4>
          <div className="text-sm text-yellow-700 space-y-1">
            <p>العمود الأول: الترتيب</p>
            <p>العمود الثاني: الاسم الكامل</p>
            <p>العمود الثالث: رقم الهاتف</p>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <button
            type="button"
            onClick={handleUpload}
            disabled={isProcessing}
            className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
          >
            {isProcessing ? 'جاري الرفع...' : 'رفع ومعالجة'}
          </button>
          <button
            type="button"
            onClick={() => closeModal('upload')}
            className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition-colors"
          >
            إلغاء
          </button>
        </div>
      </div>
    </Modal>
  );
}
