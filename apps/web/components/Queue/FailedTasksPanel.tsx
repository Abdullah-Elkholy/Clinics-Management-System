'use client';

import { useState, useCallback, useMemo } from 'react';
import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { MOCK_FAILED_SESSIONS } from '@/constants/mockData';
import { PanelWrapper } from '@/components/Common/PanelWrapper';
import { PanelHeader } from '@/components/Common/PanelHeader';
import { ResponsiveTable } from '@/components/Common/ResponsiveTable';
import { EmptyState } from '@/components/Common/EmptyState';
import { Badge } from '@/components/Common/ResponsiveUI';
import UsageGuideSection from '@/components/Common/UsageGuideSection';

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

const FAILED_TASKS_GUIDE_ITEMS = [
  {
    title: '',
    description: 'كل محاولة إعادة تزيد عداد المحاولات'
  },
  {
    title: '',
    description: 'يمكنك تحديد عدد من المرضى برسائلهم وإعادة محاولة جميعها'
  },
  {
    title: '',
    description: 'حذف المريض يزيل الفشل النهائي من السجل'
  },
  {
    title: '',
    description: 'الرسائل الفاشلة قد تكون بسبب رقم جوال خاطئ أو مشكلة اتصال'
  },
];

export default function FailedTasksPanel() {
  const { openModal } = useModal();
  const { addToast } = useUI();
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set(['SES-15-JAN-001']));
  const [selectedPatients, setSelectedPatients] = useState<Map<string, Set<number>>>(new Map());
  const [sessions, setSessions] = useState<Session[]>(MOCK_FAILED_SESSIONS as Session[]);

  /**
   * Toggle session expand - memoized
   */
  const toggleSessionExpand = useCallback((sessionId: string) => {
    setExpandedSessions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  }, []);

  /**
   * Toggle patient selection - memoized
   */
  const togglePatientSelection = useCallback((sessionId: string, patientId: number) => {
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
  }, []);

  /**
   * Toggle all patients in session - memoized
   */
  const toggleAllPatients = useCallback((sessionId: string) => {
    setSelectedPatients((prev) => {
      const newMap = new Map(prev);
      const session = sessions.find((s) => s.id === sessionId);
      if (!session) return newMap;

      const sessionSet = newMap.get(sessionId) || new Set();
      const allPatientIds = session.patients.map((p) => p.id);

      // If all are selected, deselect all. Otherwise, select all.
      if (sessionSet.size === allPatientIds.length) {
        newMap.delete(sessionId);
      } else {
        newMap.set(sessionId, new Set(allPatientIds));
      }
      return newMap;
    });
  }, [sessions]);

  /**
   * Delete selected patients - memoized
   */
  const deleteSelectedPatients = useCallback((sessionId: string) => {
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

    addToast(`تم حذف ${selected.size} مريض`, 'success');
  }, [selectedPatients, addToast]);

  /**
   * Retry selected patients - memoized
   */
  const retrySelectedPatients = useCallback((sessionId: string) => {
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

    addToast(`تم إعادة محاولة ${selected.size} مريض`, 'success');
  }, [selectedPatients, addToast]);

  /**
   * Retry single patient - memoized
   */
  const retrySinglePatient = useCallback((sessionId: string, patientId: number) => {
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
  }, [addToast]);

  /**
   * Retry all patients - memoized
   */
  const retryAllPatients = useCallback(() => {
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
    addToast('تم إعادة محاولة جميع المرضى', 'success');
  }, [addToast]);

  /**
   * Delete all patients - memoized
   */
  const deleteAllPatients = useCallback(() => {
    const ok = window.confirm('هل أنت متأكد من حذف جميع المهام الفاشلة؟');
    if (ok) {
      setSessions([]);
      setSelectedPatients(new Map());
      addToast('تم حذف جميع المهام الفاشلة', 'success');
    }
  }, [addToast]);

  /**
   * Delete single session - memoized
   */
  const deleteSession = useCallback((sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    const ok = window.confirm(`هل أنت متأكد من حذف جلسة ${session?.clinicName}؟`);
    if (ok) {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setSelectedPatients((prev) => {
        const newMap = new Map(prev);
        newMap.delete(sessionId);
        return newMap;
      });
      addToast(`تم حذف جلسة ${session?.clinicName}`, 'success');
    }
  }, [sessions, addToast]);

  /**
   * Edit patient - memoized
   */
  const handleEditPatient = useCallback((patient: Patient) => {
    openModal('editPatient', { patient, onSave: handleSaveEditedPatient });
  }, [openModal]);

  /**
   * Save edited patient - memoized
   */
  const handleSaveEditedPatient = useCallback((updatedPatient: Patient) => {
    setSessions((prev) =>
      prev.map((s) => ({
        ...s,
        patients: s.patients.map((p) =>
          p.id === updatedPatient.id ? updatedPatient : p
        ),
      }))
    );
    addToast('تم تحديث بيانات المريض بنجاح', 'success');
  }, [addToast]);

  /**
   * Delete patient - memoized
   */
  const handleDeletePatient = useCallback((sessionId: string, patientId: number) => {
    const ok = window.confirm('هل أنت متأكد من حذف هذا المريض؟');
    if (ok) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                patients: s.patients.filter((p) => p.id !== patientId),
                failedCount: s.failedCount - 1,
              }
            : s
        )
      );
      addToast('تم حذف المريض بنجاح', 'success');
    }
  }, [addToast]);

  /**
   * Memoize computed stats
   */
  const stats = useMemo(() => [
    {
      label: 'الجلسات بها فشل',
      value: sessions.length.toString(),
      icon: 'fa-exclamation-circle',
    },
    {
      label: 'الرسائل الفاشلة',
      value: sessions.reduce((sum, s) => sum + s.failedCount, 0).toString(),
      icon: 'fa-times-circle',
    },
    {
      label: 'إجمالي المرضى',
      value: sessions.reduce((sum, s) => sum + s.patients.length, 0).toString(),
      icon: 'fa-users',
    },
  ], [sessions]);

  /**
   * Memoize table columns
   */
  const tableColumns = useMemo(() => [
    { key: 'checkbox', label: '', width: '5%' },
    { key: 'name', label: 'الاسم', width: '20%' },
    { key: 'phone', label: 'رقم الجوال', width: '20%' },
    { key: 'reason', label: 'سبب الفشل', width: '25%' },
    { key: 'retries', label: 'عدد المحاولات', width: '15%' },
    { key: 'actions', label: 'الإجراءات', width: '15%' },
  ], []);

  /**
   * Render patient row
   */
  const renderPatientRow = useCallback((patient: Patient, sessionId: string) => ({
    id: patient.id,
    checkbox: (
      <input
        type="checkbox"
        checked={selectedPatients.get(sessionId)?.has(patient.id) || false}
        onChange={() => togglePatientSelection(sessionId, patient.id)}
        className="w-4 h-4 rounded cursor-pointer"
      />
    ),
    name: patient.name,
    phone: `${patient.countryCode || '+966'} ${patient.phone}`,
    reason: (
      <span className="text-red-700 font-medium text-sm">{patient.failedReason}</span>
    ),
    retries: (
      <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-medium">
        {patient.retryCount}
      </span>
    ),
    actions: (
      <div className="flex gap-2 justify-start">
        <button
          onClick={() => retrySinglePatient(sessionId, patient.id)}
          className="bg-orange-50 text-orange-600 hover:bg-orange-100 px-2 py-1 rounded text-sm"
          title="إعادة محاولة"
        >
          <i className="fas fa-redo"></i>
        </button>
        <button
          onClick={() => handleEditPatient(patient)}
          className="bg-blue-50 text-blue-600 hover:bg-blue-100 px-2 py-1 rounded text-sm"
          title="تعديل"
        >
          <i className="fas fa-edit"></i>
        </button>
        <button
          onClick={() => handleDeletePatient(sessionId, patient.id)}
          className="bg-red-50 text-red-600 hover:bg-red-100 px-2 py-1 rounded text-sm"
          title="حذف"
        >
          <i className="fas fa-trash"></i>
        </button>
      </div>
    ),
  }), [selectedPatients, togglePatientSelection, retrySinglePatient, handleEditPatient, handleDeletePatient]);

  if (sessions.length === 0) {
    return (
      <PanelWrapper>
        <PanelHeader
          title="المهام الفاشلة"
          icon="fa-exclamation-circle"
          description="عرض وإدارة المهام التي فشلت وتحتاج إلى إعادة محاولة"
          stats={stats}
        />
        <EmptyState
          icon="fa-check-circle"
          title="لا توجد مهام فاشلة"
          message="جميع المهام تمت معالجتها بنجاح"
          actionLabel="العودة للصفحة الرئيسية"
          onAction={() => window.history.back()}
        />
      </PanelWrapper>
    );
  }

  return (
    <PanelWrapper>
      <PanelHeader
        title={`المهام الفاشلة ${sessions.length > 0 ? `- ${sessions[0].doctorName}` : ''}`}
        icon="fa-exclamation-circle"
        description={`عرض وإدارة المهام التي فشلت وتحتاج إلى إعادة محاولة - ${sessions.length} جلسة`}
        stats={stats}
      />

      {/* Action Buttons */}
      <div className="flex gap-3 mb-6 justify-end flex-wrap">
        <button
          onClick={retryAllPatients}
          disabled={sessions.length === 0 || sessions.every((s) => s.patients.length === 0)}
          className={`px-6 py-3 rounded-lg transition-all flex items-center gap-2 font-medium ${
            sessions.length === 0 || sessions.every((s) => s.patients.length === 0)
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 shadow-md hover:shadow-lg'
          }`}
        >
          <i className="fas fa-redo-alt"></i>
          <span>إعادة محاولة الكل</span>
        </button>
        <button
          onClick={deleteAllPatients}
          disabled={sessions.length === 0 || sessions.every((s) => s.patients.length === 0)}
          className={`px-6 py-3 rounded-lg transition-all flex items-center gap-2 font-medium ${
            sessions.length === 0 || sessions.every((s) => s.patients.length === 0)
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 shadow-md hover:shadow-lg'
          }`}
        >
          <i className="fas fa-trash"></i>
          <span>حذف الكل</span>
        </button>
      </div>

      {/* Sessions List */}
      <div className="space-y-4">
        {sessions.map((session) => {
          const isExpanded = expandedSessions.has(session.id);
          const selectedCount = selectedPatients.get(session.id)?.size || 0;

          return (
            <div
              key={session.id}
              className="bg-white rounded-lg shadow overflow-hidden border border-red-200"
            >
              {/* Session Header - Fully Clickable */}
              <div
                className="px-6 py-4 border-b bg-gradient-to-r from-red-50 to-orange-50 cursor-pointer hover:from-red-100 hover:to-orange-100 transition-colors"
                onClick={() => toggleSessionExpand(session.id)}
              >
                <div className="flex items-center gap-4 justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    {/* Collapse Button with Improved UI */}
                    <div className="flex items-center gap-2">
                      <button className="text-red-600 text-xl transition-transform duration-300">
                        <i className={`fas fa-chevron-${isExpanded ? 'down' : 'left'}`}></i>
                      </button>
                      <span className="text-sm font-medium text-red-600 whitespace-nowrap">القائمة</span>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-gray-900 text-lg">{session.clinicName}</h3>
                      </div>
                      <div className="text-sm text-gray-600 mt-2">
                        <span>جلسة: <strong>{session.sessionId}</strong></span>
                        <span className="mx-4">وقت الإنشاء: <strong>{session.createdAt}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Failed Count Badge */}
                    <div className="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-center">
                      <div className="text-sm font-medium">مرضى فاشلة</div>
                      <div className="text-2xl font-bold">{session.failedCount}</div>
                    </div>

                    {/* Session Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          retryAllPatients();
                        }}
                        className="bg-orange-500 text-white hover:bg-orange-600 px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors"
                        title="إعادة محاولة جميع المرضى"
                      >
                        <i className="fas fa-redo-alt"></i>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSession(session.id);
                        }}
                        className="bg-red-500 text-white hover:bg-red-600 px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors"
                        title="حذف جلسة"
                      >
                        <i className="fas fa-trash"></i>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Session Content (Expandable) */}
              {isExpanded && (
                <div className="p-6 bg-gray-50">
                  {/* Session Summary */}
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-white rounded-lg p-4 border border-red-200">
                      <div className="text-sm text-gray-600">إجمالي المرضى في الجلسة الأصلية</div>
                      <div className="text-2xl font-bold text-red-600">{session.totalPatients}</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-orange-200">
                      <div className="text-sm text-gray-600">الرسائل الفاشلة</div>
                      <div className="text-2xl font-bold text-orange-600">{session.failedCount}</div>
                    </div>
                  </div>

                  {/* Patients Table */}
                  <div className="bg-white rounded-lg overflow-hidden border">
                    <div className="px-6 py-4 bg-gray-50 border-b flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          onClick={() => toggleAllPatients(session.id)}
                          className="relative w-5 h-5 border-2 rounded cursor-pointer transition-all"
                          style={{
                            borderColor: selectedCount === 0 ? '#d1d5db' : selectedCount === session.totalPatients ? '#3b82f6' : '#f59e0b',
                            backgroundColor: selectedCount === 0 ? 'white' : selectedCount === session.totalPatients ? '#3b82f6' : '#fef3c7',
                          }}
                          title={selectedCount === 0 ? 'تحديد الكل' : selectedCount === session.totalPatients ? 'إلغاء التحديد' : 'تحديد الكل'}
                        >
                          {selectedCount > 0 && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <i
                                className={`fas text-white text-xs ${
                                  selectedCount === session.totalPatients ? 'fa-check' : 'fa-minus'
                                }`}
                              ></i>
                            </div>
                          )}
                        </div>
                        <h4 className="font-bold text-gray-800">قائمة المرضى الفاشلة</h4>
                        <span className="text-sm text-gray-600">
                          {selectedCount} من {session.totalPatients} محدد
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {selectedCount > 0 && (
                          <>
                            <button
                              onClick={() => setSelectedPatients(new Map(selectedPatients).set(session.id, new Set()))}
                              className="text-sm text-red-600 hover:text-red-800"
                            >
                              إلغاء التحديد
                            </button>
                            <button
                              onClick={() => retrySelectedPatients(session.id)}
                              className="text-sm bg-orange-600 text-white px-3 py-1 rounded hover:bg-orange-700"
                            >
                              إعادة محاولة ({selectedCount})
                            </button>
                            <button
                              onClick={() => deleteSelectedPatients(session.id)}
                              className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700"
                            >
                              حذف ({selectedCount})
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {session.patients.length === 0 ? (
                      <div className="p-8 text-center text-gray-600">
                        <i className="fas fa-check-circle text-3xl mb-2 text-green-600"></i>
                        <p>لا يوجد مرضى فاشلة في هذه الجلسة</p>
                      </div>
                    ) : (
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
                            {session.patients.map((patient) => {
                              const row = renderPatientRow(patient, session.id);
                              return (
                                <tr
                                  key={patient.id}
                                  className="border-b hover:bg-gray-50 transition-colors"
                                >
                                  <td className="px-6 py-3 text-sm">{row.checkbox}</td>
                                  <td className="px-6 py-3 text-sm text-gray-900 font-medium">{row.name}</td>
                                  <td className="px-6 py-3 text-sm text-gray-600">{row.phone}</td>
                                  <td className="px-6 py-3 text-sm">{row.reason}</td>
                                  <td className="px-6 py-3 text-sm">{row.retries}</td>
                                  <td className="px-6 py-3 text-sm">{row.actions}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-6 pb-6">
        <UsageGuideSection
          items={FAILED_TASKS_GUIDE_ITEMS}
        />
      </div>
    </PanelWrapper>
  );
}
