import React from 'react'

export default function QueueList({ queues, selectedQueue, onSelect, canAddQueue, onAddQueue, onEditQueue, onDeleteQueue, onRequestAddQueue }){
  return (
    <div className="p-4 border-t border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2 space-x-reverse">
          <h3 className="font-bold text-gray-800">الطوابير</h3>
          <div className="text-sm text-gray-500">({queues.length})</div>
        </div>
      </div>
      
      <div className="space-y-2" role="list" aria-label="قائمة الطوابير">
        {queues.map(q => {
          const displayName = (q.doctorName ?? q.name ?? q.title) || ''
          const ariaLabel = `طابور ${displayName}`

          return (
            <div key={q.id} className="relative group" role="listitem" data-queue-item data-queue-id={q.id}>
              <button
                onClick={() => onSelect(q.id)}
                aria-pressed={selectedQueue === q.id}
                aria-label={ariaLabel}
                title={displayName}
                className={`w-full text-right p-4 rounded-lg border transition duration-200 ${selectedQueue === q.id ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 hover:bg-gray-50'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium">{displayName}</div>
                    {q.description && (
                      <div className="text-xs text-gray-500 mt-1">{q.description}</div>
                    )}
                    {q.patientCount !== undefined && (
                      <div className="text-xs text-blue-600 mt-1">{q.patientCount} مريض</div>
                    )}
                  </div>
                  {selectedQueue === q.id && (
                    <div className="mr-2">
                      <i className="fas fa-check-circle text-blue-600" aria-hidden="true"></i>
                    </div>
                  )}
                </div>
              </button>

              {/* Queue Controls - Only visible on hover or when selected */}
              <div className={`absolute left-2 top-1/2 transform -translate-y-1/2 space-x-1 ${(selectedQueue === q.id || true) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity duration-200`}>
                {onEditQueue && (
                  <button onClick={() => onEditQueue(q.id)} className="p-1 text-gray-500 hover:text-blue-600 transition-colors" aria-label={`تعديل طابور ${displayName}`}>
                    <i className="fas fa-edit" aria-hidden="true"></i>
                  </button>
                )}
                {onDeleteQueue && (
                  <button onClick={() => onDeleteQueue(q.id)} className="p-1 text-gray-500 hover:text-red-600 transition-colors" aria-label={`حذف طابور ${displayName}`}>
                    <i className="fas fa-trash" aria-hidden="true"></i>
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {canAddQueue && (
        <div className="mt-3">
          <button 
            onClick={() => {
              if (onRequestAddQueue) return onRequestAddQueue()
              if (onAddQueue) return onAddQueue()
            }}
            className="bg-blue-600 text-white w-8 h-8 rounded-full hover:bg-blue-700 transition duration-200 flex items-center justify-center"
            aria-label="إضافة طابور"
          >
            <i className="fas fa-plus text-sm" aria-hidden="true"></i>
          </button>
        </div>
      )}
    </div>
  )
}
