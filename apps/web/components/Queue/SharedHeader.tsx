'use client';

import { useQueue } from '../../contexts/QueueContext';
import { useState } from 'react';
import { useUI } from '../../contexts/UIContext';

interface SharedHeaderProps {
  title: string;
  description?: string;
}

export default function SharedHeader({ title, description }: SharedHeaderProps) {
  const { selectedQueueId, queues, updateQueue, deleteQueue } = useQueue();
  const { addToast } = useUI();
  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState('');
  const queue = queues.find((q) => q.id === selectedQueueId);

  const handleEditStart = () => {
    setEditingName(queue?.doctorName || '');
    setIsEditing(true);
  };

  const handleEditSave = () => {
    if (!editingName.trim()) {
      addToast('يرجى إدخال اسم الطبيب', 'error');
      return;
    }

    if (queue) {
      try {
        updateQueue(queue.id, { doctorName: editingName.trim() });
        addToast('تم تحديث اسم الطبيب بنجاح', 'success');
      } catch (err) {
        addToast('حدث خطأ في تحديث اسم الطبيب', 'error');
      }
    }
    setIsEditing(false);
  };

  const handleDeleteQueue = () => {
    if (!queue) return;
    
    if (confirm(`هل أنت متأكد من حذف الصف: ${queue.doctorName}؟`)) {
      try {
        deleteQueue(queue.id);
        addToast('تم حذف الصف بنجاح', 'success');
      } catch (err) {
        addToast('حدث خطأ في حذف الصف', 'error');
      }
    }
  };

  return (
    <div className="bg-gradient-to-l from-blue-600 to-purple-600 text-white p-6 rounded-xl mb-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {isEditing ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  className="text-2xl font-bold bg-white bg-opacity-20 text-white px-3 py-1 rounded border border-white border-opacity-40 focus:outline-none focus:ring-2 focus:ring-white"
                  placeholder="أدخل اسم الطبيب"
                  autoFocus
                />
                <button
                  onClick={handleEditSave}
                  className="bg-green-500 hover:bg-green-600 px-3 py-1 rounded text-sm font-medium transition"
                >
                  ✓ حفظ
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="bg-red-500 hover:bg-red-600 px-3 py-1 rounded text-sm font-medium transition"
                >
                  ✕ إلغاء
                </button>
              </div>
            ) : (
              <>
                <h1 className="text-2xl font-bold">{queue?.doctorName || 'د. لم يتم التحديد'}</h1>
                <button
                  onClick={handleEditStart}
                  className="text-white opacity-75 hover:opacity-100 transition ml-2"
                  title="تعديل اسم الطبيب"
                >
                  <i className="fas fa-edit text-lg"></i>
                </button>
                {queue && (
                  <button
                    onClick={handleDeleteQueue}
                    className="text-red-300 hover:text-red-100 transition"
                    title="حذف الصف"
                  >
                    <i className="fas fa-trash text-lg"></i>
                  </button>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-6 mt-3 text-blue-100">
            <div>
              <p className="text-sm">القسم/الخدمة</p>
              <p className="text-base font-semibold">{title}</p>
            </div>
            {description && (
              <div>
                <p className="text-sm">{description}</p>
              </div>
            )}
          </div>
        </div>
        <div className="text-left">
          <div className="bg-white bg-opacity-20 px-4 py-2 rounded-lg">
            <i className="fas fa-user-md text-3xl"></i>
          </div>
        </div>
      </div>
    </div>
  );
}
