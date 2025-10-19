import React, { useEffect, useState } from 'react'
import Icon from '../Icon'
import api from '../../lib/api'

export default function SidebarQueues(){
  const [queues, setQueues] = useState([])
  useEffect(()=>{
    let mounted = true
    api.get('/api/queues').then(r=>{ 
      if(!mounted) return
      const maybe = r.data?.data ?? r.data ?? []
      const list = Array.isArray(maybe) ? maybe : []
      const normalized = list.map(q => ({ id: q.id ?? q.Id, name: q.doctorName ?? q.DoctorName ?? q.name ?? q.title }))
      setQueues(normalized)
    }).catch(()=>{})
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
                <Icon name="fas fa-angle-left" />
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
