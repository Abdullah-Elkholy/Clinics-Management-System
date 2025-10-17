import React, { useState, useRef } from 'react'

export default function PatientsTable({ patients, onToggle, onReorder, onDeletePatient }){
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

  function handleKeyToggle(e, idx){
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onToggle && onToggle(idx)
    }
  }

  return (
    <div className="bg-white border rounded">
      <table className="w-full" role="table" aria-label="قائمة المرضى">
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
          {(!patients || patients.length === 0) ? (
            <tr>
              <td colSpan="5" className="p-6 text-center text-gray-500">لا يوجد مرضى في هذا الطابور</td>
            </tr>
          ) : (
            patients.map((p,i)=> (
              <tr key={p.id ?? `tmp-${i}`} className={`border-t ${p._optimistic ? 'opacity-70' : ''}`} draggable onDragStart={(e)=>handleDragStart(e,i)} onDragOver={(e)=>handleDragOver(e,i)} onDrop={(e)=>handleDrop(e,i)} tabIndex={0} onKeyDown={(e)=>handleKeyToggle(e,i)} role="row">
                <td className="p-3 text-right"><input aria-label={`select-patient-${i}`} type="checkbox" checked={!!p._selected} onChange={()=>onToggle(i)} /></td>
                <td className="p-3 text-right"><span className="drag-handle" aria-hidden>☰</span></td>
                <td className="p-3 text-right" role="cell" title={p.fullName || ''}>{p.fullName}</td>
                <td className="p-3 text-right" role="cell" title={p.phoneNumber || ''}>{p.phoneNumber}</td>
                <td className="p-3 text-right" role="cell">{p.position}</td>
                <td className="p-3 text-right">
                  {onDeletePatient ? (
                    <button aria-label={`حذف المريض ${p.fullName}`} onClick={()=> onDeletePatient(p.id)} className="text-red-600 hover:text-red-700">حذف</button>
                  ) : null}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
