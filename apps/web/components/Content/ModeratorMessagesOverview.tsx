'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useQueue } from '@/contexts/QueueContext';
import { useUI } from '@/contexts/UIContext';
import { useModal } from '@/contexts/ModalContext';
import { useConfirmDialog } from '@/contexts/ConfirmationContext';
import { useSelectDialog } from '@/contexts/SelectDialogContext';
import { createDeleteConfirmation } from '@/utils/confirmationHelpers';
import { PanelWrapper } from '@/components/Common/PanelWrapper';
import { PanelHeader } from '@/components/Common/PanelHeader';
import { EmptyState } from '@/components/Common/EmptyState';
import UsageGuideSection from '@/components/Common/UsageGuideSection';
import { ConflictBadge } from '@/components/Common/ConflictBadge';
import { MOCK_QUEUE_MESSAGE_CONDITIONS, MOCK_QUOTA } from '@/constants/mockData';

/**
 * Moderator Messages Overview - Admin View
 * Shows all moderators with their aggregated message templates
 * For Primary Admin and Secondary Admin roles only
 */

const USAGE_GUIDE_ITEMS = [
  {
    title: 'عرض المشرفين',
    description: 'شاهد جميع المشرفين وإحصائيات رسائلهم في بطاقات منفصلة'
  },
  {
    title: 'توسيع بطاقة المشرف',
    description: 'انقر على بطاقة المشرف لعرض جميع الطوابير والقوالب الخاصة به'
  },
  {
    title: 'إدارة القوالب',
    description: 'يمكنك تحرير وحذف قوالب الرسائل من داخل كل طابور'
  },
  {
    title: 'كشف التضاربات',
    description: 'شاهد عدد التضاربات في شروط الرسائل لكل مشرف'
  },
  {
    title: 'البحث والترتيب',
    description: 'ابحث عن المشرفين بسهولة حسب الاسم أو اسم المستخدم'
  },
];

