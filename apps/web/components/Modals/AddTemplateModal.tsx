'use client';

import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { useQueue } from '@/contexts/QueueContext';
import Modal from './Modal';
import { useState } from 'react';

export default function AddTemplateModal() {
  const { openModals, closeModal } = useModal();
  const { addToast } = useUI();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  const isOpen = openModals.has('addTemplate');

  const insertVariable = (variable: string) => {
    setContent(content + variable);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !content.trim()) {
      addToast('يرجى إدخال عنوان ومحتوى الرسالة', 'error');
      return;
    }

    // TODO: Add template through context
    addToast('تم إضافة قالب الرسالة بنجاح', 'success');
    setTitle('');
    setContent('');
    closeModal('addTemplate');
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => closeModal('addTemplate')}
      title="إضافة قالب رسالة جديد"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            عنوان القالب
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="أدخل عنوان القالب"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            محتوى الرسالة
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            placeholder="أدخل محتوى الرسالة"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <h4 className="font-medium text-blue-800 mb-2">المتغيرات المتاحة:</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <button
              type="button"
              onClick={() => insertVariable('{PN}')}
              className="bg-blue-200 hover:bg-blue-300 px-2 py-1 rounded text-blue-800 font-mono text-xs block mb-1"
            >
              {'{PN}'} - اسم المريض
            </button>
            <button
              type="button"
              onClick={() => insertVariable('{PQP}')}
              className="bg-blue-200 hover:bg-blue-300 px-2 py-1 rounded text-blue-800 font-mono text-xs block mb-1"
            >
              {'{PQP}'} - موضع المريض
            </button>
            <button
              type="button"
              onClick={() => insertVariable('{CQP}')}
              className="bg-blue-200 hover:bg-blue-300 px-2 py-1 rounded text-blue-800 font-mono text-xs block mb-1"
            >
              {'{CQP}'} - الموضع الحالي
            </button>
            <button
              type="button"
              onClick={() => insertVariable('{ETR}')}
              className="bg-blue-200 hover:bg-blue-300 px-2 py-1 rounded text-blue-800 font-mono text-xs block"
            >
              {'{ETR}'} - الوقت المتبقي
            </button>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <button
            type="submit"
            className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            إضافة القالب
          </button>
          <button
            type="button"
            onClick={() => closeModal('addTemplate')}
            className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400 transition-colors"
          >
            إلغاء
          </button>
        </div>
      </form>
    </Modal>
  );
}
