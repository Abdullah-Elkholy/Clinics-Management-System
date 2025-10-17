import React from 'react'

export default function QueueList({ queues, selectedQueue, onSelect }){
  return (
    <aside aria-label="قائمة الطوابير">
      <h3 className="font-bold mb-2">الطوابير</h3>
      <div className="space-y-2">
        {queues.map(q=> (
          <button aria-pressed={selectedQueue===q.id} key={q.id} onClick={()=>onSelect(q.id)} className={`w-full text-right p-3 rounded border ${selectedQueue===q.id ? 'bg-blue-50 border-blue-300' : ''}`}>
            <div className="font-medium">{q.doctorName ?? q.name ?? q.title}</div>
            <div className="text-xs text-gray-500">{q.description ?? q.summary}</div>
          </button>
        ))}
      </div>
    </aside>
  )
}
