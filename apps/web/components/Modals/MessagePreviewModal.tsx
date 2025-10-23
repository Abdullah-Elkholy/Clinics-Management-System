'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import Modal from './Modal';

export default function MessagePreviewModal() {
  const { openModals, closeModal } = useModal();
  const { addToast } = useUI();

  const isOpen = openModals.has('messagePreview');

  const handleConfirmSend = () => {
    addToast('تم إرسال 5 رسائل بنجاح', 'success');
    closeModal('messagePreview');
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => closeModal('messagePreview')}
      title="معاينة الرسائل قبل الإرسال"
      size="2xl"
    >
      <div className="flex flex-col h-full space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-blue-800">الرسالة المحددة</h4>
              <p className="text-sm text-blue-600">مرحباً، موعدك اليوم في العيادة</p>
            </div>
            <div className="text-blue-600">
              <span className="text-2xl font-bold">5</span>
              <p className="text-sm">مريض محدد</p>
            </div>
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
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">الترتيب</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">الاسم</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">الهاتف</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">الرسالة</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[1, 2, 3, 4, 5].map((i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2">{i}</td>
                    <td className="px-4 py-2">أحمد محمد</td>
                    <td className="px-4 py-2">+2010000000{i}</td>
                    <td className="px-4 py-2 text-gray-600">مرحباً أحمد، ترتيبك {i}...</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t flex-shrink-0">
          <button
            onClick={handleConfirmSend}
            className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
          >
            <i className="fab fa-whatsapp"></i>
            تأكيد الإرسال
          </button>
          <button
            onClick={() => closeModal('messagePreview')}
            className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition-colors"
          >
            إلغاء
          </button>
        </div>
      </div>
    </Modal>
  );
}
