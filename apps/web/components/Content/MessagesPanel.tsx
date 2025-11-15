'use client';

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useQueue } from '@/contexts/QueueContext';
import { useAuth } from '@/contexts/AuthContext';
import { useUI } from '@/contexts/UIContext';
import { useModal } from '@/contexts/ModalContext';
import { useConfirmDialog } from '@/contexts/ConfirmationContext';
import { useSelectDialog } from '@/contexts/SelectDialogContext';
import { createDeleteConfirmation } from '@/utils/confirmationHelpers';
import { messageApiClient, type MyQuotaDto } from '@/services/api/messageApiClient';
import ModeratorMessagesOverview from './ModeratorMessagesOverview';
import { UserRole } from '@/types/roles';
import { PanelWrapper } from '@/components/Common/PanelWrapper';
import { PanelHeader } from '@/components/Common/PanelHeader';
import { EmptyState } from '@/components/Common/EmptyState';
import UsageGuideSection from '@/components/Common/UsageGuideSection';
import { ConflictBadge } from '@/components/Common/ConflictBadge';
import { formatLocalDate } from '@/utils/dateTimeUtils';
import logger from '@/utils/logger';
import type { MessageCondition } from '@/types/messageCondition';
// Mock data removed - using API data instead

/**
 * Minimal Messages Panel - Focused on Queue Template Management
 * Features:
 * - Collapsible queue sections
 * - Per-queue template management
 * - Search/filter/sort across all queues
 * - Bulk operations per queue
 * - Category badges
 * - Statistics per queue
 */

const USAGE_GUIDE_ITEMS = [
  {
    title: 'البحث والترتيب',
    description: 'ابحث عن القوالب بسهولة حسب العنوان أو الوصف، والقوالب مرتبة أبجدياً تلقائياً'
  },
  {
    title: 'توسيع/طي',
    description: 'استخدم زر "توسيع الكل" أو "طي الكل" لإدارة جميع الطوابير بسرعة'
  },
  {
    title: 'القالب الافتراضي',
    description: 'يجب أن يكون هناك قالب واحد بدون شروط (لم يتم تحديده بعد) لكل طابور، وهو يُستخدم عند عدم توفر شروط أخرى'
  },
  {
    title: 'الشروط',
    description: 'استخدم الشروط لإرسال رسائل مختلفة بناءً على معايير محددة (مثل: أكثر من 5 دقائق انتظار)'
  },
  {
    title: 'الحذف الآمن',
    description: 'عند حذف القالب الافتراضي، تحتاج لتحديد قالب افتراضي جديد أولاً. القوالب الأخرى تُحذف بتأكيد بسيط'
  },
  {
    title: 'التحرير والإنشاء',
    description: 'اضغط "تحرير" لتعديل قالب موجود، أو "إضافة قالب جديد" لإنشاء واحد جديد'
  },
  {
    title: 'المتغيرات',
    description: 'استخدم المتغيرات مثل {PN} (اسم المريض)، {CQP} (الموضع الحالي) لتخصيص الرسائل'
  },
];

