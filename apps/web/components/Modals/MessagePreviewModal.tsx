'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import Modal from './Modal';

export default function MessagePreviewModal() {
  const { openModals, closeModal, getModalData } = useModal();
  const { addToast } = useUI();
  const data = getModalData('messagePreview');

  const isOpen = openModals.has('messagePreview');
  const selectedCount = data?.selectedPatientCount ?? 0;
  const selectedPatientIds = data?.selectedPatients ?? [];

  // Sample preview data
  const previewPatients = [
    { id: 1, name: 'أحمد محمد', phone: '+201012345678' },
    { id: 2, name: 'فاطمة علي', phone: '+201087654321' },
    { id: 3, name: 'محمود حسن', phone: '+201098765432' },
    { id: 4, name: 'نور الدين', phone: '+201011223344' },
    { id: 5, name: 'سارة إبراهيم', phone: '+201055667788' },
  ];

  // Full message text
  const fullMessage = 'مرحباً بك {PN}، ترتيبك الحالي هو {PQP}، الموضع الحالي للعيادة هو {CQP}، والوقت المتبقي المقدر للجلسة هو {ETR} دقيقة. شكراً لانتظارك.';

  const handleConfirmSend = () => {
    addToast(`تم إرسال ${selectedCount} رسالة بنجاح`, 'success');
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
              <p className="text-sm text-blue-600 mt-2">{fullMessage}</p>
            </div>
            <div className="text-blue-600 text-left">
              <span className="text-2xl font-bold">{selectedCount}</span>
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
                {previewPatients
                  .filter((p) => selectedPatientIds.includes(p.id))
                  .map((patient, idx) => (
                    <tr key={patient.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">{idx + 1}</td>
                      <td className="px-4 py-2">{patient.name}</td>
                      <td className="px-4 py-2">{patient.phone}</td>
                      <td className="px-4 py-2 text-gray-600 max-w-xs">{fullMessage}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t flex-shrink-0">
          <button
            onClick={handleConfirmSend}
            disabled={selectedCount === 0}
            className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <i className="fab fa-whatsapp"></i>
            إرسال لـ {selectedCount} محدد
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
