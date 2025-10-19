import React, { useState, useRef } from 'react'

export default function PatientsTable({ patients, onToggle, onReorder, onDeletePatient, onToggleAll, selectAll, onEditPatient }){
  const [dragIndex, setDragIndex] = useState(null)
  const [hoverIndex, setHoverIndex] = useState(null)
  const draggingRef = useRef(null)

  function handleDragStart(e, idx){
    setDragIndex(idx)
    draggingRef.current = idx
    e.dataTransfer.effectAllowed = 'move'
    // add a dragging class to change cursor while dragging
    try{ document.body.classList.add('dragging') }catch(e){}
  }
  function handleDragOver(e, idx){
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setHoverIndex(idx)
  }
  function handleDrop(e, idx){
    e.preventDefault()
    const from = draggingRef.current
    const to = idx
    if (from == null) return
    if (from !== to && onReorder) onReorder(from, to)
    setDragIndex(null)
    draggingRef.current = null
    setHoverIndex(null)
    try{ document.body.classList.remove('dragging') }catch(e){}
  }

  function handleKeyToggle(e, idx){
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onToggle && onToggle(idx)
    }
  }

  return (
    <div className="bg-white border rounded shadow-sm">
      <table className="w-full" role="table" aria-label="قائمة المرضى">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-3 text-right">
              <div className="flex items-center">
                {/* Render as controlled only when handlers are provided, otherwise use defaultChecked/readOnly to avoid React warnings in tests */}
                {onToggleAll ? (
                  <input aria-label="select-all-patients" type="checkbox" checked={!!selectAll} onChange={onToggleAll} />
                ) : (
                  <input aria-label="select-all-patients" type="checkbox" defaultChecked={!!selectAll} readOnly />
                )}
                <label className="text-sm text-gray-600 mr-2">تحديد الكل</label>
              </div>
            </th>
            <th className="p-3 text-right">سحب</th>
            <th className="p-3 text-right">الترتيب</th>
            <th className="p-3 text-right">الاسم الكامل</th>
            <th className="p-3 text-right">رقم الهاتف</th>
            <th className="p-3 text-right">الإجراءات</th>
          </tr>
        </thead>
        <tbody>
          {(!patients || patients.length === 0) ? (
            <tr>
              <td colSpan="5" className="p-6 text-center text-gray-500">لا يوجد مرضى في هذا الطابور</td>
            </tr>
          ) : (
            patients.map((p,i)=> (
              <tr
                key={p.id ?? `tmp-${i}`}
                className={`border-t transition-transform duration-150 ${p._optimistic ? 'opacity-70' : ''} ${hoverIndex === i ? 'bg-blue-50 border-blue-200 -translate-y-1 shadow-md animate-slide-in' : ''}`}
                draggable
                onDragStart={(e)=>handleDragStart(e,i)}
                onDragOver={(e)=>handleDragOver(e,i)}
                onDrop={(e)=>handleDrop(e,i)}
                onDragEnd={()=>{ setHoverIndex(null); setDragIndex(null); draggingRef.current = null; try{ document.body.classList.remove('dragging') }catch(e){} }}
                tabIndex={0}
                onKeyDown={(e)=>handleKeyToggle(e,i)}
                role="row"
              >
                  <td className="p-3 text-right align-middle">
                  {onToggle ? (
                    <input aria-label={`select-patient-${i}`} type="checkbox" checked={!!p._selected} onChange={()=>onToggle(i)} />
                  ) : (
                    <input aria-label={`select-patient-${i}`} type="checkbox" defaultChecked={!!p._selected} readOnly />
                  )}
                </td>
                  <td className="p-3 text-right align-middle" title="سحب لإعادة الترتيب">
                    <span className="drag-handle inline-flex items-center justify-center w-8 h-8 rounded bg-gray-100 text-gray-600 cursor-grab" aria-hidden onMouseDown={()=>{ try{ document.body.classList.add('dragging') }catch(e){} }} onMouseUp={()=>{ try{ document.body.classList.remove('dragging') }catch(e){} }}>☰</span>
                  </td>
                  <td className="p-3 text-right align-middle" role="cell" title={p.fullName || ''}>
                    <div className="font-medium text-gray-800">{p.fullName}</div>
                  </td>
                  <td className="p-3 text-right align-middle" role="cell" title={p.phoneNumber || ''}>
                    <div className="text-sm text-gray-600">{p.phoneNumber}</div>
                  </td>
                  <td className="p-3 text-right align-middle" role="cell">
                    <div className="text-sm text-gray-700">{p.position}</div>
                  </td>
                  <td className="p-3 text-right align-middle">
                    <div className="flex items-center justify-end gap-3">
                      {onEditPatient ? (
                        <button type="button" aria-label={`تعديل المريض ${p.fullName}`} onClick={()=> onEditPatient(p)} className="text-blue-600 hover:text-blue-700 text-sm">تعديل</button>
                      ) : null}
                      {onDeletePatient ? (
                        <button type="button" aria-label={`حذف المريض ${p.fullName}`} onClick={()=> onDeletePatient(p.id)} className="text-red-600 hover:text-red-700 text-sm">حذف</button>
                      ) : null}
                    </div>
                  </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
