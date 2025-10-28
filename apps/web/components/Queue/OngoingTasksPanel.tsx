'use client';

import { useState, useCallback, useMemo } from 'react';
import { useModal } from '@/contexts/ModalContext';
import { useUI } from '@/contexts/UIContext';
import { MOCK_ONGOING_SESSIONS } from '@/constants/mockData';
import { PanelWrapper } from '@/components/Common/PanelWrapper';
import { PanelHeader } from '@/components/Common/PanelHeader';
import { ResponsiveTable } from '@/components/Common/ResponsiveTable';
import { EmptyState } from '@/components/Common/EmptyState';
import UsageGuideSection from '@/components/Common/UsageGuideSection';
import { Badge } from '@/components/Common/ResponsiveUI';

interface Patient {
  id: number;
  name: string;
  phone: string;
  countryCode?: string;
  queue?: number;
  status: string;
  failedAttempts: number;
  isPaused?: boolean;
}

interface Session {
  id: string;
  sessionId: string;
  clinicName: string;
  doctorName: string;
  createdAt: string;
  totalPatients: number;
  sentCount: number;
  failedCount: number;
  patients: Patient[];
  isPaused?: boolean;
}

const ONGOING_TASKS_GUIDE_ITEMS = [
  {
    title: '',
    description: 'يمكنك إيقاف أو استئناف جلسة واحدة أو جميع الجلسات من الأزرار العلوية'
  },
  {
    title: '',
    description: 'لاحظ شريط التقدم الذي يوضح نسبة الرسائل المرسلة من إجمالي المرضى'
  },
  {
    title: '',
    description: 'حدد عدة مرضى وامسح أو عدل بيانات عدة مرضى في نفس الوقت'
  },
  {
    title: '',
    description: 'الجلسات الموقوفة تظهر بخلفية صفراء/برتقالية للدلالة على الحالة الموقوفة'
  },
];

