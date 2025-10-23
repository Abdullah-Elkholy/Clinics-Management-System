'use client';

import { useQueue } from '../../contexts/QueueContext';
import { useModal } from '../../contexts/ModalContext';
import { useUI } from '../../contexts/UIContext';
import { useState } from 'react';
import SharedHeader from './SharedHeader';
import StatsSection from './StatsSection';

// Sample patient data
const SAMPLE_PATIENTS = [
  { id: 1, name: 'أحمد محمد', phone: '+201012345678', countryCode: '+20', queue: 3 },
  { id: 2, name: 'فاطمة علي', phone: '01087654321', countryCode: '+20', queue: 5 },
  { id: 3, name: 'محمود حسن', phone: '01098765432', countryCode: '+20', queue: 2 },
  { id: 4, name: 'نور الدين', phone: '01011223344', countryCode: '+20', queue: 7 },
  { id: 5, name: 'سارة إبراهيم', phone: '01055667788', countryCode: '+20', queue: 1 },
];

export default function QueueDashboard() {
  const { selectedQueueId, queues } = useQueue();
  const { openModal } = useModal();
  const { addToast } = useUI();
  const [isEditingName, setIsEditingName] = useState(false);
  const [doctorName, setDoctorName] = useState('');
  const [isEditingCQP, setIsEditingCQP] = useState(false);
  const [currentCQP, setCurrentCQP] = useState('3');
  const [isEditingETS, setIsEditingETS] = useState(false);
  const [currentETS, setCurrentETS] = useState('15');
  const [patients, setPatients] = useState(SAMPLE_PATIENTS);
  const [selectedPatients, setSelectedPatients] = useState<number[]>([]);
  const [editingQueueId, setEditingQueueId] = useState<number | null>(null);
  const [editingQueueValue, setEditingQueueValue] = useState('');
  const queue = queues.find((q) => q.id === selectedQueueId);

  const handleEditName = () => {
    if (queue) {
      setDoctorName(queue.doctorName);
      setIsEditingName(true);
    }
  };

  const handleSaveName = () => {
    if (doctorName.trim() && queue) {
      // Update queue name through context if available
      setIsEditingName(false);
    }
  };

  const handleEditCQP = () => {
    setIsEditingCQP(true);
  };

  const handleSaveCQP = () => {
    if (currentCQP.trim()) {
      setIsEditingCQP(false);
      // Save CQP value
    }
  };

  const handleEditETS = () => {
    setIsEditingETS(true);
  };

  const handleSaveETS = () => {
    if (currentETS.trim()) {
      setIsEditingETS(false);
      // Save ETS value
    }
  };

  const togglePatientSelection = (id: number) => {
    setSelectedPatients((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleAllPatients = () => {
    if (selectedPatients.length === patients.length) {
      setSelectedPatients([]);
    } else {
      setSelectedPatients(patients.map((p) => p.id));
    }
  };

  const startEditingQueue = (patientId: number, currentQueue: number) => {
    setEditingQueueId(patientId);
    setEditingQueueValue(currentQueue.toString());
  };

  const saveQueueEdit = (patientId: number) => {
    const newQueue = parseInt(editingQueueValue, 10);
    if (!isNaN(newQueue) && newQueue > 0) {
      setPatients((prev) => {
        // Find the patient being edited
        const editingPatient = prev.find((p) => p.id === patientId);
        if (!editingPatient) return prev;

        const oldQueue = editingPatient.queue;

        // Check if the new queue number already exists
        const conflictingPatient = prev.find((p) => p.id !== patientId && p.queue === newQueue);

        if (conflictingPatient) {
          // If there's a conflict, we need to shift all patients
          // If new queue is less than old queue, shift down from old to new
          // If new queue is greater than old queue, shift up from old to new
          return prev.map((p) => {
            if (p.id === patientId) {
              // Update the editing patient
              return { ...p, queue: newQueue };
            }
            // If the patient's queue is between oldQueue and newQueue, shift them
            if (oldQueue < newQueue) {
              // Shifting right: move patients from oldQueue to newQueue-1 one position left
              if (p.queue > oldQueue && p.queue <= newQueue) {
                return { ...p, queue: p.queue - 1 };
              }
            } else {
              // Shifting left: move patients from newQueue to oldQueue-1 one position right
              if (p.queue >= newQueue && p.queue < oldQueue) {
                return { ...p, queue: p.queue + 1 };
              }
            }
            return p;
          });
        } else {
          // No conflict, just update the queue
          return prev.map((p) => (p.id === patientId ? { ...p, queue: newQueue } : p));
        }
      });
      setEditingQueueId(null);
    }
  };

  const cancelQueueEdit = () => {
    setEditingQueueId(null);
    setEditingQueueValue('');
  };

  return (
    <div className="p-6">
      <SharedHeader 
        title="لوحة التحكم الرئيسية" 
        description="إدارة قائمة انتظار العيادة والمرضى"
      />

      <StatsSection 
        gradient="bg-gradient-to-r from-purple-500 to-purple-600"
        stats={[
          {
            label: 'الموضع الحالي (CQP)',
            value: currentCQP,
            icon: 'arrow-right',
            editButton: {
              isEditing: isEditingCQP,
              currentValue: currentCQP,
              onEdit: handleEditCQP,
              onSave: handleSaveCQP,
              onCancel: () => setIsEditingCQP(false),
              onChange: setCurrentCQP
            }
          },
          {
            label: 'الوقت المقدر (ETS)',
            value: currentETS,
            icon: 'clock',
            editButton: {
              isEditing: isEditingETS,
              currentValue: currentETS,
              onEdit: handleEditETS,
              onSave: handleSaveETS,
              onCancel: () => setIsEditingETS(false),
              onChange: setCurrentETS,
              suffix: 'دقيقة'
            }
          },
          {
            label: 'عدد المرضى',
            value: '15',
            icon: 'users'
          }
        ]}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <button 
          onClick={() => openModal('addPatient')}
          className="bg-green-600 text-white p-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 space-x-reverse"
        >
          <i className="fas fa-user-plus"></i>
          <span>إضافة مريض يدوياً</span>
        </button>
        
        <button 
          onClick={() => openModal('upload')}
          className="bg-blue-600 text-white p-4 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2 space-x-reverse"
        >
          <i className="fas fa-upload"></i>
          <span>رفع ملف المرضى</span>
        </button>
        
        <button 
          onClick={() => {
            if (selectedPatients.length === 0) {
              addToast('يرجى تحديد مريض واحد على الأقل', 'error');
              return;
            }
            const ok = window.confirm(`هل أنت متأكد من حذف ${selectedPatients.length} مريض؟`);
            if (ok) {
              setPatients((prev) => prev.filter((p) => !selectedPatients.includes(p.id)));
              setSelectedPatients([]);
              addToast(`تم حذف ${selectedPatients.length} مريض`, 'success');
            }
          }}
          className="bg-red-600 text-white p-4 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center space-x-2 space-x-reverse"
        >
          <i className="fas fa-trash"></i>
          <span>حذف المحدد ({selectedPatients.length})</span>
        </button>
        
        <button 
          onClick={() => {
            if (selectedPatients.length === 0) {
              addToast('يرجى تحديد مريض واحد على الأقل لإرسال الرسالة', 'error');
              return;
            }
            openModal('messagePreview', {
              selectedPatients: selectedPatients,
              selectedPatientCount: selectedPatients.length,
            });
          }}
          className="bg-green-600 text-white p-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 space-x-reverse"
        >
          <i className="fab fa-whatsapp"></i>
          <span>إرسال للمحدد ({selectedPatients.length})</span>
        </button>
      </div>

      {/* Selected Message Display with Edit Button */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-bold text-gray-800 mb-2">الرسالة الافتراضية المحددة:</h3>
          <p className="text-gray-700">مرحباً {'{PN}'}، ترتيبك {'{PQP}'} والموضع الحالي {'{CQP}'}، الوقت المتبقي المقدر {'{ETR}'} دقيقة</p>
        </div>
        <button 
          onClick={() => openModal('messageSelection')}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 ml-4 flex-shrink-0"
          title="تغيير الرسالة"
        >
          <i className="fas fa-edit"></i>
          <span className="text-sm font-medium">تغيير الرسالة</span>
        </button>
      </div>

      {/* Patients Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h3 className="font-bold text-gray-800">قائمة المرضى</h3>
            <span className="text-sm text-gray-600">
              {selectedPatients.length} من {SAMPLE_PATIENTS.length} محدد
            </span>
          </div>
          {selectedPatients.length > 0 && (
            <button
              onClick={() => setSelectedPatients([])}
              className="text-sm text-red-600 hover:text-red-800"
            >
              إلغاء التحديد
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700 w-12">
                  <input
                    type="checkbox"
                    checked={selectedPatients.length === SAMPLE_PATIENTS.length && SAMPLE_PATIENTS.length > 0}
                    onChange={toggleAllPatients}
                    className="w-4 h-4 rounded cursor-pointer"
                  />
                </th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">ترتيب الانتظار</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">الاسم</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">رقم الجوال</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {patients
                .sort((a, b) => a.queue - b.queue)
                .map((patient, idx) => (
                <tr
                  key={patient.id}
                  className={`border-b hover:bg-gray-50 transition-colors ${
                    selectedPatients.includes(patient.id) ? 'bg-blue-50' : ''
                  }`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedPatients.includes(patient.id)}
                      onChange={() => togglePatientSelection(patient.id)}
                      className="w-4 h-4 rounded cursor-pointer"
                    />
                  </td>
                  <td className="px-6 py-3 text-sm">
                    {editingQueueId === patient.id ? (
                      <div className="flex gap-1 items-center">
                        <input
                          type="number"
                          value={editingQueueValue}
                          onChange={(e) => setEditingQueueValue(e.target.value)}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                          autoFocus
                        />
                        <button
                          onClick={() => saveQueueEdit(patient.id)}
                          className="bg-green-500 hover:bg-green-600 px-1 py-0.5 rounded text-xs text-white"
                        >
                          ✓
                        </button>
                        <button
                          onClick={cancelQueueEdit}
                          className="bg-red-500 hover:bg-red-600 px-1 py-0.5 rounded text-xs text-white"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2 items-center">
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs font-medium">
                          #{patient.queue}
                        </span>
                        <button
                          onClick={() => startEditingQueue(patient.id, patient.queue)}
                          title="تعديل ترتيب الانتظار"
                          className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded text-xs"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-900 font-medium">{patient.name}</td>
                  <td className="px-6 py-3 text-sm text-gray-600">{patient.countryCode} {patient.phone}</td>
                  {/* Actions column */}
                  <td className="px-6 py-3 text-sm text-left">
                    <div className="flex gap-2 justify-start">
                      {/* WhatsApp button - opens wa.me link */}
                      <button
                        onClick={() => {
                          // normalize phone (remove + and spaces)
                          const num = (patient.countryCode + patient.phone).replace(/[^0-9]/g, '');
                          const url = `https://wa.me/${num}`;
                          window.open(url, '_blank');
                        }}
                        title="فتح في واتساب"
                        className="bg-green-50 text-green-600 hover:bg-green-100 px-2 py-1 rounded"
                      >
                        <i className="fab fa-whatsapp"></i>
                      </button>

                      {/* Edit button - open EditPatient modal with data and onSave callback */}
                      <button
                        onClick={() =>
                          openModal('editPatient', {
                            patient,
                            onSave: (updated: any) => {
                              setPatients((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
                              // Also update selectedPatients if needed (optional)
                            },
                          })
                        }
                        title="تعديل"
                        className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded"
                      >
                        <i className="fas fa-edit"></i>
                      </button>

                      {/* Delete button - confirm then remove */}
                      <button
                        onClick={() => {
                          const ok = window.confirm(`هل أنت متأكد من حذف ${patient.name}؟`);
                          if (ok) {
                            setPatients((prev) => prev.filter((p) => p.id !== patient.id));
                            setSelectedPatients((prev) => prev.filter((id) => id !== patient.id));
                          }
                        }}
                        title="حذف"
                        className="bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {SAMPLE_PATIENTS.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            <i className="fas fa-inbox text-4xl mb-3"></i>
            <p>لا يوجد مرضى في هذه العيادة</p>
          </div>
        )}
      </div>
    </div>
  );
}
