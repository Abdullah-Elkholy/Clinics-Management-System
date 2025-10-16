import React, { useState, useRef } from 'react'

export default function PatientsTable({ patients, onToggle, onReorder }){
  const [dragIndex, setDragIndex] = useState(null)
  const draggingRef = useRef(null)

  function handleDragStart(e, idx){
    setDragIndex(idx)
    draggingRef.current = idx
    e.dataTransfer.effectAllowed = 'move'
  }
  function handleDragOver(e, idx){
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }
  function handleDrop(e, idx){
    e.preventDefault()
    const from = draggingRef.current
    const to = idx
    if (from == null) return
    if (from !== to && onReorder) onReorder(from, to)
    setDragIndex(null)
    draggingRef.current = null
  }

  return (
    <div className="bg-white border rounded">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-3 text-right">تحديد</th>
            <th className="p-3 text-right">سحب</th>
            <th className="p-3 text-right">الاسم</th>
            <th className="p-3 text-right">هاتف</th>
            <th className="p-3 text-right">ترتيب</th>
          </tr>
        </thead>
        <tbody>
          {patients.map((p,i)=> (
            <tr key={p.id ?? `tmp-${i}`} className={`border-t ${p._optimistic ? 'opacity-70' : ''}`} draggable onDragStart={(e)=>handleDragStart(e,i)} onDragOver={(e)=>handleDragOver(e,i)} onDrop={(e)=>handleDrop(e,i)}>
              <td className="p-3 text-right"><input aria-label={`select-patient-${i}`} type="checkbox" checked={!!p._selected} onChange={()=>onToggle(i)} /></td>
              <td className="p-3 text-right"><span className="drag-handle">☰</span></td>
              <td className="p-3 text-right">{p.fullName}</td>
              <td className="p-3 text-right">{p.phoneNumber}</td>
              <td className="p-3 text-right">{p.position}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
