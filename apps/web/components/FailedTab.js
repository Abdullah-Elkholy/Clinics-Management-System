import React, { useState } from 'react'
import Icon from './Icon'
import { useI18n } from '../lib/i18n'
import { showToast } from '../lib/toast'

/**
 * FailedTab - Shows failed message sending tasks with retry functionality
 * Matches prototype functionality for managing failed tasks
 */
export default function FailedTab({ failedTasks = [], onRetry, onRetryAll, onDelete }) {
  const i18n = useI18n()
  const [selectedTasks, setSelectedTasks] = useState(new Set())
  const [expandedTasks, setExpandedTasks] = useState(new Set())

  const toggleTask = (taskId) => {
    const newExpanded = new Set(expandedTasks)
    if (newExpanded.has(taskId)) {
      newExpanded.delete(taskId)
    } else {
      newExpanded.add(taskId)
    }
    setExpandedTasks(newExpanded)
  }

  const toggleSelection = (taskId) => {
    const newSelected = new Set(selectedTasks)
    if (newSelected.has(taskId)) {
      newSelected.delete(taskId)
    } else {
      newSelected.add(taskId)
    }
    setSelectedTasks(newSelected)
  }

  const toggleSelectAll = (checked) => {
    if (checked) {
      setSelectedTasks(new Set(failedTasks.map(t => t.taskId)))
    } else {
      setSelectedTasks(new Set())
    }
  }

  const handleRetrySelected = () => {
    if (selectedTasks.size === 0) {
      showToast(i18n.t('failed.no_selection', 'الرجاء تحديد مهام لإعادة المحاولة'), 'error')
      return
    }
    
    if (onRetry) {
      onRetry(Array.from(selectedTasks))
      showToast(
        i18n.t('failed.retry_started', 'بدأت إعادة محاولة {count} مهمة', { count: selectedTasks.size }),
        'success'
      )
      setSelectedTasks(new Set())
    }
  }

  const handleDeleteSelected = () => {
    if (selectedTasks.size === 0) {
      showToast(i18n.t('failed.no_selection', 'الرجاء تحديد مهام للحذف'), 'error')
      return
    }

    if (onDelete) {
      onDelete(Array.from(selectedTasks))
      showToast(
        i18n.t('failed.deleted', 'تم حذف {count} مهمة', { count: selectedTasks.size }),
        'success'
      )
      setSelectedTasks(new Set())
    }
  }

  const handleRetryAll = () => {
    if (onRetryAll) {
      onRetryAll()
      showToast(i18n.t('failed.retry_all_started', 'بدأت إعادة محاولة جميع المهام'), 'success')
    }
  }

  if (!failedTasks || failedTasks.length === 0) {
    return (
      <div className="text-center py-12" role="status">
        <Icon name="fa-check-circle" className="text-green-400 text-5xl mb-4" />
        <p className="text-gray-600 text-lg">{i18n.t('failed.no_failures', 'لا توجد مهام فاشلة')}</p>
        <p className="text-gray-500 text-sm mt-2">
          {i18n.t('failed.no_failures_desc', 'جميع الرسائل تم إرسالها بنجاح')}
        </p>
      </div>
    )
  }

  const allSelected = selectedTasks.size === failedTasks.length && failedTasks.length > 0

  return (
    <div className="space-y-6" role="region" aria-label={i18n.t('failed.main_label', 'المهام الفاشلة')}>
      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3 space-x-reverse">
          <button
            type="button"
            onClick={handleRetrySelected}
            disabled={selectedTasks.size === 0}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg flex items-center space-x-2 space-x-reverse transition"
          >
            <Icon name="fa-redo" />
            <span>
              {i18n.t('failed.retry_selected', 'إعادة محاولة المحدد')} 
              {selectedTasks.size > 0 && ` (${selectedTasks.size})`}
            </span>
          </button>

          <button
            type="button"
            onClick={handleRetryAll}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 space-x-reverse transition"
          >
            <Icon name="fa-sync" />
            <span>{i18n.t('failed.retry_all', 'إعادة محاولة الكل')}</span>
          </button>

          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={selectedTasks.size === 0}
            className="bg-red-600 hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg flex items-center space-x-2 space-x-reverse transition"
          >
            <Icon name="fa-trash" />
            <span>{i18n.t('failed.delete_selected', 'حذف المحدد')}</span>
          </button>
        </div>

        <div className="text-sm text-gray-600">
          <Icon name="fa-exclamation-triangle" className="text-red-500 ml-1" />
          {i18n.t('failed.total_failed', 'إجمالي الفاشل: {count}', { count: failedTasks.length })}
        </div>
      </div>

      {/* Failed Tasks List */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-red-50 border-b border-red-200">
              <tr>
                <th className="p-3 text-right">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => toggleSelectAll(e.target.checked)}
                    className="rounded"
                    aria-label={i18n.t('failed.select_all', 'تحديد الكل')}
                  />
                </th>
                <th className="p-3 text-right">{i18n.t('failed.queue', 'الطابور')}</th>
                <th className="p-3 text-right">{i18n.t('failed.patient', 'المريض')}</th>
                <th className="p-3 text-right">{i18n.t('failed.phone', 'رقم الهاتف')}</th>
                <th className="p-3 text-right">{i18n.t('failed.error', 'سبب الفشل')}</th>
                <th className="p-3 text-right">{i18n.t('failed.retry_count', 'عدد المحاولات')}</th>
                <th className="p-3 text-right">{i18n.t('failed.time', 'الوقت')}</th>
                <th className="p-3 text-right">{i18n.t('failed.actions', 'الإجراءات')}</th>
              </tr>
            </thead>
            <tbody>
              {failedTasks.map((task) => {
                const isExpanded = expandedTasks.has(task.taskId)
                const isSelected = selectedTasks.has(task.taskId)

                return (
                  <React.Fragment key={task.taskId}>
                    <tr className={`border-b border-gray-100 hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}>
                      <td className="p-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelection(task.taskId)}
                          className="rounded"
                        />
                      </td>
                      <td className="p-3 font-medium">{task.queueName}</td>
                      <td className="p-3">{task.patientName}</td>
                      <td className="p-3 text-gray-600 font-mono">{task.phone}</td>
                      <td className="p-3">
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <span className="text-red-600 truncate max-w-xs">{task.error}</span>
                          <button
                            type="button"
                            onClick={() => toggleTask(task.taskId)}
                            className="text-blue-600 hover:text-blue-700 text-xs"
                            aria-expanded={isExpanded}
                            aria-label={i18n.t('failed.toggle_details', 'عرض/إخفاء التفاصيل')}
                          >
                            <Icon name={isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'} />
                          </button>
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          task.retryCount >= 3 
                            ? 'bg-red-100 text-red-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {task.retryCount}
                        </span>
                      </td>
                      <td className="p-3 text-gray-600 text-xs">{task.failedAt}</td>
                      <td className="p-3">
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <button
                            type="button"
                            onClick={() => onRetry && onRetry([task.taskId])}
                            className="text-blue-600 hover:text-blue-700"
                            title={i18n.t('failed.retry_single', 'إعادة المحاولة')}
                          >
                            <Icon name="fa-redo" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete && onDelete([task.taskId])}
                            className="text-red-600 hover:text-red-700"
                            title={i18n.t('failed.delete_single', 'حذف')}
                          >
                            <Icon name="fa-trash" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Error Details */}
                    {isExpanded && (
                      <tr>
                        <td colSpan="8" className="bg-gray-50 p-4">
                          <div className="space-y-3">
                            <div>
                              <h4 className="font-bold text-gray-700 mb-1">
                                {i18n.t('failed.full_error', 'تفاصيل الخطأ الكاملة:')}
                              </h4>
                              <pre className="bg-white p-3 rounded border border-red-200 text-xs overflow-x-auto">
                                {task.errorDetails || task.error}
                              </pre>
                            </div>

                            <div>
                              <h4 className="font-bold text-gray-700 mb-1">
                                {i18n.t('failed.message_content', 'محتوى الرسالة:')}
                              </h4>
                              <div className="bg-white p-3 rounded border border-gray-200 text-sm">
                                {task.message}
                              </div>
                            </div>

                            {task.retryHistory && task.retryHistory.length > 0 && (
                              <div>
                                <h4 className="font-bold text-gray-700 mb-1">
                                  {i18n.t('failed.retry_history', 'سجل المحاولات:')}
                                </h4>
                                <ul className="bg-white p-3 rounded border border-gray-200 text-xs space-y-1">
                                  {task.retryHistory.map((retry, idx) => (
                                    <li key={idx} className="text-gray-600">
                                      {retry.time} - {retry.result}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-700 font-medium">
                {i18n.t('failed.total_tasks', 'إجمالي المهام')}
              </p>
              <p className="text-2xl font-bold text-red-900">{failedTasks.length}</p>
            </div>
            <Icon name="fa-exclamation-circle" className="text-red-400 text-3xl" />
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-yellow-700 font-medium">
                {i18n.t('failed.high_retry', 'محاولات عالية (≥3)')}
              </p>
              <p className="text-2xl font-bold text-yellow-900">
                {failedTasks.filter(t => t.retryCount >= 3).length}
              </p>
            </div>
            <Icon name="fa-redo" className="text-yellow-400 text-3xl" />
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-700 font-medium">
                {i18n.t('failed.selected', 'المحدد')}
              </p>
              <p className="text-2xl font-bold text-blue-900">{selectedTasks.size}</p>
            </div>
            <Icon name="fa-check-square" className="text-blue-400 text-3xl" />
          </div>
        </div>
      </div>
    </div>
  )
}
