'use client';

import { useState, useCallback, useMemo } from 'react';
import { MOCK_COMPLETED_SESSIONS } from '@/constants/mockData';
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

const COMPLETED_TASKS_GUIDE_ITEMS = [
  {
    title: '',
    description: 'هنا تجد جميع الجلسات التي تمت معالجتها بنجاح'
  },
  {
    title: '',
    description: 'يمكنك عرض تفاصيل كل جلسة والمرضى المرسل إليهم'
  },
  {
    title: '',
    description: 'يتم حفظ كل البيانات المكتملة للمراجعة والتقارير'
  },
  {
    title: '',
    description: 'نسبة النجاح توضح فعالية كل جلسة'
  },
];

export default function CompletedTasksPanel() {
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());
  const [selectedPatients, setSelectedPatients] = useState<Map<string, Set<number>>>(new Map());
  const [sessions, setSessions] = useState<Session[]>(MOCK_COMPLETED_SESSIONS as Session[]);

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
   * Toggle all patients - memoized
   */
  const toggleAllPatients = useCallback((sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;

    const selectedSet = selectedPatients.get(sessionId) || new Set();
    setSelectedPatients((prev) => {
      const newMap = new Map(prev);
      if (selectedSet.size === session.patients.length) {
        newMap.delete(sessionId);
      } else {
        newMap.set(sessionId, new Set(session.patients.map((p) => p.id)));
      }
      return newMap;
    });
  }, [selectedPatients, sessions]);

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
  }, [selectedPatients]);

  /**
   * Memoize computed stats
   */
  const stats = useMemo(() => [
    {
      label: 'إجمالي الجلسات المكتملة',
      value: sessions.length.toString(),
      icon: 'fa-check-double',
    },
    {
      label: 'الرسائل المرسلة بنجاح',
      value: sessions.reduce((sum, s) => sum + s.sentCount, 0).toString(),
      icon: 'fa-check-circle',
    },
    {
      label: 'إجمالي المرضى في الجلسة',
      value: sessions.reduce((sum, s) => sum + s.patients.length, 0).toString(),
      icon: 'fa-users',
    },
  ], [sessions]);

  /**
   * Memoize table columns
   */
  const tableColumns = useMemo(() => [
    { key: 'checkbox', label: '', width: '5%' },
    { key: 'name', label: 'الاسم', width: '25%' },
    { key: 'phone', label: 'رقم الجوال', width: '20%' },
    { key: 'completedAt', label: 'وقت الإكمال', width: '25%' },
    { key: 'status', label: 'الحالة', width: '25%' },
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
    completedAt: patient.completedAt || 'غير معروف',
    status: (
      <Badge color="green" label="✓ مكتملة" />
    ),
  }), [selectedPatients, togglePatientSelection]);

  if (sessions.length === 0) {
    return (
      <PanelWrapper>
        <PanelHeader
          title="المهام المكتملة"
          icon="fa-check-double"
          description={`عرض جميع المهام المكتملة والمرسلة بنجاح - 0 جلسة`}
          stats={stats}
        />
        <EmptyState
          icon="fa-inbox"
          title="لا توجد مهام مكتملة"
          message="جميع المهام قيد المعالجة أو لم تبدأ بعد"
          actionLabel="العودة للصفحة الرئيسية"
          onAction={() => window.history.back()}
        />
      </PanelWrapper>
    );
  }

  return (
    <PanelWrapper>
      <PanelHeader
        title={`المهام المكتملة ${sessions.length > 0 ? `- ${sessions[0].doctorName}` : ''}`}
        icon="fa-check-double"
        description={`عرض جميع المهام المكتملة والمرسلة بنجاح - ${sessions.length} جلسة`}
        stats={stats}
      />

      {/* Sessions List */}
      <div className="space-y-4">
        {sessions.map((session) => {
          const isExpanded = expandedSessions.has(session.id);
          const selectedCount = selectedPatients.get(session.id)?.size || 0;
          const progressPercent = Math.round((session.sentCount / session.totalPatients) * 100);

          return (
            <div
              key={session.id}
              className="bg-white rounded-lg shadow overflow-hidden border border-green-200"
            >
              {/* Session Header - Fully Clickable */}
              <div
                className="px-6 py-4 border-b bg-gradient-to-r from-green-50 to-emerald-50 cursor-pointer hover:from-green-100 hover:to-emerald-100 transition-colors"
                onClick={() => toggleSessionExpand(session.id)}
              >
                <div className="flex items-center gap-4 justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    {/* Collapse Button with Improved UI */}
                    <div className="flex items-center gap-2">
                      <button className="text-green-600 text-xl transition-transform duration-300">
                        <i className={`fas fa-chevron-${isExpanded ? 'down' : 'left'}`}></i>
                      </button>
                      <span className="text-sm font-medium text-green-600 whitespace-nowrap">القائمة</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-gray-900 text-lg">{session.clinicName}</h3>
                        <Badge color="green" label="✓ مكتملة" />
                      </div>
                      <div className="text-sm text-gray-600 mt-2">
                        <span>جلسة: <strong>{session.sessionId}</strong></span>
                        <span className="mx-4">تاريخ الإنشاء: <strong>{session.createdAt}</strong></span>
                        <span className="mx-4">تاريخ الإكمال: <strong>{session.completedAt}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Completion Summary */}
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-700 mb-1">نسبة الإكمال</div>
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500"
                          style={{ width: `${progressPercent}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-600 mt-1">{progressPercent}%</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Session Content (Expandable) */}
              {isExpanded && (
                <div className="p-6 bg-gray-50">
                  {/* Session Stats */}
                  <div className="grid grid-cols-3 gap-4 mb-6">
                    <div className="bg-white rounded-lg p-4 border border-green-200">
                      <div className="text-sm text-gray-600">إجمالي المرضى</div>
                      <div className="text-2xl font-bold text-green-600">{session.totalPatients}</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-green-200">
                      <div className="text-sm text-gray-600">الرسائل المرسلة</div>
                      <div className="text-2xl font-bold text-green-600">{session.sentCount}</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-green-200">
                      <div className="text-sm text-gray-600">معدل النجاح</div>
                      <div className="text-2xl font-bold text-green-600">
                        {Math.round((session.sentCount / session.totalPatients) * 100)}%
                      </div>
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
                            borderColor: selectedCount === 0 ? '#d1d5db' : selectedCount === session.patients.length ? '#3b82f6' : '#f59e0b',
                            backgroundColor: selectedCount === 0 ? 'white' : selectedCount === session.patients.length ? '#3b82f6' : '#fef3c7',
                          }}
                          title={selectedCount === 0 ? 'تحديد الكل' : selectedCount === session.patients.length ? 'إلغاء التحديد' : 'تحديد الكل'}
                        >
                          {selectedCount > 0 && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <i
                                className={`fas text-white text-xs ${
                                  selectedCount === session.patients.length ? 'fa-check' : 'fa-minus'
                                }`}
                              ></i>
                            </div>
                          )}
                        </div>
                        <h4 className="font-bold text-gray-800">قائمة المرضى</h4>
                        <span className="text-sm text-gray-600">
                          {selectedCount} من {session.patients.length} محدد
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
                                  className="border-b hover:bg-gray-50 transition-colors"
                                >
                                  <td className="px-6 py-3 text-sm">{row.checkbox}</td>
                                  <td className="px-6 py-3 text-sm text-gray-900 font-medium">{row.name}</td>
                                  <td className="px-6 py-3 text-sm text-gray-600">{row.phone}</td>
                                  <td className="px-6 py-3 text-sm text-gray-600">{row.completedAt}</td>
                                  <td className="px-6 py-3 text-sm">{row.status}</td>
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

      {/* Info Box */}
      <div className="px-6 pb-6">
        <UsageGuideSection 
          items={COMPLETED_TASKS_GUIDE_ITEMS}
        />
      </div>
    </PanelWrapper>
  );
}
