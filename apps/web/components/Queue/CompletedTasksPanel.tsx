'use client';

import { useState, useCallback, useMemo } from 'react';
import { MOCK_COMPLETED_SESSIONS } from '@/constants/mockData';
import { PanelWrapper } from '@/components/Common/PanelWrapper';
import { PanelHeader } from '@/components/Common/PanelHeader';
import { ResponsiveTable } from '@/components/Common/ResponsiveTable';
import { EmptyState } from '@/components/Common/EmptyState';
import { Badge } from '@/components/Common/ResponsiveUI';
import UsageGuideSection from '@/components/Common/UsageGuideSection';
import { Patient } from '@/types';

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
  const [isMessagesExpanded, setIsMessagesExpanded] = useState(false);
  const [sessions] = useState<Session[]>(MOCK_COMPLETED_SESSIONS as Session[]);

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
   * Memoize table columns - no checkbox since deletion is disabled, no status column
   */
  const tableColumns = useMemo(() => [
    { key: 'name', label: 'الاسم', width: '25%' },
    { key: 'phone', label: 'رقم الجوال', width: '20%' },
    { key: 'message', label: 'الرسالة', width: '35%', hasToggle: true },
    { key: 'completedAt', label: 'وقت الإكمال', width: '20%' },
  ], []);

  /**
   * Render patient row - no checkbox since deletion is disabled, no status column
   */
  const renderPatientRow = useCallback((patient: Patient) => ({
    id: patient.id,
    name: patient.name,
    phone: `${patient.countryCode || '+966'} ${patient.phone}`,
    message: (
      <div
        className={`text-sm text-gray-700 ${
          isMessagesExpanded ? '' : 'line-clamp-2'
        } max-w-xs`}
        title={patient.messagePreview}
      >
        {patient.messagePreview || 'لا توجد رسالة'}
      </div>
    ),
    completedAt: patient.completedAt || 'غير معروف',
  }), [isMessagesExpanded]);

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
      <div className="space-y-4">
        {sessions.map((session) => {
          const isExpanded = expandedSessions.has(session.id);
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
                        <h4 className="font-bold text-gray-800">قائمة المرضى</h4>
                        <span className="text-sm text-gray-600">
                          {session.patients.length} مريض
                        </span>
                      </div>
                      <div className="flex gap-2">
                        {/* Deletion and selection controls intentionally removed - completed patients cannot be deleted */}
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
                              {tableColumns.map((col: any) => (
                                <th
                                  key={col.key}
                                  style={{ width: col.width }}
                                  className="px-6 py-3 text-right text-sm font-semibold text-gray-700"
                                >
                                  {col.hasToggle ? (
                                    <div className="flex items-center justify-between gap-2">
                                      <span>{col.label}</span>
                                      <button
                                        onClick={() => setIsMessagesExpanded(!isMessagesExpanded)}
                                        className="flex items-center gap-1 px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition-colors text-xs font-medium"
                                        title={isMessagesExpanded ? 'طي الرسائل' : 'فرد الرسائل'}
                                      >
                                        <i className={`fas fa-${isMessagesExpanded ? 'compress' : 'expand'}`}></i>
                                        <span>{isMessagesExpanded ? 'طي' : 'فرد'}</span>
                                      </button>
                                    </div>
                                  ) : (
                                    col.label
                                  )}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {session.patients.map((patient) => {
                              const row = renderPatientRow(patient);
                              return (
                                <tr
                                  key={patient.id}
                                  className="border-b hover:bg-gray-50 transition-colors"
                                >
                                  <td className="px-6 py-3 text-sm text-gray-900 font-medium">{row.name}</td>
                                  <td className="px-6 py-3 text-sm text-gray-600">{row.phone}</td>
                                  <td className="px-6 py-3 text-sm text-gray-700">{row.message}</td>
                                  <td className="px-6 py-3 text-sm text-gray-600">{row.completedAt}</td>
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
        <UsageGuideSection 
          items={COMPLETED_TASKS_GUIDE_ITEMS}
        />
    </PanelWrapper>
  );
}