export default function OngoingTasksPanel() {
  const { openModal } = useModal();
  const { addToast } = useUI();
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set(['SES-15-JAN-001']));
  const [selectedPatients, setSelectedPatients] = useState<Map<string, Set<number>>>(new Map());
  const [pausedSessions, setPausedSessions] = useState<Set<string>>(new Set(['SES-15-JAN-002']));
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const [sessions, setSessions] = useState<Session[]>(MOCK_ONGOING_SESSIONS as Session[]);

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
   * Delete selected patients from session - memoized
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
   * Get progress percentage - memoized
   */
  const getProgressPercentage = useCallback((session: Session) => {
    return Math.round((session.sentCount / session.totalPatients) * 100);
  }, []);

  /**
   * Toggle session pause - memoized
   */
  const toggleSessionPause = useCallback((sessionId: string) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              isPaused: !s.isPaused,
              patients: s.patients.map((p) => ({
                ...p,
                isPaused: !s.isPaused,
              })),
            }
          : s
      )
    );

    setPausedSessions((prev) => {
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
   * Pause all sessions - memoized
   */
  const pauseAllSessions = useCallback(() => {
    setSessions((prev) =>
      prev.map((s) => ({
        ...s,
        isPaused: true,
        patients: s.patients.map((p) => ({
          ...p,
          isPaused: true,
        })),
      }))
    );

    setPausedSessions(new Set(sessions.map((s) => s.id)));
    addToast('تم إيقاف جميع الجلسات', 'success');
  }, [sessions, addToast]);

  /**
   * Resume all sessions - memoized
   */
  const resumeAllSessions = useCallback(() => {
    setSessions((prev) =>
      prev.map((s) => ({
        ...s,
        isPaused: false,
        patients: s.patients.map((p) => ({
          ...p,
          isPaused: false,
        })),
      }))
    );

    setPausedSessions(new Set());
    addToast('تم استئناف جميع الجلسات', 'success');
  }, [addToast]);

  /**
   * Toggle patient pause - memoized
   */
  const togglePatientPause = useCallback((sessionId: string, patientId: number) => {
    setSessions((prev) =>
      prev.map((s) => {
        if (s.id !== sessionId) return s;

        const updatedPatients = s.patients.map((p) =>
          p.id === patientId ? { ...p, isPaused: !p.isPaused } : p
        );

        const allPatientsPaused = updatedPatients.every((p) => p.isPaused);

        return {
          ...s,
          patients: updatedPatients,
          isPaused: allPatientsPaused,
        };
      })
    );
  }, []);

  /**
   * Delete session - memoized
   */
  const deleteSession = useCallback((sessionId: string) => {
    const ok = window.confirm('هل أنت متأكد من حذف هذه الجلسة؟');
    if (ok) {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setSelectedPatients((prev) => {
        const newMap = new Map(prev);
        newMap.delete(sessionId);
        return newMap;
      });
      addToast('تم حذف الجلسة بنجاح', 'success');
    }
  }, [addToast]);

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
      label: 'إجمالي الجلسات الجارية',
      value: sessions.length.toString(),
      icon: 'fa-tasks',
    },
    {
      label: 'الرسائل المرسلة',
      value: sessions.reduce((sum, s) => sum + s.sentCount, 0).toString(),
      icon: 'fa-check-circle',
    },
    {
      label: 'المرضى المتبقيين',
      value: sessions.reduce((sum, s) => sum + (s.totalPatients - s.sentCount), 0).toString(),
      icon: 'fa-users',
    },
  ], [sessions]);

  /**
   * Memoize computed flags
   */
  const { hasAnyPausedPatient, areAllSessionsPaused } = useMemo(() => {
    const hasAnyPaused = sessions.some((session) =>
      session.patients.some((patient) => patient.isPaused)
    );
    const allPaused = sessions.length > 0 && sessions.every((session) =>
      session.patients.every((patient) => patient.isPaused)
    );
    return { hasAnyPausedPatient: hasAnyPaused, areAllSessionsPaused: allPaused };
  }, [sessions]);

  /**
   * Memoize table columns for each session
   */
  const tableColumns = useMemo(() => [
    { key: 'checkbox', label: '', width: '5%' },
    { key: 'name', label: 'الاسم', width: '25%' },
    { key: 'phone', label: 'رقم الجوال', width: '20%' },
    { key: 'status', label: 'الحالة', width: '20%' },
    { key: 'failedAttempts', label: 'المحاولات الفاشلة', width: '15%' },
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
    status: (
      <div className="flex gap-2">
        <Badge
          color={patient.isPaused ? 'yellow' : 'green'}
          label={patient.isPaused ? '⏸️ موقوف' : '✓ نشط'}
        />
      </div>
    ),
    failedAttempts: (
      <span
        className={`px-3 py-1 rounded-full text-sm font-medium ${
          patient.failedAttempts > 0
            ? 'bg-red-100 text-red-700'
            : 'bg-green-100 text-green-700'
        }`}
      >
        {patient.failedAttempts}
      </span>
    ),
    actions: (
      <div className="flex gap-2 justify-start">
        <button
          onClick={() =>
            togglePatientPause(sessionId, patient.id)
          }
          className={`px-2 py-1 rounded text-sm ${
            patient.isPaused
              ? 'bg-green-50 text-green-600 hover:bg-green-100'
              : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
          }`}
          title={patient.isPaused ? 'استئناف' : 'إيقاف'}
        >
          <i className={`fas fa-${patient.isPaused ? 'play' : 'pause'}`}></i>
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
  }), [selectedPatients, togglePatientSelection, togglePatientPause, handleEditPatient, handleDeletePatient]);

  if (sessions.length === 0) {
    return (
      <PanelWrapper>
        <PanelHeader
          title="المهام الجارية"
          icon="fa-tasks"
          description="مراقبة وإدارة جميع المهام الجارية حالياً"
          stats={stats}
        />
        <EmptyState
          icon="fa-inbox"
          title="لا توجد مهام جارية"
          message="جميع المهام إما مكتملة أو لم تبدأ بعد"
          actionLabel="العودة للصفحة الرئيسية"
          onAction={() => window.history.back()}
        />
      </PanelWrapper>
    );
  }

  return (
    <PanelWrapper>
      <PanelHeader
        title={`المهام الجارية ${sessions.length > 0 ? `- ${sessions[0].doctorName}` : ''}`}
        icon="fa-tasks"
        description={`مراقبة وإدارة جميع المهام الجارية حالياً - ${sessions.length} جلسة`}
        stats={stats}
      />

      {/* Action Buttons */}
      <div className="flex gap-3 mb-6 justify-end flex-wrap">
        <button
          onClick={pauseAllSessions}
          disabled={areAllSessionsPaused}
          className={`px-6 py-3 rounded-lg transition-all flex items-center gap-2 font-medium ${
            areAllSessionsPaused
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:from-orange-600 hover:to-orange-700 shadow-md hover:shadow-lg'
          }`}
        >
          <i className="fas fa-pause-circle"></i>
          <span>إيقاف الكل</span>
        </button>
        <button
          onClick={resumeAllSessions}
          disabled={!hasAnyPausedPatient}
          className={`px-6 py-3 rounded-lg transition-all flex items-center gap-2 font-medium ${
            !hasAnyPausedPatient
              ? 'bg-gray-400 text-white cursor-not-allowed'
              : 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 shadow-md hover:shadow-lg'
          }`}
        >
          <i className="fas fa-play-circle"></i>
          <span>استئناف الكل</span>
        </button>
      </div>

      {/* Sessions List */}
      <div className="space-y-4">
        {sessions.map((session) => {
          const isExpanded = expandedSessions.has(session.id);
          const progressPercent = getProgressPercentage(session);
          const selectedCount = selectedPatients.get(session.id)?.size || 0;

          return (
            <div
              key={session.id}
              className="bg-white rounded-lg shadow overflow-hidden border"
            >
              {/* Session Header - Fully Clickable */}
              <div
                className={`px-6 py-4 border-b cursor-pointer transition-colors ${
                  session.isPaused
                    ? 'bg-gradient-to-r from-yellow-100 to-orange-50'
                    : 'bg-gradient-to-r from-blue-50 to-purple-50 hover:from-blue-100 hover:to-purple-100'
                }`}
                onClick={() => toggleSessionExpand(session.id)}
              >
                <div className="flex items-center gap-4 justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    {/* Collapse Button with Improved UI */}
                    <div className="flex items-center gap-2">
                      <button className={`text-xl transition-transform duration-300 ${session.isPaused ? 'text-yellow-600' : 'text-blue-600'}`}>
                        <i className={`fas fa-chevron-${isExpanded ? 'down' : 'left'}`}></i>
                      </button>
                      <span className={`text-sm font-medium whitespace-nowrap ${session.isPaused ? 'text-yellow-600' : 'text-blue-600'}`}>القائمة</span>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-gray-900 text-lg">{session.clinicName}</h3>
                        {session.isPaused && (
                          <Badge color="yellow" label="⏸️ موقوف مؤقتاً" />
                        )}
                      </div>
                      <div className="text-sm text-gray-600 mt-2">
                        <span>جلسة: <strong>{session.sessionId}</strong></span>
                        <span className="mx-4">وقت الإنشاء: <strong>{session.createdAt}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Progress Bar */}
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-700 mb-1">تقدم الإرسال</div>
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            session.isPaused
                              ? 'bg-yellow-500'
                              : progressPercent === 100
                              ? 'bg-green-500'
                              : 'bg-blue-500'
                          }`}
                          style={{ width: `${progressPercent}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-600 mt-1">{progressPercent}%</div>
                    </div>

                    {/* Session Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSessionPause(session.id);
                        }}
                        className={`px-3 py-2 rounded text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-all ${
                          session.isPaused
                            ? 'bg-green-500 text-white hover:bg-green-600'
                            : 'bg-yellow-500 text-white hover:bg-yellow-600'
                        }`}
                      >
                        <i className={`fas fa-${session.isPaused ? 'play' : 'pause'}`}></i>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSession(session.id);
                        }}
                        className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-2 rounded text-sm"
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
                  {/* Session Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-white rounded-lg p-4 border border-blue-200">
                      <div className="text-sm text-gray-600">إجمالي المرضى</div>
                      <div className="text-2xl font-bold text-blue-600">{session.totalPatients}</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-green-200">
                      <div className="text-sm text-gray-600">الرسائل المرسلة</div>
                      <div className="text-2xl font-bold text-green-600">{session.sentCount}</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-red-200">
                      <div className="text-sm text-gray-600">الفاشلة</div>
                      <div className="text-2xl font-bold text-red-600">{session.failedCount}</div>
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
                        <h4 className="font-bold text-gray-800">قائمة المرضى</h4>
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
                        <i className="fas fa-inbox text-3xl mb-2 opacity-50"></i>
                        <p>لا يوجد مرضى في هذه الجلسة</p>
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
                                  className={`border-b hover:bg-gray-50 transition-colors ${
                                    patient.isPaused ? 'bg-yellow-50' : ''
                                  }`}
                                >
                                  <td className="px-6 py-3 text-sm">{row.checkbox}</td>
                                  <td className="px-6 py-3 text-sm text-gray-900 font-medium">{row.name}</td>
                                  <td className="px-6 py-3 text-sm text-gray-600">{row.phone}</td>
                                  <td className="px-6 py-3 text-sm">{row.status}</td>
                                  <td className="px-6 py-3 text-sm">{row.failedAttempts}</td>
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
          items={ONGOING_TASKS_GUIDE_ITEMS}
        />
      </div>
    </PanelWrapper>
  );
}