export default function ModeratorMessagesOverview() {
  const { moderators, queues, messageTemplates, selectedQueueId, setSelectedQueueId } = useQueue();
  const { addToast } = useUI();
  const { openModal } = useModal();
  const { confirm } = useConfirmDialog();
  const { select } = useSelectDialog();

  // State for search and expansion
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedModerators, setExpandedModerators] = useState<Set<string | number>>(new Set());
  const [expandedQueues, setExpandedQueues] = useState<Set<string>>(new Set());

  // Toggle moderator expansion
  const toggleModeratorExpanded = useCallback((moderatorId: string | number) => {
    setExpandedModerators((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(moderatorId)) {
        newSet.delete(moderatorId);
      } else {
        newSet.add(moderatorId);
      }
      return newSet;
    });
  }, []);

  // Toggle queue expansion
  const toggleQueueExpanded = useCallback((queueId: string) => {
    setExpandedQueues((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(queueId)) {
        newSet.delete(queueId);
      } else {
        newSet.add(queueId);
      }
      return newSet;
    });
  }, []);

  // Toggle all moderators
  const toggleAllModerators = useCallback(() => {
    if (expandedModerators.size === moderators.length) {
      setExpandedModerators(new Set());
    } else {
      setExpandedModerators(new Set(moderators.map((m) => m.moderatorId)));
    }
  }, [expandedModerators.size, moderators.length]);

  /**
   * Check for condition intersections in a queue (same logic as MessagesPanel)
   */
  const checkConditionIntersections = (queueId: string) => {
    const queueConditions = MOCK_QUEUE_MESSAGE_CONDITIONS.filter(
      (c) => c.queueId === queueId && !c.id.startsWith('DEFAULT_')
    );

    if (queueConditions.length < 2) return [];

    const intersections: Array<{ cond1: any; cond2: any; message: string }> = [];

    for (let i = 0; i < queueConditions.length; i++) {
      for (let j = i + 1; j < queueConditions.length; j++) {
        const cond1 = queueConditions[i];
        const cond2 = queueConditions[j];

        if (
          cond1.operator &&
          cond2.operator &&
          getConditionRange(cond1) &&
          getConditionRange(cond2) &&
          conditionsOverlap(cond1, cond2)
        ) {
          intersections.push({
            cond1,
            cond2,
            message: `تقاطع: ${getConditionText(cond1)} و ${getConditionText(cond2)}`
          });
        }
      }
    }

    return intersections;
  };

  /**
   * Get range representation of a condition
   */
  const getConditionRange = (cond: any): { min: number; max: number } | null => {
    switch (cond.operator) {
      case 'EQUAL':
        if (cond.value === undefined || cond.value <= 0) return null;
        return { min: cond.value, max: cond.value };
      case 'GREATER':
        if (cond.value === undefined || cond.value <= 0) return null;
        return { min: cond.value + 1, max: 999 };
      case 'LESS':
        if (cond.value === undefined || cond.value <= 0) return null;
        return { min: 1, max: cond.value - 1 };
      case 'RANGE':
        if (cond.minValue === undefined || cond.maxValue === undefined || cond.minValue <= 0 || cond.maxValue <= 0) return null;
        return { min: cond.minValue, max: cond.maxValue };
      default:
        return null;
    }
  };

  /**
   * Check if two conditions overlap
   */
  const conditionsOverlap = (cond1: any, cond2: any): boolean => {
    const range1 = getConditionRange(cond1);
    const range2 = getConditionRange(cond2);
    
    if (!range1 || !range2) return false;
    
    return !(range1.max < range2.min || range2.max < range1.min);
  };

  /**
   * Get human-readable condition text
   */
  const getConditionText = (cond: any): string => {
    const operatorMap: Record<string, string> = {
      'EQUAL': 'يساوي',
      'GREATER': 'أكثر من',
      'LESS': 'أقل من',
      'RANGE': 'نطاق',
    };

    const operatorText = operatorMap[cond.operator] || cond.operator;
    const valueText =
      cond.operator === 'RANGE' ? `${cond.minValue}-${cond.maxValue}` : cond.value;

    return `${operatorText} ${valueText}`;
  };

  /**
   * Filter moderators by search term
   */
  const filteredModerators = useMemo(() => {
    if (!searchTerm) return moderators;
    
    const searchLower = searchTerm.toLowerCase();
    return moderators.filter((mod) =>
      mod.moderatorName.toLowerCase().includes(searchLower) ||
      mod.moderatorUsername.toLowerCase().includes(searchLower)
    );
  }, [moderators, searchTerm]);

  /**
   * Role-based stats for admin view showing system-wide quota
   */
  const getAdminStats = useMemo(() => {
    const { messagesQuota } = MOCK_QUOTA;
    const baseStats = {
      total: messagesQuota.limit,
      used: messagesQuota.used,
      remaining: messagesQuota.limit - messagesQuota.used,
    };

    return [
      {
        label: 'عدد المشرفين',
        value: moderators.length.toString(),
        color: 'blue' as const,
        info: 'إجمالي المشرفين في النظام'
      },
      {
        label: 'إجمالي الرسائل في النظام',
        value: baseStats.total.toString(),
        color: 'blue' as const,
        info: 'مجموع رسائل جميع الفرق'
      },
      {
        label: 'الرسائل المستخدمة',
        value: baseStats.used.toString(),
        color: 'yellow' as const,
        info: 'من المجموع الكلي للنظام'
      },
      {
        label: 'الرسائل المتبقية',
        value: baseStats.remaining.toString(),
        color: 'green' as const,
        info: ''
      },
    ];
  }, [moderators.length]);

  return (
    <PanelWrapper>
      <PanelHeader
        icon="fa-envelope"
        title="إدارة قوالب الرسائل - عرض المشرفين"
        description="إدارة قوالب الرسائل لكل مشرف بشكل شامل وسهل"
        stats={getAdminStats}
        actions={[]}
      />

      {/* Search and Expand Controls Section */}
      {moderators.length > 0 && (
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-end gap-4">
            {/* Search */}
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-2 block">البحث</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث حسب اسم المشرف أو اسم المستخدم..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {/* Expand/Collapse All Button */}
            <button
              onClick={toggleAllModerators}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium whitespace-nowrap h-fit"
              title="توسيع أو طي جميع المشرفين"
            >
              <i className={`fas ${expandedModerators.size === moderators.length ? 'fa-compress' : 'fa-expand'}`}></i>
              {expandedModerators.size === moderators.length ? 'طي الكل' : 'توسيع الكل'}
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="space-y-4 p-4">
        {moderators.length === 0 ? (
          <EmptyState
            icon="fa-users"
            title="لا يوجد مشرفين"
            message="لم يتم العثور على أي مشرفين في النظام"
            actionLabel="اذهب إلى لوحة التحكم"
            onAction={() => {
              window.location.href = '#/management';
            }}
          />
        ) : filteredModerators.length === 0 ? (
          <EmptyState
            icon="fa-search"
            title="لا توجد نتائج"
            message={`لم يتم العثور على مشرفين يطابقون "${searchTerm}"`}
            actionLabel="مسح البحث"
            onAction={() => setSearchTerm('')}
          />
        ) : (
          <div className="space-y-3">
            {filteredModerators.map((moderator) => {
              const isExpanded = expandedModerators.has(moderator.moderatorId);
              const moderatorQueues = moderator.queues;

              return (
                <div
                  key={moderator.moderatorId}
                  className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-blue-300 transition-colors"
                >
                  {/* Moderator Header Tile */}
                  <div className="px-4 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-right space-x-2 rtl:space-x-reverse">
                    <button
                      onClick={() => toggleModeratorExpanded(moderator.moderatorId)}
                      className="flex items-center gap-3 flex-1 text-right"
                    >
                      <i
                        className={`fas fa-chevron-down text-gray-600 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      ></i>
                      <div className="text-right">
                        <h4 className="font-semibold text-gray-900">
                          <i className="fas fa-user-tie text-purple-600 ml-2"></i>
                          {moderator.moderatorName}
                        </h4>
                        <p className="text-xs text-gray-600 mt-1">
                          👤 @{moderator.moderatorUsername}
                        </p>
                      </div>
                    </button>

                    {/* Stats Badges */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                        🏥 {moderator.queuesCount} طابور
                      </span>
                      <span className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                        📧 {moderator.templatesCount} قالب
                      </span>
                      
                      {/* Conflict Badge */}
                      {moderator.conflictCount > 0 && (
                        <ConflictBadge 
                          conflictCount={moderator.conflictCount}
                          size="sm"
                          onClick={() => toggleModeratorExpanded(moderator.moderatorId)}
                        />
                      )}
                    </div>
                  </div>

                  {/* Conflict Details - Show which queues have conflicts */}
                  {moderator.conflictCount > 0 && (
                    <div className="border-t border-red-100 px-4 py-2 bg-red-50 space-y-2">
                      <p className="text-xs font-semibold text-red-900">
                        ⛔ طوابير بها تضاربات:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {moderator.queues
                          .map((queue) => {
                            const queueConditions = MOCK_QUEUE_MESSAGE_CONDITIONS.filter(
                              (c) => c.queueId === String(queue.id) && !c.id.startsWith('DEFAULT_')
                            );

                            if (queueConditions.length < 2) return null;

                            let hasConflict = false;
                            for (let i = 0; i < queueConditions.length; i++) {
                              for (let j = i + 1; j < queueConditions.length; j++) {
                                const cond1 = queueConditions[i];
                                const cond2 = queueConditions[j];

                                if (
                                  cond1.operator &&
                                  cond2.operator &&
                                  getConditionRange(cond1) &&
                                  getConditionRange(cond2) &&
                                  conditionsOverlap(cond1, cond2)
                                ) {
                                  hasConflict = true;
                                  break;
                                }
                              }
                              if (hasConflict) break;
                            }

                            return hasConflict ? queue : null;
                          })
                          .filter((queue) => queue !== null)
                          .map((queue) => (
                            <span
                              key={queue?.id}
                              className="inline-flex items-center gap-1 px-2 py-1 bg-red-200 text-red-800 rounded text-xs font-medium cursor-pointer hover:bg-red-300 transition-colors"
                              onClick={() => toggleQueueExpanded(String(queue?.id))}
                              title="اضغط لفتح الطابور"
                            >
                              <i className="fas fa-exclamation-triangle"></i>
                              {queue?.doctorName || `الطابور #${queue?.id}`}
                            </span>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Moderator Content - Collapsible Queues List */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-4">
                      {moderatorQueues.length === 0 ? (
                        <div className="text-center py-8">
                          <p className="text-gray-500 text-sm">لا توجد طوابير لهذا المشرف بعد</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {moderatorQueues.map((queue) => {
                            const queueTemplates = messageTemplates.filter((t) => t.queueId === String(queue.id));
                            const intersections = checkConditionIntersections(String(queue.id));
                            const isQueueExpanded = expandedQueues.has(String(queue.id));

                            return (
                              <div
                                key={queue.id}
                                className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-blue-400 transition-colors"
                              >
                                {/* Queue Header - Collapsible */}
                                <div
                                  className="px-3 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-right"
                                >
                                  <button
                                    onClick={() => toggleQueueExpanded(String(queue.id))}
                                    className="flex items-center gap-2 flex-1 text-right bg-transparent border-0 p-0 hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 rounded cursor-pointer"
                                  >
                                    <i
                                      className={`fas fa-chevron-down text-gray-600 transition-transform ${
                                        isQueueExpanded ? 'rotate-180' : ''
                                      }`}
                                    ></i>
                                    <div className="text-right">
                                      <h5 className="font-medium text-gray-900">
                                        <i className="fas fa-hospital-user text-blue-600 ml-2"></i>
                                        {queue.doctorName || `الطابور #${queue.id}`}
                                      </h5>
                                      <p className="text-xs text-gray-600 mt-1">
                                        📧 {queueTemplates.length} قالب رسالة
                                      </p>
                                    </div>
                                  </button>
                                  
                                  {/* Quick Stats */}
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {intersections.length > 0 && (
                                      <span className="inline-flex items-center px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-bold">
                                        ⛔ {intersections.length} تضارب
                                      </span>
                                    )}
                                    <button
                                      onClick={() => {
                                        openModal('addTemplate', { queueId: String(queue.id) });
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 transition-colors"
                                      title="إضافة قالب جديد"
                                    >
                                      <i className="fas fa-plus"></i>
                                      إضافة قالب رسالة
                                    </button>
                                  </div>
                                </div>

                                {/* Queue Content - Collapsible Templates */}
                                {isQueueExpanded && (
                                  <div className="border-t border-gray-200 p-3 bg-gray-50 space-y-3">
                                    {/* Intersection Warning */}
                                    {intersections.length > 0 && (
                                      <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-2">
                                        <p className="text-xs font-semibold text-red-900 mb-1">
                                          ⛔ خطأ: تقاطع في الشروط
                                        </p>
                                        <ul className="space-y-1 text-xs text-red-800">
                                          {intersections.slice(0, 2).map((intersection, idx) => (
                                            <li key={idx} className="flex items-start gap-2">
                                              <span className="text-red-600 flex-shrink-0">✕</span>
                                              <span>{intersection.message}</span>
                                            </li>
                                          ))}
                                          {intersections.length > 2 && (
                                            <li className="text-red-800 font-medium">
                                              ...و {intersections.length - 2} تضاربات أخرى
                                            </li>
                                          )}
                                        </ul>
                                      </div>
                                    )}

                                    {/* Queue Templates Table */}
                                    {queueTemplates.length > 0 ? (
                                      <div className="bg-white rounded border border-gray-200 overflow-hidden">
                                        <div className="overflow-x-auto">
                                          <table className="w-full text-xs">
                                            <thead>
                                              <tr className="bg-gray-100 border-b border-gray-200">
                                                <th className="px-3 py-1 text-right">العنوان</th>
                                                <th className="px-3 py-1 text-right">الشرط</th>
                                                <th className="px-3 py-1 text-right">الإجراءات</th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {queueTemplates
                                                .sort((a, b) => {
                                                  const conditionsA = MOCK_QUEUE_MESSAGE_CONDITIONS.filter((c) => c.templateId === a.id);
                                                  const conditionsB = MOCK_QUEUE_MESSAGE_CONDITIONS.filter((c) => c.templateId === b.id);
                                                  
                                                  const conditionA = conditionsA.length > 0 ? conditionsA[0] : null;
                                                  const conditionB = conditionsB.length > 0 ? conditionsB[0] : null;                                                  const isDefaultA = conditionA && conditionA.id.startsWith('DEFAULT_');
                                                  const isDefaultB = conditionB && conditionB.id.startsWith('DEFAULT_');

                                                  if (isDefaultA && !isDefaultB) return -1;
                                                  if (!isDefaultA && isDefaultB) return 1;

                                                  return 0;
                                                })
                                                .map((template) => {
                                                  const condition = MOCK_QUEUE_MESSAGE_CONDITIONS.find((c) => c.templateId === template.id);
                                                  const isDefaultCondition = condition && condition.id.startsWith('DEFAULT_');

                                                  return (
                                                    <tr key={template.id} className="border-b border-gray-200 hover:bg-blue-50">
                                                      <td className="px-3 py-1">
                                                        <p className="font-medium text-gray-900">{template.title}</p>
                                                      </td>
                                                      <td className="px-3 py-1">
                                                        {condition ? (
                                                          isDefaultCondition ? (
                                                            <span className="text-green-600 text-xs font-medium">✓ افتراضي</span>
                                                          ) : (
                                                            <span className="text-sm font-semibold text-blue-600">
                                                              {(condition as any).operator === 'EQUAL' && 'يساوي'}
                                                              {(condition as any).operator === 'GREATER' && 'أكثر من'}
                                                              {(condition as any).operator === 'LESS' && 'أقل من'}
                                                              {(condition as any).operator === 'RANGE' && 'نطاق'}
                                                              {' '}
                                                              {(condition as any).operator === 'RANGE' 
                                                                ? `${(condition as any).minValue}-${(condition as any).maxValue}` 
                                                                : (condition as any).value}
                                                            </span>
                                                          )
                                                        ) : (
                                                          <span className="text-amber-600 text-xs font-medium">لم يتم تحديده</span>
                                                        )}
                                                      </td>
                                                      <td className="px-3 py-1">
                                                        <div className="flex items-center gap-1">
                                                          <button
                                                            onClick={() => {
                                                              openModal('editTemplate', { templateId: template.id, queueId: queue.id });
                                                            }}
                                                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 transition-colors"
                                                            title="تحرير"
                                                          >
                                                            <i className="fas fa-edit"></i>
                                                          </button>
                                                          <button
                                                            onClick={() => {
                                                              addToast('تم حذف القالب: ' + template.title, 'success');
                                                            }}
                                                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200 transition-colors"
                                                            title="حذف"
                                                          >
                                                            <i className="fas fa-trash"></i>
                                                          </button>
                                                        </div>
                                                      </td>
                                                    </tr>
                                                  );
                                                })}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="text-center py-4">
                                        <p className="text-gray-500 text-sm">لا توجد قوالب رسائل في هذا الطابور بعد</p>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Usage Guide Section */}
      <div className="px-4 pb-4">
        <UsageGuideSection 
          items={USAGE_GUIDE_ITEMS}
        />
      </div>
    </PanelWrapper>
  );
}
