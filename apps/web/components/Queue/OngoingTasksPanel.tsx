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

export default function OngoingTasksPanel() {
  const { openModal } = useModal();
  const { addToast } = useUI();
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set(['SES-15-JAN-001']));
  const [selectedPatients, setSelectedPatients] = useState<Map<string, Set<number>>>(new Map());
  const [pausedSessions, setPausedSessions] = useState<Set<string>>(new Set(['SES-15-JAN-002'])); // Track paused sessions
  const [showMessage, setShowMessage] = useState(true); // Toggle for message column visibility
  const [sessions, setSessions] = useState<Session[]>([
    {
      id: '1',
      sessionId: 'SES-15-JAN-001',
      clinicName: 'عيادة أحمد محمد',
      doctorName: 'د. أحمد محمد',
      createdAt: '2025-01-15 14:30:25',
      totalPatients: 50,
      sentCount: 15,
      failedCount: 4,
      isPaused: false,
      patients: [
        { id: 1, name: 'أحمد محمد', phone: '01012345678', countryCode: '+20', queue: 1, status: 'تم', failedAttempts: 0, isPaused: false },
        { id: 2, name: 'فاطمة علي', phone: '01087654321', countryCode: '+20', queue: 2, status: 'جاري', failedAttempts: 0, isPaused: false },
        { id: 3, name: 'محمود حسن', phone: '01098765432', countryCode: '+20', queue: 3, status: 'فشل', failedAttempts: 2, isPaused: false },
        { id: 4, name: 'نور الدين', phone: '01011223344', countryCode: '+20', queue: 4, status: 'تم', failedAttempts: 0, isPaused: false },
        { id: 5, name: 'سارة إبراهيم', phone: '01055667788', countryCode: '+20', queue: 5, status: 'قيد الانتظار', failedAttempts: 0, isPaused: false },
      ],
    },
    {
      id: '2',
      sessionId: 'SES-15-JAN-002',
      clinicName: 'عيادة فاطمة علي',
      doctorName: 'د. فاطمة علي',
      createdAt: '2025-01-15 15:00:00',
      totalPatients: 30,
      sentCount: 25,
      failedCount: 2,
      isPaused: true,
      patients: [
        { id: 6, name: 'علي حسن', phone: '01098765432', countryCode: '+20', queue: 1, status: 'تم', failedAttempts: 0, isPaused: true },
        { id: 7, name: 'ليلى محمد', phone: '01055667788', countryCode: '+20', queue: 2, status: 'تم', failedAttempts: 0, isPaused: true },
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

  const getProgressPercentage = (session: Session) => {
    return Math.round((session.sentCount / session.totalPatients) * 100);
  };

  const toggleSessionPause = (sessionId: string) => {
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
  };

  const pauseAllSessions = () => {
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
  };

  const resumeAllSessions = () => {
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
  };

  // Check if ANY patient across ALL sessions is paused
  const hasAnyPausedPatient = sessions.some((session) =>
    session.patients.some((patient) => patient.isPaused)
  );

  const togglePatientPause = (sessionId: string, patientId: number) => {
    setSessions((prev) =>
      prev.map((s) =>
        s.id === sessionId
          ? {
              ...s,
              patients: s.patients.map((p) =>
                p.id === patientId ? { ...p, isPaused: !p.isPaused } : p
              ),
            }
          : s
      )
    );
  };

  const deleteSession = (sessionId: string) => {
    const ok = window.confirm('هل أنت متأكد من حذف هذه الجلسة؟');
    if (ok) {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setSelectedPatients((prev) => {
        const newMap = new Map(prev);
        newMap.delete(sessionId);
        return newMap;
      });
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
        title="المهام الجارية" 
        description="مراقبة وإدارة جميع المهام الجارية حالياً"
      />

      <StatsSection 
        gradient="bg-gradient-to-br from-blue-500 to-blue-600"
        stats={[
          {
            label: 'إجمالي الجلسات الجارية',
            value: sessions.length,
            icon: 'tasks'
          },
          {
            label: 'إجمالي الرسائل المرسلة',
            value: sessions.reduce((sum, s) => sum + s.sentCount, 0),
            icon: 'check-circle'
          },
          {
            label: 'إجمالي المرضى المتبقيين',
            value: sessions.reduce((sum, s) => sum + (s.totalPatients - s.sentCount), 0),
            icon: 'users'
          }
        ]}
      />

      <div className="flex items-center justify-between mb-6">
        <div></div>
        <div className="flex gap-3">
          <button
            onClick={pauseAllSessions}
            disabled={hasAnyPausedPatient}
            className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            <i className="fas fa-pause-circle"></i>
            <span>إيقاف مؤقت للكل</span>
          </button>
          {hasAnyPausedPatient && (
            <button
              onClick={resumeAllSessions}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <i className="fas fa-play-circle"></i>
              <span>استئناف الكل</span>
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4">
        {sessions.map((session) => {
          const isExpanded = expandedSessions.has(session.id);
          const progressPercent = getProgressPercentage(session);
          const selectedCount = selectedPatients.get(session.id)?.size || 0;

          return (
            <div key={session.id} className="bg-white rounded-lg shadow overflow-hidden">
              {/* Session Header */}
              <div
                className={`px-6 py-4 border-b flex items-center justify-between ${
                  session.isPaused
                    ? 'bg-gradient-to-r from-yellow-50 to-amber-50 cursor-default'
                    : 'bg-gradient-to-r from-blue-50 to-purple-50 cursor-pointer hover:bg-blue-100 transition-colors'
                }`}
              >
                <div
                  className="flex items-center gap-4 flex-1"
                  onClick={() => toggleSessionExpand(session.id)}
                >
                  <button className={`${session.isPaused ? 'text-yellow-600' : 'text-blue-600'} hover:${session.isPaused ? 'text-yellow-800' : 'text-blue-800'} text-xl`}>
                    <i className={`fas fa-chevron-${isExpanded ? 'down' : 'left'}`}></i>
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-gray-900 text-lg">{session.clinicName}</h3>
                      {session.isPaused && (
                        <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-xs font-medium">
                          ⏸️ موقوف مؤقتاً
                        </span>
                      )}
                    </div>
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
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-700 mb-2">
                      تقدم الإرسال
                    </div>
                    <div className="text-xs text-gray-600">
                      تم معالجة {session.sentCount} من {session.totalPatients} رسالة, منهم {session.failedCount} محاولات فاشلة
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSessionPause(session.id);
                      }}
                      className={`px-3 py-2 rounded flex items-center gap-2 whitespace-nowrap ${
                        session.isPaused
                          ? 'bg-green-50 text-green-600 hover:bg-green-100'
                          : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
                      }`}
                      title={session.isPaused ? 'استئناف هذه الجلسة' : 'إيقاف هذه الجلسة مؤقتاً'}
                    >
                      <i className={`fas fa-${session.isPaused ? 'play-circle' : 'pause-circle'}`}></i>
                      <span className="text-sm">{session.isPaused ? 'استئناف' : 'إيقاف'}</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(session.id);
                      }}
                      className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-2 rounded flex items-center gap-2 whitespace-nowrap"
                      title="حذف هذه الجلسة"
                    >
                      <i className="fas fa-trash"></i>
                      <span className="text-sm">حذف</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="px-6 py-3 bg-gray-50 border-b">
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-green-500 to-green-600 h-full transition-all"
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  {progressPercent}% مكتمل ({session.sentCount}/{session.totalPatients})
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <>
                  {/* Selected Patients Info & Delete Button */}
                  {session.patients.length > 0 && (
                    <div className="px-6 py-3 bg-gray-50 border-b flex items-center justify-between">
                      <span className="text-sm text-gray-600">
                        {selectedCount > 0 ? `تم تحديد ${selectedCount} مريض` : ''}
                      </span>
                      <button
                        onClick={() => deleteSelectedPatients(session.id)}
                        disabled={selectedCount === 0}
                        className="bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1 rounded text-sm disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
                      >
                        <i className="fas fa-trash ml-1"></i>
                        حذف {selectedCount} مريض محدد
                      </button>
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
                              <span>الحالة</span>
                            </div>
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
                            className={`border-b transition-colors ${
                              patient.isPaused
                                ? 'bg-yellow-50 opacity-60'
                                : selectedPatients.get(session.id)?.has(patient.id)
                                ? 'bg-blue-50 hover:bg-blue-100'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <td className="px-6 py-3">
                              <input
                                type="checkbox"
                                checked={selectedPatients.get(session.id)?.has(patient.id) || false}
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
                              <span
                                className={`px-3 py-1 rounded-full text-xs font-medium ${
                                  patient.status === 'تم'
                                    ? 'bg-green-100 text-green-800'
                                    : patient.status === 'فشل'
                                    ? 'bg-red-100 text-red-800'
                                    : patient.status === 'جاري'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {patient.status}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-sm">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => togglePatientPause(session.id, patient.id)}
                                  title={patient.isPaused ? 'استئناف' : 'إيقاف مؤقت'}
                                  className={`px-2 py-1 rounded ${
                                    patient.isPaused
                                      ? 'bg-green-50 text-green-600 hover:bg-green-100'
                                      : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
                                  }`}
                                >
                                  <i className={`fas fa-${patient.isPaused ? 'play' : 'pause'}`}></i>
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
            <i className="fas fa-inbox text-4xl mb-4"></i>
            <p>لا توجد مهام جارية حالياً</p>
          </div>
        )}
      </div>
    </div>
  );
}
