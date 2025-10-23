'use client';

import { useState } from 'react';
import SharedHeader from './SharedHeader';
import StatsSection from './StatsSection';
import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';

interface Patient {
  id: number;
  name: string;
  phone: string;
  countryCode?: string;
  queue?: number;
  status: string;
  failedReason: string;
  retryCount: number;
}

interface Session {
  id: string;
  sessionId: string;
  clinicName: string;
  doctorName: string;
  createdAt: string;
  totalPatients: number;
  failedCount: number;
  patients: Patient[];
}

export default function FailedTasksPanel() {
  const { openModal } = useModal();
  const { addToast } = useUI();
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set(['SES-15-JAN-001']));
  const [selectedPatients, setSelectedPatients] = useState<Map<string, Set<number>>>(new Map());
  const [showMessage, setShowMessage] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([
    {
      id: '1',
      sessionId: 'SES-15-JAN-001',
      clinicName: 'عيادة أحمد محمد',
      doctorName: 'د. أحمد محمد',
      createdAt: '2025-01-15 14:30:25',
      totalPatients: 50,
      failedCount: 4,
      patients: [
        {
          id: 1,
          name: 'أحمد محمد',
          phone: '01012345678',
          countryCode: '+20',
          queue: 1,
          status: 'فشل',
          failedReason: 'خطأ في رقم الجوال',
          retryCount: 1,
        },
        {
          id: 2,
          name: 'فاطمة علي',
          phone: '01087654321',
          countryCode: '+20',
          queue: 2,
          status: 'فشل',
          failedReason: 'انقطاع الاتصال',
          retryCount: 0,
        },
        {
          id: 3,
          name: 'محمود حسن',
          phone: '01098765432',
          countryCode: '+20',
          queue: 3,
          status: 'فشل',
          failedReason: 'حد الرسائل اليومي',
          retryCount: 2,
        },
      ],
    },
  ]);

  const toggleSessionExpand = (sessionId: string) => {
    setExpandedSessions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  };

  const togglePatientSelection = (sessionId: string, patientId: number) => {
    setSelectedPatients((prev) => {
      const newMap = new Map(prev);
      if (!newMap.has(sessionId)) {
        newMap.set(sessionId, new Set());
      }
      const sessionSet = newMap.get(sessionId)!;
      if (sessionSet.has(patientId)) {
        sessionSet.delete(patientId);
      } else {
        sessionSet.add(patientId);
      }
      return newMap;
    });
  };

  const deleteSelectedPatients = (sessionId: string) => {
    const selected = selectedPatients.get(sessionId) || new Set();
    if (selected.size === 0) return;

    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              patients: s.patients.filter((p) => !selected.has(p.id)),
              totalPatients: s.totalPatients - selected.size,
              failedCount: s.failedCount - selected.size,
            }
          : s
      )
    );

    setSelectedPatients((prev) => {
      const newMap = new Map(prev);
      newMap.delete(sessionId);
      return newMap;
    });
  };

  const retrySelectedPatients = (sessionId: string) => {
    const selected = selectedPatients.get(sessionId) || new Set();
    if (selected.size === 0) return;

    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              patients: s.patients.map((p) =>
                selected.has(p.id)
                  ? { ...p, status: 'جاري', retryCount: p.retryCount + 1 }
                  : p
              ),
            }
          : s
      )
    );

    setSelectedPatients((prev) => {
      const newMap = new Map(prev);
      newMap.delete(sessionId);
      return newMap;
    });
  };

  const retrySinglePatient = (sessionId: string, patientId: number) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              patients: s.patients.map((p) =>
                p.id === patientId
                  ? { ...p, status: 'جاري', retryCount: p.retryCount + 1 }
                  : p
              ),
            }
          : s
      )
    );
    addToast('تم إعادة محاولة المريض بنجاح', 'success');
  };

  const retryAllPatients = () => {
    setSessions((prev) =>
      prev.map((s) => ({
        ...s,
        patients: s.patients.map((p) => ({
          ...p,
          status: 'جاري',
          retryCount: p.retryCount + 1,
        })),
      }))
    );
    setSelectedPatients(new Map());
  };

  const deleteAllPatients = () => {
    const ok = window.confirm('هل أنت متأكد من حذف جميع المهام الفاشلة؟');
    if (ok) {
      setSessions([]);
      setSelectedPatients(new Map());
    }
  };

  const handleEditPatient = (patient: Patient) => {
    openModal('editPatient', { patient, onSave: handleSaveEditedPatient });
  };

  const handleSaveEditedPatient = (updatedPatient: Patient) => {
    setSessions((prev) =>
      prev.map((s) => ({
        ...s,
        patients: s.patients.map((p) =>
          p.id === updatedPatient.id ? updatedPatient : p
        ),
      }))
    );
    addToast('تم تحديث بيانات المريض بنجاح', 'success');
  };

  const handleDeletePatient = (sessionId: string, patientId: number) => {
    const ok = window.confirm('هل أنت متأكد من حذف هذا المريض؟');
    if (ok) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                patients: s.patients.filter((p) => p.id !== patientId),
              }
            : s
        )
      );
      addToast('تم حذف المريض بنجاح', 'success');
    }
  };

  const fullMessage = 'مرحباً {PN}، ترتيبك {PQP}، الموضع الحالي {CQP}، الوقت المتبقي {ETR} دقيقة';

  return (
    <div className="p-6">
      <SharedHeader 
        title="المهام الفاشلة" 
        description="عرض وإدارة المهام التي فشلت والتي تحتاج إلى إعادة محاولة"
      />

      <StatsSection 
        gradient="bg-gradient-to-br from-red-500 to-red-600"
        stats={[
          {
            label: 'إجمالي الجلسات بها فشل',
            value: sessions.length,
            icon: 'exclamation-circle'
          },
          {
            label: 'إجمالي الرسائل الفاشلة',
            value: sessions.reduce((sum, s) => sum + s.failedCount, 0),
            icon: 'times-circle'
          },
          {
            label: 'إجمالي المرضى',
            value: sessions.reduce((sum, s) => sum + s.patients.length, 0),
            icon: 'users'
          }
        ]}
      />

      <div className="mb-6 flex items-center justify-between">
        <div></div>
        <div className="flex gap-3">
          <button
            onClick={retryAllPatients}
            disabled={sessions.length === 0 || sessions.every((s) => s.patients.length === 0)}
            className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <i className="fas fa-redo"></i>
            <span>إعادة محاولة الكل</span>
          </button>
          <button
            onClick={deleteAllPatients}
            disabled={sessions.length === 0 || sessions.every((s) => s.patients.length === 0)}
            className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <i className="fas fa-trash"></i>
            <span>حذف الكل</span>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {sessions.map((session) => {
          const isExpanded = expandedSessions.has(session.id);
          const selectedCount = selectedPatients.get(session.id)?.size || 0;

          return (
            <div key={session.id} className="bg-white rounded-lg shadow overflow-hidden">
              {/* Session Header */}
              <div
                className="px-6 py-4 bg-gradient-to-r from-red-50 to-orange-50 border-b cursor-pointer hover:bg-red-100 transition-colors flex items-center justify-between"
                onClick={() => toggleSessionExpand(session.id)}
              >
                <div className="flex items-center gap-4 flex-1">
                  <button className="text-red-600 hover:text-red-800 text-xl">
                    <i className={`fas fa-chevron-${isExpanded ? 'down' : 'left'}`}></i>
                  </button>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-lg">{session.clinicName}</h3>
                    <div className="flex gap-6 mt-2 text-sm text-gray-600">
                      <span>
                        <span className="font-medium">جلسة الإرسال:</span> {session.sessionId}
                      </span>
                      <span>
                        <span className="font-medium">وقت الإنشاء:</span> {session.createdAt}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-bold">
                    {session.failedCount} فشل
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <>
                  {/* Selected Patients Info & Action Buttons */}
                  {session.patients.length > 0 && (
                    <div className="px-6 py-3 bg-gray-50 border-b flex items-center justify-between gap-4">
                      <span className="text-sm text-gray-600 flex-1">
                        {selectedCount > 0 ? `تم تحديد ${selectedCount} مريض` : ''}
                      </span>
                      <div className="flex gap-3">
                        <button
                          onClick={() => retrySelectedPatients(session.id)}
                          disabled={selectedCount === 0}
                          className="bg-orange-50 text-orange-600 hover:bg-orange-100 px-3 py-1 rounded text-sm disabled:bg-gray-100 disabled:text-gray-400 transition-colors flex items-center gap-2"
                        >
                          <i className="fas fa-redo"></i>
                          إعادة محاولة ({selectedCount})
                        </button>
                        <button
                          onClick={() => deleteSelectedPatients(session.id)}
                          disabled={selectedCount === 0}
                          className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1 rounded text-sm disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
                        >
                          <i className="fas fa-trash ml-1"></i>
                          حذف {selectedCount} مريض
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Patients Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700 w-12">
                            <input
                              type="checkbox"
                              checked={
                                selectedCount > 0 &&
                                selectedCount === session.patients.length
                              }
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPatients((prev) => {
                                    const newMap = new Map(prev);
                                    newMap.set(
                                      session.id,
                                      new Set(session.patients.map((p) => p.id))
                                    );
                                    return newMap;
                                  });
                                } else {
                                  setSelectedPatients((prev) => {
                                    const newMap = new Map(prev);
                                    newMap.delete(session.id);
                                    return newMap;
                                  });
                                }
                              }}
                              className="w-4 h-4 rounded cursor-pointer"
                            />
                          </th>
                          <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                            الاسم
                          </th>
                          <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                            رقم الجوال
                          </th>
                          {showMessage && (
                            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                              <div className="flex items-center justify-between gap-2">
                                <button
                                  onClick={() => setShowMessage(false)}
                                  className="text-gray-400 hover:text-gray-600 transition"
                                  title="إخفاء الرسالة"
                                >
                                  ✕
                                </button>
                                <span>الرسالة</span>
                              </div>
                            </th>
                          )}
                          <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                            <div className="flex items-center justify-between gap-2">
                              <button
                                onClick={() => setShowMessage(true)}
                                className={`text-gray-400 hover:text-gray-600 transition ${showMessage ? 'hidden' : ''}`}
                                title="عرض الرسالة"
                              >
                                ⊕
                              </button>
                              <span>سبب الفشل</span>
                            </div>
                          </th>
                          <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                            محاولات
                          </th>
                          <th className="px-6 py-3 text-right text-sm font-semibold text-gray-700">
                            الإجراءات
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {session.patients
                          .sort((a, b) => (a.queue ?? 0) - (b.queue ?? 0))
                          .map((patient) => (
                          <tr
                            key={patient.id}
                            className={`border-b hover:bg-gray-50 transition-colors ${
                              selectedPatients.get(session.id)?.has(patient.id)
                                ? 'bg-red-50'
                                : ''
                            }`}
                          >
                            <td className="px-6 py-3">
                              <input
                                type="checkbox"
                                checked={
                                  selectedPatients.get(session.id)?.has(patient.id) || false
                                }
                                onChange={() =>
                                  togglePatientSelection(session.id, patient.id)
                                }
                                className="w-4 h-4 rounded cursor-pointer"
                              />
                            </td>
                            <td className="px-6 py-3 text-sm font-medium text-gray-900">
                              {patient.name}
                            </td>
                            <td className="px-6 py-3 text-sm text-gray-600">
                              {patient.countryCode} {patient.phone}
                            </td>
                            {showMessage && (
                              <td className="px-6 py-3 text-sm text-gray-600 max-w-xs">
                                {fullMessage}
                              </td>
                            )}
                            <td className="px-6 py-3 text-sm">
                              <div className="flex items-center gap-2">
                                <i className="fas fa-exclamation-circle text-red-500"></i>
                                <span className="text-gray-600">{patient.failedReason}</span>
                              </div>
                            </td>
                            <td className="px-6 py-3 text-sm">
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  patient.retryCount > 0
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {patient.retryCount}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-sm">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => retrySinglePatient(session.id, patient.id)}
                                  title="إعادة محاولة"
                                  className="bg-orange-50 text-orange-600 hover:bg-orange-100 px-2 py-1 rounded"
                                >
                                  <i className="fas fa-redo"></i>
                                </button>
                                <button
                                  onClick={() => handleEditPatient(patient)}
                                  title="تعديل"
                                  className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded"
                                >
                                  <i className="fas fa-edit"></i>
                                </button>
                                <button
                                  onClick={() => handleDeletePatient(session.id, patient.id)}
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
                </>
              )}
            </div>
          );
        })}

        {sessions.length === 0 && (
          <div className="p-8 text-center text-gray-500 bg-white rounded-lg">
            <i className="fas fa-check-circle text-4xl text-green-500 mb-4"></i>
            <p className="text-lg">لا توجد مهام فاشلة - جميع المهام تعمل بشكل صحيح!</p>
          </div>
        )}
      </div>
    </div>
  );
}
