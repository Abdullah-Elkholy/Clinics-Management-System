'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import Modal from './Modal';

export default function RetryPreviewModal() {
  const { openModals, closeModal } = useModal();
  const { addToast } = useUI();

  const isOpen = openModals.has('retryPreview');

  const handleConfirmRetry = () => {
    addToast('تم إعادة محاولة 3 رسائل بنجاح', 'success');
    closeModal('retryPreview');
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => closeModal('retryPreview')}
      title="معاينة إعادة المحاولة"
      size="2xl"
    >
      <div className="flex flex-col h-full space-y-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-yellow-800">المهام الفاشلة المحددة لإعادة المحاولة</h4>
              <p className="text-sm text-yellow-600">3 مهمة محددة</p>
            </div>
            <i className="fas fa-redo text-2xl text-yellow-600"></i>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col flex-1">
          <div className="px-4 py-3 bg-gray-50 border-b flex-shrink-0">
            <h4 className="font-bold text-gray-800">جدول المعاينة</h4>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">الاسم</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">الهاتف</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">سبب الفشل</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">الحالة المتوقعة</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[1, 2, 3].map((i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2">أحمد محمد</td>
                    <td className="px-4 py-2">+2010000000{i}</td>
                    <td className="px-4 py-2 text-red-600">خطأ في الشبكة</td>
                    <td className="px-4 py-2">
                      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                        متوقع النجاح
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t flex-shrink-0">
          <button
            onClick={handleConfirmRetry}
            className="flex-1 bg-yellow-600 text-white py-2 rounded-lg hover:bg-yellow-700 transition-colors flex items-center justify-center gap-2"
          >
            <i className="fas fa-redo"></i>
            تأكيد إعادة المحاولة
          </button>
          <button
            onClick={() => closeModal('retryPreview')}
            className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition-colors"
          >
            إلغاء
          </button>
        </div>
      </div>
    </Modal>
  );
}
