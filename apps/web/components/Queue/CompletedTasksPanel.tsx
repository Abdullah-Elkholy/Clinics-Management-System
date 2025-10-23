'use client';

import { useState } from 'react';
import SharedHeader from './SharedHeader';
import StatsSection from './StatsSection';

interface Patient {
  id: number;
  name: string;
  phone: string;
  countryCode?: string;
  queue?: number;
  status: string;
  completedAt?: string;
}

interface Session {
  id: string;
  sessionId: string;
  clinicName: string;
  doctorName: string;
  createdAt: string;
  totalPatients: number;
  sentCount: number;
  completedAt: string;
  patients: Patient[];
}

export default function CompletedTasksPanel() {
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [selectedPatients, setSelectedPatients] = useState<Map<string, Set<number>>>(new Map());
  const [showMessage, setShowMessage] = useState(true);
  const [sessions, setSessions] = useState<Session[]>([
    {
      id: '1',
      sessionId: 'SES-15-JAN-003',
      clinicName: 'عيادة محمد الشرقاوي',
      doctorName: 'د. محمد الشرقاوي',
      createdAt: '2025-01-14 10:30:00',
      completedAt: '2025-01-14 12:45:25',
      totalPatients: 25,
      sentCount: 25,
      patients: [
        { id: 1, name: 'أحمد محمد', phone: '01012345678', countryCode: '+20', queue: 1, status: 'تم', completedAt: '2025-01-14 12:30:15' },
        { id: 2, name: 'فاطمة علي', phone: '01087654321', countryCode: '+20', queue: 2, status: 'تم', completedAt: '2025-01-14 12:35:42' },
        { id: 3, name: 'محمود حسن', phone: '01098765432', countryCode: '+20', queue: 3, status: 'تم', completedAt: '2025-01-14 12:42:08' },
      ],
    },
    {
      id: '2',
      sessionId: 'SES-15-JAN-004',
      clinicName: 'عيادة سارة إبراهيم',
      doctorName: 'د. سارة إبراهيم',
      createdAt: '2025-01-14 14:00:00',
      completedAt: '2025-01-14 15:30:50',
      totalPatients: 18,
      sentCount: 18,
      patients: [
        { id: 4, name: 'علي حسن', phone: '01055667788', countryCode: '+20', queue: 1, status: 'تم', completedAt: '2025-01-14 15:15:33' },
        { id: 5, name: 'ليلى محمد', phone: '01011223344', countryCode: '+20', queue: 2, status: 'تم', completedAt: '2025-01-14 15:28:47' },
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
              sentCount: s.sentCount - selected.size,
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

  const fullMessage = 'مرحباً {PN}، ترتيبك {PQP}، الموضع الحالي {CQP}، الوقت المتبقي {ETR} دقيقة';

  return (
    <div className="p-6">
      <SharedHeader 
        title="المهام المكتملة" 
        description="عرض جميع المهام المكتملة والمرسلة بنجاح"
      />

      <StatsSection 
        gradient="bg-gradient-to-br from-green-500 to-green-600"
        stats={[
          {
            label: 'إجمالي الجلسات المكتملة',
            value: sessions.length,
            icon: 'check-double'
          },
          {
            label: 'إجمالي الرسائل المرسلة',
            value: sessions.reduce((sum, s) => sum + s.sentCount, 0),
            icon: 'envelope'
          },
          {
            label: 'إجمالي المرضى المرسل إليهم',
            value: sessions.reduce((sum, s) => sum + s.patients.length, 0),
            icon: 'users'
          }
        ]}
      />

      <div className="space-y-4">
        {sessions.map((session) => {
          const isExpanded = expandedSessions.has(session.id);
          const selectedCount = selectedPatients.get(session.id)?.size || 0;

          return (
            <div key={session.id} className="bg-white rounded-lg shadow overflow-hidden">
              {/* Session Header */}
              <div
                className="px-6 py-4 bg-gradient-to-r from-green-50 to-emerald-50 border-b cursor-pointer hover:bg-green-100 transition-colors flex items-center justify-between"
                onClick={() => toggleSessionExpand(session.id)}
              >
                <div className="flex items-center gap-4 flex-1">
                  <button className="text-green-600 hover:text-green-800 text-xl">
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
                      <span>
                        <span className="font-medium">وقت الانتهاء:</span> {session.completedAt}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-bold">
                    ✓ مكتمل
                  </div>
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
                            وقت الإنجاز
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
                                ? 'bg-green-50'
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
                              <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-medium">
                                {patient.status}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-sm text-gray-600">
                              {patient.completedAt}
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
            <i className="fas fa-check-double text-4xl text-green-500 mb-4"></i>
            <p className="text-lg">لا توجد مهام مكتملة بعد</p>
          </div>
        )}
      </div>
    </div>
  );
}
