'use client';

import { useQueue } from '../../contexts/QueueContext';
import { useState } from 'react';
import { useUI } from '../../contexts/UIContext';
import { useRouter } from 'next/navigation';
import { validateName, validateLength, sanitizeInput } from '../../utils/validation';

interface SharedHeaderProps {
  title: string;
  description?: string;
  colorTheme?: 'blue' | 'red' | 'green' | 'purple'; // Theme-descriptive colors
}

export default function SharedHeader({ title, description, colorTheme = 'blue' }: SharedHeaderProps) {
  const { selectedQueueId, queues, updateQueue, deleteQueue, setSelectedQueueId, patients } = useQueue();
  const { addToast, setCurrentPanel } = useUI();
  const [isEditing, setIsEditing] = useState(false);
  const [editingName, setEditingName] = useState('');
  const queue = queues.find((q) => q.id === selectedQueueId);

  // Color theme mapping
  const themeColors = {
    blue: 'from-blue-600 to-blue-700',
    red: 'from-red-600 to-red-700',
    green: 'from-green-600 to-green-700',
    purple: 'from-purple-600 to-purple-700',
  };

  const handleEditStart = () => {
    setEditingName(queue?.doctorName || '');
    setIsEditing(true);
  };

  const handleEditSave = () => {
    const trimmedName = editingName.trim();
    
    // Validate name is not empty
    if (!trimmedName) {
      addToast('يرجى إدخال اسم الطبيب', 'error');
      return;
    }
    
    // Validate name format
    const nameError = validateName(trimmedName);
    if (nameError) {
      addToast(nameError, 'error');
      return;
    }
    
    // Validate name length (2-100 characters)
    const lengthError = validateLength(trimmedName, 'اسم الطبيب', 2, 100);
    if (lengthError) {
      addToast(lengthError, 'error');
      return;
    }
    
    // Sanitize input before saving
    const sanitizedName = sanitizeInput(trimmedName);

    if (queue) {
      try {
        updateQueue(queue.id, { doctorName: sanitizedName });
        addToast('تم تحديث اسم الطبيب بنجاح', 'success');
      } catch (err) {
        addToast('حدث خطأ في تحديث اسم الطبيب', 'error');
      }
    }
    setIsEditing(false);
  };

  const handleDeleteQueue = () => {
    if (!queue) return;
    
    const confirmDelete = confirm(
      `⚠️ تحذير: حذف الصف\n\n` +
      `اسم الطبيب: ${queue.doctorName}\n` +
      `القسم: ${title}\n` +
      `عدد المرضى: ${patients.length}\n\n` +
      `هل أنت متأكد من رغبتك في حذف هذا الصف بالكامل؟ لا يمكن التراجع عن هذه العملية.`
    );
    
    if (confirmDelete) {
      try {
        deleteQueue(queue.id);
        setSelectedQueueId(null);
        setCurrentPanel('welcome');
        addToast('تم حذف الصف بنجاح', 'success');
      } catch (err) {
        addToast('حدث خطأ في حذف الصف', 'error');
      }
    }
  };

  return (
    <div className={`bg-gradient-to-l ${themeColors[colorTheme]} text-white p-6 rounded-xl mb-6`}>
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
