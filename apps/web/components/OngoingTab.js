import React, { useState } from 'react'
import Icon from './Icon'
import { useI18n } from '../lib/i18n'
import { showToast } from '../lib/toast'

/**
 * OngoingTab - Shows active message sending sessions with real-time progress
 * Matches prototype functionality for tracking ongoing tasks
 */
export default function OngoingTab({ sessions = [], onPause, onResume, onDelete }) {
  const i18n = useI18n()
  const [expandedSessions, setExpandedSessions] = useState(new Set())
  const [showMessages, setShowMessages] = useState({})

  const toggleSession = (sessionId) => {
    const newExpanded = new Set(expandedSessions)
    if (newExpanded.has(sessionId)) {
      newExpanded.delete(sessionId)
    } else {
      newExpanded.add(sessionId)
    }
    setExpandedSessions(newExpanded)
  }

  const toggleMessages = (sessionId) => {
    setShowMessages(prev => ({
      ...prev,
      [sessionId]: !prev[sessionId]
    }))
  }

  const handleSelectAll = (sessionId, checked) => {
    // Implementation for select all functionality
    showToast(i18n.t('ongoing.select_all', 'تم تحديد/إلغاء تحديد جميع المرضى'), 'success')
  }

  const handleDeleteSelected = (sessionId) => {
    // Implementation for deleting selected patients
    showToast(i18n.t('ongoing.delete_selected', 'تم حذف المرضى المحددين'), 'success')
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="text-center py-12" role="status">
        <Icon name="fa-inbox" className="text-gray-400 text-5xl mb-4" />
        <p className="text-gray-600 text-lg">{i18n.t('ongoing.no_tasks', 'لا توجد مهام جارية حالياً')}</p>
        <p className="text-gray-500 text-sm mt-2">{i18n.t('ongoing.no_tasks_desc', 'ستظهر هنا المهام النشطة عند بدء إرسال الرسائل')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6" role="region" aria-label={i18n.t('ongoing.main_label', 'المهام الجارية')}>
      {/* Pause All Button */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => showToast(i18n.t('ongoing.pause_all', 'تم إيقاف جميع المهام مؤقتاً'), 'warning')}
          className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2 space-x-reverse transition"
        >
          <Icon name="fa-pause" />
          <span>{i18n.t('ongoing.pause_all_btn', 'إيقاف جميع المهام')}</span>
        </button>
      </div>

      {/* Sessions List */}
      {sessions.map((session) => {
        const isExpanded = expandedSessions.has(session.sessionId)
        const progress = session.total > 0 ? (session.sent / session.total) * 100 : 0
        const messagesVisible = showMessages[session.sessionId]

        return (
          <div
            key={session.sessionId}
            className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden"
          >
            {/* Session Header */}
            <div className="bg-gradient-to-l from-blue-50 to-purple-50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 space-x-reverse flex-1">
                  <button
                    type="button"
                    onClick={() => toggleSession(session.sessionId)}
                    className="text-gray-600 hover:text-gray-800 transition"
                    aria-expanded={isExpanded}
                    aria-controls={`session-${session.sessionId}`}
                  >
                    <Icon
                      name={isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}
                      className="text-lg"
                    />
                  </button>

                  <div className="flex-1">
                    <div className="flex items-center space-x-3 space-x-reverse mb-2">
                      <h3 className="text-lg font-bold text-gray-800">{session.queueName}</h3>
                      <span className="text-sm text-gray-600 bg-white px-3 py-1 rounded-full">
                        {session.sessionId}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">
                          {i18n.t('ongoing.progress', 'تم إرسال {sent} من {total}', {
                            sent: session.sent,
                            total: session.total,
                          })}
                        </span>
                        <span className="font-bold text-blue-600">{progress.toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress}%` }}
                          role="progressbar"
                          aria-valuenow={progress}
                          aria-valuemin="0"
                          aria-valuemax="100"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="text-sm text-gray-600">
                    <Icon name="fa-clock" className="ml-1" />
                    {session.startTime}
                  </div>
                </div>
              </div>
            </div>

            {/* Expanded Patient List */}
            {isExpanded && (
              <div id={`session-${session.sessionId}`} className="p-4">
                {/* Controls */}
                <div className="flex items-center justify-between mb-4">
                  <button
                    type="button"
                    onClick={() => toggleMessages(session.sessionId)}
                    className="text-blue-600 hover:text-blue-700 text-sm flex items-center space-x-1 space-x-reverse"
                  >
                    <Icon name={messagesVisible ? 'fa-eye-slash' : 'fa-eye'} />
                    <span>
                      {messagesVisible
                        ? i18n.t('ongoing.hide_messages', 'إخفاء الرسائل')
                        : i18n.t('ongoing.show_messages', 'إظهار الرسائل')}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteSelected(session.sessionId)}
                    className="text-red-600 hover:text-red-700 text-sm flex items-center space-x-1 space-x-reverse"
                  >
                    <Icon name="fa-trash" />
                    <span>{i18n.t('ongoing.delete_selected', 'حذف المحدد')}</span>
                  </button>
                </div>

                {/* Patients Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="p-2 text-right">
                          <input
                            type="checkbox"
                            onChange={(e) => handleSelectAll(session.sessionId, e.target.checked)}
                            className="rounded"
                          />
                        </th>
                        <th className="p-2 text-right">{i18n.t('ongoing.position', 'الترتيب')}</th>
                        <th className="p-2 text-right">{i18n.t('ongoing.name', 'الاسم')}</th>
                        <th className="p-2 text-right">{i18n.t('ongoing.phone', 'الهاتف')}</th>
                        {messagesVisible && (
                          <th className="p-2 text-right">{i18n.t('ongoing.message', 'الرسالة')}</th>
                        )}
                        <th className="p-2 text-right">{i18n.t('ongoing.status', 'الحالة')}</th>
                        <th className="p-2 text-right">{i18n.t('ongoing.actions', 'الإجراءات')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {session.patients?.map((patient) => (
                        <tr key={patient.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="p-2">
                            <input type="checkbox" className="rounded" />
                          </td>
                          <td className="p-2">{patient.position}</td>
                          <td className="p-2 font-medium">{patient.name}</td>
                          <td className="p-2 text-gray-600">{patient.phone}</td>
                          {messagesVisible && (
                            <td className="p-2 text-xs text-gray-600 max-w-xs truncate">
                              {patient.message}
                            </td>
                          )}
                          <td className="p-2">
                            {patient.status === 'sent' ? (
                              <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                                <Icon name="fa-check" className="ml-1" />
                                {i18n.t('ongoing.sent', 'تم الإرسال')}
                              </span>
                            ) : patient.status === 'failed' ? (
                              <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs">
                                <Icon name="fa-times" className="ml-1" />
                                {i18n.t('ongoing.failed', 'فشل')}
                              </span>
                            ) : (
                              <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs">
                                <Icon name="fa-clock" className="ml-1" />
                                {i18n.t('ongoing.pending', 'في الانتظار')}
                              </span>
                            )}
                          </td>
                          <td className="p-2">
                            <div className="flex items-center space-x-2 space-x-reverse">
                              <button
                                type="button"
                                className="text-blue-600 hover:text-blue-700"
                                aria-label={i18n.t('ongoing.edit_patient', 'تعديل المريض')}
                              >
                                <Icon name="fa-edit" />
                              </button>
                              <button
                                type="button"
                                className="text-red-600 hover:text-red-700"
                                aria-label={i18n.t('ongoing.delete_patient', 'حذف المريض')}
                              >
                                <Icon name="fa-trash" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
