'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useQueue } from '@/contexts/QueueContext';
import { useUI } from '@/contexts/UIContext';
import { useModal } from '@/contexts/ModalContext';
import { PanelWrapper } from '@/components/Common/PanelWrapper';
import { PanelHeader } from '@/components/Common/PanelHeader';
import { EmptyState } from '@/components/Common/EmptyState';
import UsageGuideSection from '@/components/Common/UsageGuideSection';
import { MOCK_MESSAGE_TEMPLATES, MOCK_QUEUE_MESSAGE_CONDITIONS } from '@/constants/mockData';

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
  const { selectedQueueId, queues } = useQueue();
  const { addToast } = useUI();
  const { openModal } = useModal();

  // State for search, filtering, sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedQueues, setExpandedQueues] = useState<Set<string | number>>(new Set());

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

  return (
    <PanelWrapper>
      <PanelHeader
        icon="fa-envelope"
        title="إدارة قوالب الرسائل"
        description="إدارة قوالب الرسائل لكل طابور بشكل منفصل وسهل"
        stats={[
          { label: 'عدد الطوابير', value: queues.length.toString(), color: 'blue' },
          { label: 'الطوابير المفتوحة', value: expandedQueues.size.toString(), color: 'green' },
        ]}
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
                          📧 {MOCK_MESSAGE_TEMPLATES.filter((t) => t.queueId === String(queue.id)).length} قالب رسالة
                        </p>
                      </div>
                    </button>

                    {/* Quick Stats Badge */}
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                        📦 رسائل
                      </span>
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
                      {/* Template Data Table */}
                      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-100 border-b border-gray-200">
                                <th className="px-4 py-2 text-right">العنوان</th>
                                <th className="px-4 py-2 text-right">الشرط المطبق</th>
                                <th className="px-4 py-2 text-right">أنشأ بواسطة</th>
                                <th className="px-4 py-2 text-right">آخر تحديث</th>
                                <th className="px-4 py-2 text-right">الإجراءات</th>
                              </tr>
                            </thead>
                            <tbody>
                              {MOCK_MESSAGE_TEMPLATES.filter((t) => t.queueId === String(queue.id))
                                .filter((t) => {
                                  // Search filter
                                  const searchLower = searchTerm.toLowerCase();
                                  return (
                                    t.title.toLowerCase().includes(searchLower) ||
                                    (t.description && t.description.toLowerCase().includes(searchLower))
                                  );
                                })
                                .sort((a, b) => {
                                  // Sort by title alphabetically (Arabic order)
                                  return a.title.localeCompare(b.title, 'ar');
                                })
                                .map((template) => {
                                const condition = template.conditionId 
                                  ? MOCK_QUEUE_MESSAGE_CONDITIONS.find((c) => c.id === template.conditionId)
                                  : null;
                                
                                // Check if this is a default condition
                                const isDefaultCondition = condition && condition.id.startsWith('DEFAULT_');
                                
                                return (
                                  <tr key={template.id} className="border-b border-gray-200 hover:bg-blue-50">
                                    <td className="px-4 py-2">
                                      <div>
                                        <p className="font-medium text-gray-900">{template.title}</p>
                                        <p className="text-xs text-gray-600 mt-1">{template.description}</p>
                                      </div>
                                    </td>
                                    <td className="px-4 py-2">
                                      {condition ? (
                                        isDefaultCondition ? (
                                          <span className="text-green-600 font-medium bg-green-50 px-3 py-1 rounded-full text-sm">
                                            ✓ افتراضي
                                          </span>
                                        ) : (
                                          <div className="flex items-center gap-2">
                                            <span className="text-sm font-semibold text-blue-600">
                                              {condition.operator === 'EQUAL' && 'يساوي'}
                                              {condition.operator === 'GREATER' && 'أكثر من'}
                                              {condition.operator === 'LESS' && 'أقل من'}
                                            </span>
                                            <span className="text-sm font-bold text-gray-800 bg-gray-100 px-2 py-1 rounded">
                                              {condition.value}
                                            </span>
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
                                        {template.updatedAt ? new Date(template.updatedAt).toLocaleDateString('ar-EG') : '-'}
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
                                          onClick={() => {
                                            // Check if this is the default template (has DEFAULT_ condition)
                                            const templateCondition = MOCK_QUEUE_MESSAGE_CONDITIONS.find((c) => c.id === template.conditionId);
                                            const isDefault = templateCondition && templateCondition.id.startsWith('DEFAULT_');
                                            
                                            if (isDefault) {
                                              // Get all other templates in this queue
                                              const otherTemplates = MOCK_MESSAGE_TEMPLATES.filter(
                                                (t) => t.queueId === String(queue.id) && t.id !== template.id
                                              );
                                              
                                              if (otherTemplates.length === 0) {
                                                addToast('يجب أن يكون هناك قالب افتراضي واحد على الأقل في كل طابور', 'error');
                                                return;
                                              }
                                              
                                              // Show dialog to select new default
                                              const newDefaultId = prompt(
                                                'هذا هو القالب الافتراضي. يرجى اختيار قالب افتراضي جديد قبل الحذف:\n\n' +
                                                otherTemplates.map((t) => `${t.id}: ${t.title}`).join('\n'),
                                                otherTemplates[0].id
                                              );
                                              
                                              if (!newDefaultId) {
                                                return; // User cancelled
                                              }
                                              
                                              addToast('تم حذف القالب: ' + template.title, 'success');
                                            } else {
                                              if (confirm('هل أنت متأكد من حذف هذا القالب؟')) {
                                                addToast('تم حذف القالب: ' + template.title, 'success');
                                              }
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