export default function MessagesPanel() {
  const { selectedQueueId: _selectedQueueId, queues, messageTemplates, refreshQueueData } = useQueue();
  const { user } = useAuth();
  const { addToast } = useUI();
  const { openModal } = useModal();
  const { confirm } = useConfirmDialog();
  const { select: _select } = useSelectDialog();

  /**
   * Role-based rendering:
   * - PrimaryAdmin or SecondaryAdmin: Show ModeratorMessagesOverview (moderator-centric view)
   * - Moderator: Show existing queue-based layout
   * - User: Show moderator-centric view (will see their assigned moderator's content)
   */
  const isAdminView = user && (user.role === UserRole.PrimaryAdmin || user.role === UserRole.SecondaryAdmin);
  const isUserView = user && user.role === UserRole.User;

  // State for search, filtering, sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedQueues, setExpandedQueues] = useState<Set<string | number>>(new Set());
  const [_selectedConditionFilter, _setSelectedConditionFilter] = useState<string | null>(null);
  const [highlightedConditionType, _setHighlightedConditionType] = useState<string | null>(null);
  const [userQuota, setUserQuota] = useState<MyQuotaDto | null>(null);
  const [_isLoadingQuota, setIsLoadingQuota] = useState(false);

  /**
   * Load user's quota from API on component mount
   */
  useEffect(() => {
    const loadQuota = async () => {
      try {
        setIsLoadingQuota(true);
        const quota = await messageApiClient.getMyQuota();
        setUserQuota(quota);
      } catch (err) {
        // Fallback to mock data on error
        setUserQuota(null);
      } finally {
        setIsLoadingQuota(false);
      }
    };

    loadQuota();
  }, []);

  /**
   * Listen for data updates and refetch queue data
   */
  useEffect(() => {
    const handleDataUpdate = async () => {
      // Refetch data for all queues to ensure consistency
      if (queues.length > 0 && typeof refreshQueueData === 'function') {
        for (const queue of queues) {
          await refreshQueueData(String(queue.id));
        }
      }
      // Refetch quota
      try {
        const quota = await messageApiClient.getMyQuota();
        setUserQuota(quota);
      } catch (err) {
        // Silently fail quota refetch
      }
    };

    // Listen to all relevant update events
    window.addEventListener('templateDataUpdated', handleDataUpdate);
    window.addEventListener('patientDataUpdated', handleDataUpdate);
    window.addEventListener('queueDataUpdated', handleDataUpdate);
    window.addEventListener('conditionDataUpdated', handleDataUpdate);
    window.addEventListener('messageDataUpdated', handleDataUpdate);

    return () => {
      window.removeEventListener('templateDataUpdated', handleDataUpdate);
      window.removeEventListener('patientDataUpdated', handleDataUpdate);
      window.removeEventListener('queueDataUpdated', handleDataUpdate);
      window.removeEventListener('conditionDataUpdated', handleDataUpdate);
      window.removeEventListener('messageDataUpdated', handleDataUpdate);
    };
  }, [queues, refreshQueueData]);

  // Toggle queue expansion
  const toggleQueueExpanded = useCallback((queueId: string | number) => {
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

  // Toggle all queues (expand/collapse)
  const toggleAllQueues = useCallback(() => {
    if (expandedQueues.size === queues.length) {
      // All expanded, collapse all
      setExpandedQueues(new Set());
    } else {
      // Not all expanded, expand all
      setExpandedQueues(new Set(queues.map((q) => q.id)));
    }
  }, [expandedQueues.size, queues]);

  /**
   * Check for condition intersections in a queue
   */
  const checkConditionIntersections = (queueId: string) => {
    // Get all conditions from message templates for this queue
    const queueConditions: MessageCondition[] = messageTemplates
      .filter((t) => t.queueId === String(queueId) && t.condition && t.condition.operator && t.condition.operator !== 'DEFAULT' && t.condition.operator !== 'UNCONDITIONED')
      .map((t) => t.condition)
      .filter((c): c is MessageCondition => c !== null && c !== undefined);

    if (queueConditions.length < 2) return [];

    const intersections: Array<{ cond1: MessageCondition; cond2: MessageCondition; message: string }> = [];

    for (let i = 0; i < queueConditions.length; i++) {
      for (let j = i + 1; j < queueConditions.length; j++) {
        const cond1 = queueConditions[i];
        const cond2 = queueConditions[j];

        // Check if conditions overlap
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
   * Get all condition IDs that are involved in intersections
   */
  const getConflictingConditionIds = useCallback((queueId: string): Set<string> => {
    const intersections = checkConditionIntersections(queueId);
    const conflictingIds = new Set<string>();
    
    intersections.forEach((intersection) => {
      conflictingIds.add(intersection.cond1.id);
      conflictingIds.add(intersection.cond2.id);
    });
    
    return conflictingIds;
  }, []);

  /**
   * Get range representation of a condition
   * Note: All values must be >= 1 (0 and negative values are invalid)
   */
  const getConditionRange = (cond: MessageCondition): { min: number; max: number } | null => {
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
   * Check if two conditions overlap/intersect
   */
  const conditionsOverlap = (cond1: MessageCondition, cond2: MessageCondition): boolean => {
    const range1 = getConditionRange(cond1);
    const range2 = getConditionRange(cond2);
    
    if (!range1 || !range2) return false;
    
    // Two ranges overlap if NOT (range1.max < range2.min OR range2.max < range1.min)
    return !(range1.max < range2.min || range2.max < range1.min);
  };

  /**
   * Get human-readable condition text
   */
  const getConditionText = (cond: MessageCondition): string => {
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
   * Role-based stats calculation for message quotas
   * - PrimaryAdmin: System-wide quota (sum of all)
   * - SecondaryAdmin: Assigned teams quota
   * - Moderator: Personal quota
   */
  const getRoleContextStats = useMemo(() => {
    // Use API data if available, fallback to default values
    const quotaData = userQuota || { limit: 0, used: 0 };
    const baseStats = {
      total: quotaData.limit,
      used: quotaData.used,
      remaining: quotaData.limit - quotaData.used,
    };

    // Since we're in moderator view (admins are redirected to ModeratorMessagesOverview)
    // Display moderator-specific labels
    return [
      {
        label: 'حصتي من الرسائل',
        value: baseStats.total.toString(),
        color: 'blue' as const,
        info: 'عدد الرسائل المسموح لي بإرسالها'
      },
      {
        label: 'الرسائل المستخدمة',
        value: baseStats.used.toString(),
        color: 'yellow' as const,
        info: 'من حصتي الشخصية'
      },
      {
        label: 'الرسائل المتبقية',
        value: baseStats.remaining.toString(),
        color: 'green' as const,
        info: ''
      },
    ];
  }, [userQuota]);

  if (isAdminView || isUserView) {
    return <ModeratorMessagesOverview />;
  }

  return (
    <PanelWrapper>
      <PanelHeader
        icon="fa-envelope"
        title="إدارة قوالب الرسائل"
        description="إدارة قوالب الرسائل لكل طابور بشكل منفصل وسهل"
        stats={getRoleContextStats}
        actions={[]}
      />

      {/* Search and Expand Controls Section */}
      {queues.length > 0 && (
        <div className="bg-white border-b border-gray-200 p-4">
          <div className="flex items-end gap-4">
            {/* Search */}
            <div className="flex-1">
              <label className="text-sm font-medium text-gray-700 mb-2 block">البحث</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث حسب عنوان أو وصف القالب..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {/* Expand/Collapse All Button */}
            <button
              onClick={toggleAllQueues}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium whitespace-nowrap h-fit"
              title="توسيع أو طي جميع الطوابير"
            >
              <i className={`fas ${expandedQueues.size === queues.length ? 'fa-compress' : 'fa-expand'}`}></i>
              {expandedQueues.size === queues.length ? 'طي الكل' : 'توسيع الكل'}
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="space-y-4 p-4">
        {queues.length === 0 ? (
          <EmptyState
            icon="fa-inbox"
            title="لا توجد طوابير"
            message="يرجى إنشاء طابور أولاً من لوحة التحكم"
            actionLabel="اذهب إلى لوحة التحكم"
            onAction={() => {
              window.location.href = '#/queue';
            }}
          />
        ) : (
          <div className="space-y-3">
            {queues.map((queue) => {
              const isExpanded = expandedQueues.has(queue.id);

              return (
                <div
                  key={queue.id}
                  className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-blue-300 transition-colors"
                >
                  {/* Queue Header */}
                  <div className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-right space-x-2 rtl:space-x-reverse">
                    <button
                      onClick={() => toggleQueueExpanded(queue.id)}
                      className="flex items-center gap-3 flex-1 text-right"
                    >
                      <i
                        className={`fas fa-chevron-down text-gray-600 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      ></i>
                      <div className="text-right">
                        <h4 className="font-semibold text-gray-900">
                          <i className="fas fa-hospital-user text-blue-600 ml-2"></i>
                          {queue.doctorName || `الطابور #${queue.id}`}
                        </h4>
                        <p className="text-xs text-gray-600 mt-1">
                          📧 {messageTemplates.filter((t) => t.queueId === String(queue.id)).length} قالب رسالة
                        </p>
                      </div>
                    </button>

                    {/* Quick Stats Badge & Conflict Badge */}
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                        📦 رسائل
                      </span>
                      
                      {/* Conflict Badge - Only show when collapsed */}
                      {!isExpanded && (() => {
                        const intersections = checkConditionIntersections(String(queue.id));
                        return intersections.length > 0 ? (
                          <ConflictBadge 
                            conflictCount={intersections.length}
                            size="sm"
                            onClick={() => toggleQueueExpanded(queue.id)}
                          />
                        ) : null;
                      })()}
                    </div>

                    {/* Add Template Button */}
                    <button
                      onClick={() => {
                        openModal('addTemplate', { queueId: String(queue.id) });
                      }}
                      className="inline-flex items-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium whitespace-nowrap"
                      title="إضافة قالب جديد"
                    >
                      <i className="fas fa-plus"></i>
                      إضافة قالب جديد
                    </button>
                  </div>

                  {/* Queue Content - Collapsible */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50 space-y-4">
                      {/* Intersection Warning */}
                      {(() => {
                        const intersections = checkConditionIntersections(String(queue.id));
                        return intersections.length > 0 ? (
                          <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-3">
                            <div className="flex items-start gap-2">
                              <i className="fas fa-exclamation-circle text-red-600 text-lg mt-0.5 flex-shrink-0"></i>
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-red-900 mb-2">
                                  ⛔ خطأ: تقاطع في الشروط
                                </p>
                                <p className="text-xs text-red-800 mb-2">
                                  تم اكتشاف شروط متقاطعة ولا يمكن قبول هذه التكوينات. يجب تصحيح الشروط:
                                </p>
                                <ul className="space-y-1 text-xs text-red-800">
                                  {intersections.map((intersection, idx) => (
                                    <li key={idx} className="flex items-start gap-2">
                                      <span className="text-red-600 flex-shrink-0">✕</span>
                                      <span>{intersection.message}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        ) : null;
                      })()}

                      {/* Template Data Table */}
                      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-100 border-b border-gray-200">
                                <th className="px-4 py-2 text-right">العنوان</th>
                                <th className="px-4 py-2 text-right">الشرط المطبق</th>
                                <th className="px-4 py-2 text-right">انشئ بواسطة</th>
                                <th className="px-4 py-2 text-right">آخر تحديث</th>
                                <th className="px-4 py-2 text-right">الحالة</th>
                                <th className="px-4 py-2 text-right">الإجراءات</th>
                              </tr>
                            </thead>
                            <tbody>
                              {messageTemplates.filter((t) => t.queueId === String(queue.id))
                                .filter((t) => {
                                  // Search filter by title or content
                                  const searchLower = searchTerm.toLowerCase();
                                  return (
                                    t.title.toLowerCase().includes(searchLower) ||
                                    (t.content && t.content.toLowerCase().includes(searchLower))
                                  );
                                })
                                .sort((_a, _b) => {
                                  return 0;
                                })
                                .map((template) => {
                                const condition = template.condition || null;
                                
                                // Check if this template's condition is conflicting
                                const conflictingIds = getConflictingConditionIds(String(queue.id));
                                const hasConflict = condition && conflictingIds.has(condition.id);
                                
                                return (
                                  <tr key={template.id} className={`border-b border-gray-200 transition-colors ${
                                    hasConflict 
                                      ? 'bg-red-100 hover:bg-red-150 border-l-4 border-l-red-600' 
                                      : highlightedConditionType && condition && condition.operator === highlightedConditionType
                                        ? 'bg-yellow-100 hover:bg-yellow-150 border-l-4 border-l-yellow-500'
                                        : 'hover:bg-blue-50'
                                  }`}>
                                    <td className="px-4 py-2">
                                      <div>
                                        <p className="font-medium text-gray-900">{template.title}</p>
                                        <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                          {template.content.substring(0, 80)}
                                          {template.content.length > 80 ? '...' : ''}
                                        </p>
                                      </div>
                                    </td>
                                    <td className="px-4 py-2">
                                      {condition ? (
                                        condition.operator === 'DEFAULT' ? (
                                          <span className="text-green-600 font-medium bg-green-50 px-3 py-1 rounded-full text-sm">
                                            ✓ افتراضي
                                          </span>
                                        ) : (
                                          <div className="flex items-center gap-2 flex-wrap">
                                            {hasConflict && (
                                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-600 text-white rounded text-xs font-bold animate-pulse">
                                                <i className="fas fa-exclamation-triangle"></i>
                                                تضارب!
                                              </span>
                                            )}
                                            <span className="text-sm font-semibold text-blue-600">
                                              {condition.operator === 'EQUAL' && 'يساوي'}
                                              {condition.operator === 'GREATER' && 'أكثر من'}
                                              {condition.operator === 'LESS' && 'أقل من'}
                                              {condition.operator === 'RANGE' && 'نطاق'}
                                            </span>
                                            {condition.operator === 'RANGE' ? (
                                              <span className="text-sm font-bold text-gray-800 bg-gray-100 px-2 py-1 rounded">
                                                {condition.minValue} - {condition.maxValue}
                                              </span>
                                            ) : (
                                              <span className="text-sm font-bold text-gray-800 bg-gray-100 px-2 py-1 rounded">
                                                {condition.value}
                                              </span>
                                            )}
                                          </div>
                                        )
                                      ) : (
                                        <span className="text-amber-600 font-medium">لم يتم تحديده بعد</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-2">
                                      <span className="text-sm text-gray-700">{template.createdBy}</span>
                                    </td>
                                    <td className="px-4 py-2">
                                      <span className="text-sm text-gray-700">
                                        {template.updatedAt ? formatLocalDate(template.updatedAt) : '-'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2">
                                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${
                                        !template.isDeleted 
                                          ? 'bg-green-100 text-green-800' 
                                          : 'bg-red-100 text-red-800'
                                      }`}>
                                        <i className={`fas ${!template.isDeleted ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
                                        {!template.isDeleted ? 'نشط' : 'معطل'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2">
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => {
                                            // Edit template - open edit modal
                                            openModal('editTemplate', { templateId: template.id, queueId: queue.id });
                                            addToast('فتح تحرير القالب: ' + template.title, 'info');
                                          }}
                                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 transition-colors"
                                          title="تحرير"
                                        >
                                          <i className="fas fa-edit"></i>
                                          تحرير
                                        </button>
                                        <button
                                          onClick={async (e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            
                                            try {
                                              const confirmOptions = createDeleteConfirmation('القالب: ' + template.title);
                                              const confirmed = await confirm(confirmOptions);
                                              if (!confirmed) return;
                                              
                                              const templateIdNum = Number(template.id);
                                              if (isNaN(templateIdNum)) {
                                                addToast('معرّف القالب غير صالح', 'error');
                                                return;
                                              }

                                              await messageApiClient.deleteTemplate(templateIdNum);
                                              
                                              // Refetch queue data to reflect changes
                                              if (typeof refreshQueueData === 'function' && queue.id) {
                                                await refreshQueueData(String(queue.id));
                                              }
                                              
                                              // Notify other components
                                              window.dispatchEvent(new CustomEvent('templateDataUpdated'));
                                              
                                              addToast('تم حذف القالب: ' + template.title, 'success');
                                            } catch (error: any) {
                                              const errorMsg = error?.message || error?.error || 'فشل حذف القالب';
                                              addToast(errorMsg, 'error');
                                            }
                                          }}
                                          className="inline-flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200 transition-colors"
                                          title="حذف"
                                        >
                                          <i className="fas fa-trash"></i>
                                          حذف
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

                      {/* Additional message templates section can be added here in the future */}
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
