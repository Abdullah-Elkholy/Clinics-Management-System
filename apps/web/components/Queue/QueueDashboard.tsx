'use client';

import { useQueue } from '@/contexts/QueueContext';
import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { useState, useCallback, useMemo } from 'react';
import { validateNumber } from '@/utils/validation';
import { MOCK_QUEUE_PATIENTS } from '@/constants/mockData';
import { PanelWrapper } from '@/components/Common/PanelWrapper';
import { PanelHeader } from '@/components/Common/PanelHeader';
import { ResponsiveTable } from '@/components/Common/ResponsiveTable';
import { EmptyState } from '@/components/Common/EmptyState';
import { QueueStatsCard } from './QueueStatsCard';

// Sample patient data
const SAMPLE_PATIENTS = MOCK_QUEUE_PATIENTS;

export default function QueueDashboard() {
  const { selectedQueueId, queues } = useQueue();
  const { openModal } = useModal();
  const { addToast } = useUI();
  
  const [currentCQP, setCurrentCQP] = useState('3');
  const [originalCQP, setOriginalCQP] = useState('3');
  const [isEditingCQP, setIsEditingCQP] = useState(false);
  
  const [currentETS, setCurrentETS] = useState('15');
  const [originalETS, setOriginalETS] = useState('15');
  const [isEditingETS, setIsEditingETS] = useState(false);
  
  const [patients, setPatients] = useState(SAMPLE_PATIENTS);
  const [selectedPatients, setSelectedPatients] = useState<number[]>([]);
  const [editingQueueId, setEditingQueueId] = useState<number | null>(null);
  const [editingQueueValue, setEditingQueueValue] = useState('');
  
  const queue = queues.find((q) => q.id === selectedQueueId);

  /**
   * Handle CQP (Current Queue Position) Edit - memoized
   */
  const handleEditCQP = useCallback(() => {
    setOriginalCQP(currentCQP);
    setIsEditingCQP(true);
  }, [currentCQP]);

  /**
   * Handle CQP Save - memoized
   */
  const handleSaveCQP = useCallback(() => {
    const error = validateNumber(currentCQP, 'الموضع الحالي', 1, 1000);
    if (error) {
      addToast(error, 'error');
      return;
    }
    if (currentCQP.trim()) {
      setIsEditingCQP(false);
      addToast('تم تحديث الموضع الحالي بنجاح', 'success');
    }
  }, [currentCQP, addToast]);

  /**
   * Handle CQP Cancel - memoized
   */
  const handleCancelCQP = useCallback(() => {
    setCurrentCQP(originalCQP);
    setIsEditingCQP(false);
  }, [originalCQP]);

  /**
   * Handle ETS (Estimated Time per Session) Edit - memoized
   */
  const handleEditETS = useCallback(() => {
    setOriginalETS(currentETS);
    setIsEditingETS(true);
  }, [currentETS]);

  /**
   * Handle ETS Save - memoized
   */
  const handleSaveETS = useCallback(() => {
    const error = validateNumber(currentETS, 'الوقت المقدر', 1, 600);
    if (error) {
      addToast(error, 'error');
      return;
    }
    if (currentETS.trim()) {
      setIsEditingETS(false);
      addToast('تم تحديث الوقت المقدر بنجاح', 'success');
    }
  }, [currentETS, addToast]);

  /**
   * Handle ETS Cancel - memoized
   */
  const handleCancelETS = useCallback(() => {
    setCurrentETS(originalETS);
    setIsEditingETS(false);
  }, [originalETS]);

  /**
   * Toggle patient selection - memoized
   */
  const togglePatientSelection = useCallback((id: number) => {
    setSelectedPatients((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }, []);

  /**
   * Toggle all patients - memoized
   */
  const toggleAllPatients = useCallback(() => {
    if (selectedPatients.length === patients.length) {
      setSelectedPatients([]);
    } else {
      setSelectedPatients(patients.map((p) => p.id));
    }
  }, [selectedPatients.length, patients.length]);

  /**
   * Start editing queue position - memoized
   */
  const startEditingQueue = useCallback((patientId: number, currentQueue: number) => {
    setEditingQueueId(patientId);
    setEditingQueueValue(currentQueue.toString());
  }, []);

  /**
   * Save queue edit - memoized
   */
  const saveQueueEdit = useCallback((patientId: number) => {
    const newQueue = parseInt(editingQueueValue, 10);
    if (!isNaN(newQueue) && newQueue > 0) {
      setPatients((prev) => {
        const editingPatient = prev.find((p) => p.id === patientId);
        if (!editingPatient) return prev;

        const oldQueue = editingPatient.queue;
        const conflictingPatient = prev.find((p) => p.id !== patientId && p.queue === newQueue);

        if (conflictingPatient) {
          return prev.map((p) => {
            if (p.id === patientId) {
              return { ...p, queue: newQueue };
            }
            if (oldQueue < newQueue) {
              if (p.queue > oldQueue && p.queue <= newQueue) {
                return { ...p, queue: p.queue - 1 };
              }
            } else {
              if (p.queue >= newQueue && p.queue < oldQueue) {
                return { ...p, queue: p.queue + 1 };
              }
            }
            return p;
          });
        } else {
          return prev.map((p) => (p.id === patientId ? { ...p, queue: newQueue } : p));
        }
      });
      setEditingQueueId(null);
    }
  }, [editingQueueValue]);

  /**
   * Cancel queue edit - memoized
   */
  const cancelQueueEdit = useCallback(() => {
    setEditingQueueId(null);
    setEditingQueueValue('');
  }, []);

  /**
   * Memoize table columns configuration
   */
  const tableColumns = useMemo(() => [
    { key: 'checkbox', label: '', width: '5%' },
    { key: 'queue', label: 'ترتيب الانتظار', width: '15%' },
    { key: 'name', label: 'الاسم', width: '25%' },
    { key: 'phone', label: 'رقم الجوال', width: '20%' },
    { key: 'actions', label: 'الإجراءات', width: '35%' },
  ], []);

  /**
   * Memoize table data rows - sorted by queue
   */
  const tableRows = useMemo(() =>
    patients
      .sort((a, b) => a.queue - b.queue)
      .map((patient) => ({
        id: patient.id,
        checkbox: (
          <input
            type="checkbox"
            checked={selectedPatients.includes(patient.id)}
            onChange={() => togglePatientSelection(patient.id)}
            className="w-4 h-4 rounded cursor-pointer"
          />
        ),
        queue:
          editingQueueId === patient.id ? (
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
          ),
        name: patient.name,
        phone: `${patient.countryCode} ${patient.phone}`,
        actions: (
          <div className="flex gap-2 justify-start">
            <button
              onClick={() => {
                const num = (patient.countryCode + patient.phone).replace(/[^0-9]/g, '');
                const url = `https://wa.me/${num}`;
                window.open(url, '_blank');
              }}
              title="فتح في واتساب"
              className="bg-green-50 text-green-600 hover:bg-green-100 px-2 py-1 rounded"
            >
              <i className="fab fa-whatsapp"></i>
            </button>
            <button
              onClick={() =>
                openModal('editPatient', {
                  patient,
                  onSave: (updated: any) => {
                    setPatients((prev) =>
                      prev.map((p) => (p.id === updated.id ? updated : p))
                    );
                  },
                })
              }
              title="تعديل"
              className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded"
            >
              <i className="fas fa-edit"></i>
            </button>
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
        ),
      })),
    [patients, selectedPatients, editingQueueId, editingQueueValue, togglePatientSelection, startEditingQueue, saveQueueEdit, cancelQueueEdit, openModal]
  );

  return (
    <PanelWrapper>
      <PanelHeader
        title={`لوحة التحكم الرئيسية ${queue ? `- ${queue.doctorName}` : ''}`}
        icon="fa-gauge-high"
        description="إدارة قائمة انتظار العيادة والمرضى"
        stats={[
          {
            label: 'إجمالي المرضى',
            value: patients.length.toString(),
            icon: 'fa-users',
          },
          {
            label: 'المحددون',
            value: selectedPatients.length.toString(),
            icon: 'fa-check-circle',
          },
        ]}
      />

      {/* Editable Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Current Queue Position (CQP) Card */}
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg border border-blue-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <i className="fas fa-layer-group text-blue-700 text-lg"></i>
              <span>الموضع الحالي (CQP)</span>
            </h3>
            {!isEditingCQP && (
              <button
                onClick={handleEditCQP}
                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg transition-all shadow-md hover:shadow-lg text-sm font-medium"
                title="تعديل"
              >
                <i className="fas fa-pen-to-square mr-1"></i>
                <span>تعديل</span>
              </button>
            )}
          </div>
          {isEditingCQP ? (
            <div className="flex gap-2 items-end">
              <input
                type="number"
                value={currentCQP}
                onChange={(e) => setCurrentCQP(e.target.value)}
                className="flex-1 px-3 py-2 border border-blue-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <button
                onClick={handleSaveCQP}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                <i className="fas fa-check"></i>
              </button>
              <button
                onClick={handleCancelCQP}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
          ) : (
            <p className="text-3xl font-bold text-blue-700">{currentCQP}</p>
          )}
        </div>

        {/* Estimated Time per Session (ETS) Card */}
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg border border-green-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <i className="fas fa-hourglass-end text-green-700 text-lg"></i>
              <span>الوقت المقدر لكل كشف (ETS)</span>
            </h3>
            {!isEditingETS && (
              <button
                onClick={handleEditETS}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg transition-all shadow-md hover:shadow-lg text-sm font-medium"
                title="تعديل"
              >
                <i className="fas fa-pen-to-square mr-1"></i>
                <span>تعديل</span>
              </button>
            )}
          </div>
          {isEditingETS ? (
            <div className="flex gap-2 items-end">
              <input
                type="number"
                value={currentETS}
                onChange={(e) => setCurrentETS(e.target.value)}
                className="flex-1 px-3 py-2 border border-green-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                autoFocus
              />
              <span className="text-gray-600">دقيقة</span>
              <button
                onClick={handleSaveETS}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
              >
                <i className="fas fa-check"></i>
              </button>
              <button
                onClick={handleCancelETS}
                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>
          ) : (
            <p className="text-3xl font-bold text-green-700">{currentETS} دقيقة</p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
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
          <span>حذف ({selectedPatients.length})</span>
        </button>

        <button
          onClick={() => {
            if (selectedPatients.length === 0) {
              addToast('يرجى تحديد مريض واحد على الأقل لإرسال الرسالة', 'error');
              return;
            }
            openModal('messagePreview', {
              selectedPatients,
              selectedPatientCount: selectedPatients.length,
            });
          }}
          className="bg-green-600 text-white p-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 space-x-reverse"
        >
          <i className="fab fa-whatsapp"></i>
          <span>إرسال ({selectedPatients.length})</span>
        </button>
      </div>

      {/* Selected Message Display */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 flex items-start justify-between">
        <div className="flex-1">
          <h3 className="font-bold text-gray-800 mb-2">الرسالة الافتراضية المحددة:</h3>
          <p className="text-gray-700">
            مرحباً {'{PN}'}, ترتيبك {'{PQP}'} والموضع الحالي {'{CQP}'},
            الوقت المتبقي المقدر {'{ETR}'} دقيقة
          </p>
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
      {patients.length === 0 ? (
        <EmptyState
          icon="fa-users"
          title="لا يوجد مرضى"
          message="لم يتم إضافة أي مريض بعد. ابدأ بإضافة مريض جديد"
          actionLabel="إضافة مريض أول"
          onAction={() => openModal('addPatient')}
        />
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div
                onClick={toggleAllPatients}
                className="relative w-5 h-5 border-2 rounded cursor-pointer transition-all"
                style={{
                  borderColor: selectedPatients.length === 0 ? '#d1d5db' : selectedPatients.length === patients.length ? '#3b82f6' : '#f59e0b',
                  backgroundColor: selectedPatients.length === 0 ? 'white' : selectedPatients.length === patients.length ? '#3b82f6' : '#fef3c7',
                }}
                title={selectedPatients.length === 0 ? 'تحديد الكل' : selectedPatients.length === patients.length ? 'إلغاء التحديد' : 'تحديد الكل'}
              >
                {selectedPatients.length > 0 && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <i
                      className={`fas text-white text-xs ${
                        selectedPatients.length === patients.length ? 'fa-check' : 'fa-minus'
                      }`}
                    ></i>
                  </div>
                )}
              </div>
              <h3 className="font-bold text-gray-800">قائمة المرضى</h3>
              <span className="text-sm text-gray-600">
                {selectedPatients.length} من {patients.length} محدد
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
                  {tableColumns.map((col) => (
                    <th
                      key={col.key}
                      style={{ width: col.width }}
                      className="px-6 py-3 text-right text-sm font-semibold text-gray-700"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) => (
                  <tr
                    key={row.id}
                    className={`border-b hover:bg-gray-50 transition-colors ${
                      selectedPatients.includes(row.id) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="px-6 py-3 text-sm">{row.checkbox}</td>
                    <td className="px-6 py-3 text-sm">{row.queue}</td>
                    <td className="px-6 py-3 text-sm text-gray-900 font-medium">{row.name}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">{row.phone}</td>
                    <td className="px-6 py-3 text-sm">{row.actions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2 mt-6">
        <h4 className="font-semibold text-blue-900 flex items-center gap-2">
          <i className="fas fa-info-circle"></i>
          نصائح:
        </h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• CQP: الموضع الحالي في قائمة الانتظار</li>
          <li>• ETS: المدة المتوقعة لكل كشف طبي بالدقائق</li>
          <li>• يمكنك تعديل ترتيب المرضى بالنقر على أيقونة التعديل</li>
          <li>• اختر عدد من المرضى وارسل لهم رسائل جماعية</li>
        </ul>
      </div>
    </PanelWrapper>
  );
}
