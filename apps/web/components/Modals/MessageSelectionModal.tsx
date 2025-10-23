'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { useQueue } from '@/contexts/QueueContext';
import Modal from './Modal';

export default function MessageSelectionModal() {
  const { openModals, closeModal } = useModal();
  const { addToast } = useUI();
  const { messageTemplates, selectedMessageTemplateId, setSelectedMessageTemplateId } = useQueue();

  const isOpen = openModals.has('messageSelection');
  const selectedTemplate = messageTemplates.find(t => t.id === selectedMessageTemplateId);

  const handleApply = () => {
    if (!selectedMessageTemplateId) {
      addToast('يرجى اختيار رسالة', 'error');
      return;
    }
    addToast('تم تحديث الرسالة الافتراضية', 'success');
    closeModal('messageSelection');
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => closeModal('messageSelection')}
      title="اختيار الرسالة الافتراضية"
      size="xl"
    >
      <div className="flex flex-col h-full space-y-4">
        <div className="space-y-3 flex-1 overflow-y-auto pr-2">
          {messageTemplates.map((template) => (
            <div
              key={template.id}
              onClick={() => setSelectedMessageTemplateId(template.id)}
              className={`border rounded-lg p-4 cursor-pointer transition-all ${
                selectedMessageTemplateId === template.id
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-300'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-800">{template.title}</h4>
                  <p className="text-sm text-gray-600 mt-1">{template.content}</p>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-1 ${
                    selectedMessageTemplateId === template.id
                      ? 'bg-blue-500 border-blue-500'
                      : 'border-gray-300'
                  }`}
                ></div>
              </div>
            </div>
          ))}
        </div>

        {/* Selected Message Display */}
        {selectedTemplate && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex-shrink-0">
            <h4 className="font-medium text-green-800 mb-2">الرسالة الافتراضية المحددة</h4>
            <p className="text-sm text-green-700">{selectedTemplate.content}</p>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex-shrink-0">
          <h4 className="font-medium text-blue-800 mb-2">نصائح الاستخدام:</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <p>• استخدم المتغيرات مثل {'{PN}'} لإدراج اسم المريض</p>
            <p>• استخدم {'{PQP}'} لموضع المريض و {'{ETR}'} للوقت المتبقي</p>
            <p>• يمكنك إضافة شروط اختيارية أدناه</p>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t flex-shrink-0">
          <button
            onClick={handleApply}
            className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            تطبيق الاختيار
          </button>
          <button
            onClick={() => closeModal('messageSelection')}
            className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition-colors"
          >
            إلغاء
          </button>
        </div>
      </div>
    </Modal>
  );
}
