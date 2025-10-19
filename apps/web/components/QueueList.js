import React from 'react'
import Icon from './Icon'

export default function QueueList({ queues = [], selectedQueue, onSelect = () => {}, canAddQueue, onAddQueue, onEditQueue, onDeleteQueue, onRequestAddQueue }){
  return (
    <div className="p-4 border-t border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2 space-x-reverse">
          <h3 className="font-bold text-gray-800">الطوابير</h3>
          <div className="text-sm text-gray-500">({queues.length})</div>
        </div>
      </div>

      <div className="space-y-3" role="list" aria-label="قائمة الطوابير">
        {queues.map((q, idx) => {
          const displayName = (q.doctorName ?? q.name ?? q.title) || ''
          const ariaLabel = `طابور ${displayName}`

          const itemId = q.id ?? q._tempId ?? `queue-${idx}`
          const key = q.id ?? q._tempId ?? `queue-${idx}`

          return (
            <div key={key} className="relative" role="listitem" data-queue-item data-queue-id={itemId}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelect(itemId)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(itemId) } }}
                aria-pressed={selectedQueue === itemId}
                aria-label={ariaLabel}
                title={displayName}
                className={`w-full text-right p-4 rounded-xl border transition duration-200 flex items-center justify-between shadow-sm ${selectedQueue === itemId ? 'bg-gradient-to-l from-blue-50 to-white border-blue-300 ring-2 ring-blue-100' : 'bg-white border-gray-100 hover:shadow-md hover:from-blue-50 hover:to-white'}`}
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-blue-50 text-blue-600 font-semibold text-sm">{(displayName || '?').slice(0,2)}</div>
                  <div className="flex-1 text-right">
                    <div className="font-medium text-gray-800">{displayName}</div>
                    {q.description && (<div className="text-xs text-gray-500 mt-1">{q.description}</div>)}
                    <div className="mt-1 flex items-center gap-3">
                      {q.patientCount !== undefined && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{q.patientCount} مريض</span>
                      )}
                      {q.estimatedTime !== undefined && (
                        <span className="text-xs text-gray-500">تقديري: {q.estimatedTime} د</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3 space-x-reverse">
                  {selectedQueue === itemId && (
                    <Icon name="fas fa-check-circle text-blue-600 text-lg" />
                  )}
                  <Icon name="fas fa-angle-left text-gray-400" />
                </div>
              </div>

              {/* Controls appear on hover (left side) */}
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                <div className="flex flex-col space-y-1">
                  {onEditQueue && (
                    <button onClick={() => onEditQueue(itemId)} className="p-1 text-gray-500 hover:text-blue-600 transition-colors" aria-label={`تعديل طابور ${displayName}`}>
                      <Icon name="fas fa-edit" />
                    </button>
                  )}
                  {onDeleteQueue && (
                    <button onClick={() => onDeleteQueue(itemId)} className="p-1 text-gray-500 hover:text-red-600 transition-colors" aria-label={`حذف طابور ${displayName}`}>
                      <Icon name="fas fa-trash" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {canAddQueue && (
        <div className="mt-4 text-center">
          <button 
            onClick={() => { if (onRequestAddQueue) return onRequestAddQueue(); if (onAddQueue) return onAddQueue() }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-full hover:from-blue-700 hover:to-purple-700 shadow-md transition"
            aria-label="إضافة طابور"
          >
            <Icon name="fas fa-plus" />
            <span className="text-sm">إضافة طابور</span>
          </button>
        </div>
      )}
    </div>
  )
}
