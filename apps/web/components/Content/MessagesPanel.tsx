'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useQueue } from '@/contexts/QueueContext';
import { useUI } from '@/contexts/UIContext';
import { PanelWrapper } from '@/components/Common/PanelWrapper';
import { PanelHeader } from '@/components/Common/PanelHeader';
import { EmptyState } from '@/components/Common/EmptyState';
import EnhancedQueueMessagesSection from '@/components/Queue/EnhancedQueueMessagesSection';

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
export default function MessagesPanel() {
  const { selectedQueueId, queues } = useQueue();
  const { addToast } = useUI();

  // State for search, filtering, sorting
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'title' | 'usage'>('date');
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

  // Expand all queues
  const expandAllQueues = useCallback(() => {
    setExpandedQueues(new Set(queues.map((q) => q.id)));
  }, [queues]);

  // Collapse all queues
  const collapseAllQueues = useCallback(() => {
    setExpandedQueues(new Set());
  }, []);

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
        actions={
          queues.length > 0
            ? [
                {
                  label: 'توسيع الكل',
                  icon: 'fa-expand',
                  onClick: expandAllQueues,
                  variant: 'secondary',
                },
                {
                  label: 'طي الكل',
                  icon: 'fa-compress',
                  onClick: collapseAllQueues,
                  variant: 'secondary',
                },
              ]
            : []
        }
      />

      {/* Search and Filter Section */}
      {queues.length > 0 && (
        <div className="bg-white border-b border-gray-200 p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">🔍 البحث</label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث عن رسالة..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            {/* Filter Status */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">📋 الحالة</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="all">جميع الحالات</option>
                <option value="active">نشطة فقط</option>
                <option value="inactive">معطلة فقط</option>
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">📊 الترتيب</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="date">الأحدث أولاً</option>
                <option value="title">الاسم (أ-ي)</option>
                <option value="usage">الأكثر استخداماً</option>
              </select>
            </div>
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
                  <button
                    onClick={() => toggleQueueExpanded(queue.id)}
                    className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors text-right"
                  >
                    <div className="flex items-center gap-3 flex-1">
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
                          معرّف: {queue.id}
                        </p>
                      </div>
                    </div>

                    {/* Quick Stats Badge */}
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                        📦 رسائل
                      </span>
                    </div>
                  </button>

                  {/* Queue Content - Collapsible */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 p-4 bg-gray-50">
                      <EnhancedQueueMessagesSection
                        queueId={String(queue.id)}
                        queueName={queue.doctorName || `الطابور #${queue.id}`}
                        searchTerm={searchTerm}
                        filterStatus={filterStatus}
                        sortBy={sortBy}
                        onTemplateAdded={() =>
                          addToast('تم إضافة قالب جديد بنجاح', 'success')
                        }
                        onTemplateUpdated={() =>
                          addToast('تم تحديث القالب بنجاح', 'success')
                        }
                        onTemplateDeleted={() =>
                          addToast('تم حذف القالب بنجاح', 'success')
                        }
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2 m-4">
        <h4 className="font-semibold text-blue-900 flex items-center gap-2">
          <i className="fas fa-lightbulb"></i>
          نصائح مفيدة:
        </h4>
        <ul className="text-blue-800 text-sm space-y-1 mr-6">
          <li>• وسّع الطابور لرؤية جميع قوالب الرسائل</li>
          <li>• استخدم البحث والفلاتر للعثور على الرسائل بسرعة</li>
          <li>• يمكنك تحرير أو حذف أو نسخ أي رسالة</li>
          <li>• استخدم العمليات الجماعية لإدارة عدة رسائل في آن واحد</li>
        </ul>
      </div>
    </PanelWrapper>
  );
}
