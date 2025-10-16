import React, { useEffect, useState } from 'react'
import api from '../../lib/api'

export default function SidebarQueues(){
  const [queues, setQueues] = useState([])
  useEffect(()=>{
    let mounted = true
    api.get('/api/queues').then(r=>{ if(mounted) setQueues(r.data?.data ?? []) }).catch(()=>{})
    return ()=> mounted = false
  },[])

  return (
    <div className="w-1/4 bg-white shadow-lg border-l border-gray-200">
      <nav className="p-4">
        <ul className="space-y-2">
          {queues.map(q=> (
            <li key={q.id}>
              <button className="nav-item w-full text-right px-4 py-3 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition duration-200 flex items-center justify-between">
                <span>{q.name}</span>
                <i className="fas fa-angle-left" />
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
