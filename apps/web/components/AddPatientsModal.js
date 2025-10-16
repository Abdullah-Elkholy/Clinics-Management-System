import React, { useState } from 'react'

export default function AddPatientsModal({ open, onClose, onAdd }){
  const [slots, setSlots] = useState([{ fullName: '', phoneNumber: '', desiredPosition: '' }])
  const [submitting, setSubmitting] = useState(false)

  function addSlot(){ setSlots(s => [...s, { fullName: '', phoneNumber: '', desiredPosition: '' }]) }
  function updateSlot(i, key, value){ setSlots(s => s.map((it,idx) => idx===i ? {...it,[key]:value} : it)) }
  function removeSlot(i){ setSlots(s => s.filter((_,idx)=>idx!==i)) }

  async function submit(){
    const toAdd = slots.filter(s => s.fullName.trim())
    if (!toAdd.length) return alert('أدخل اسم واحد على الأقل')
    try{
      setSubmitting(true)
      // map desiredPosition to int? and pass through
      const payload = toAdd.map(s => ({ fullName: s.fullName, phoneNumber: s.phoneNumber, desiredPosition: s.desiredPosition ? parseInt(s.desiredPosition,10) : undefined }))
      await onAdd(payload)
    }finally{ setSubmitting(false) }
    setSlots([{ fullName: '', phoneNumber: '' }])
    onClose()
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-96 overflow-y-auto">
        <h3 className="text-xl font-bold mb-4">إضافة مرضى جدد</h3>
        <div className="space-y-4">
          {slots.map((s,i)=> (
            <div key={i} className="patient-slot border border-gray-200 rounded-lg p-4 mb-2">
              <div className="flex items-center mb-3 justify-between">
                <div className="text-sm text-gray-500">مظهر رقمي: اترك فارغاً ليتم الإلحاق في النهاية</div>
                <button onClick={()=>removeSlot(i)} className="text-red-500">حذف</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">الاسم الكامل</label>
                  <input value={s.fullName} onChange={e=>updateSlot(i,'fullName',e.target.value)} type="text" className="w-full px-3 py-2 border rounded-lg" placeholder="أدخل الاسم الكامل" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">رقم الهاتف</label>
                  <input value={s.phoneNumber} onChange={e=>updateSlot(i,'phoneNumber',e.target.value)} type="text" className="w-full px-3 py-2 border rounded-lg" placeholder="رقم الهاتف" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">الموقع المرغوب (اختياري)</label>
                  <input value={s.desiredPosition} onChange={e=>updateSlot(i,'desiredPosition',e.target.value)} type="number" min="1" className="w-full px-3 py-2 border rounded-lg" placeholder="مثال: 3" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center space-x-3 mt-4 justify-between">
          <button onClick={addSlot} className="bg-blue-600 text-white px-4 py-2 rounded">إضافة صف</button>
          <div className="flex space-x-2">
            <button onClick={onClose} className="bg-gray-300 text-gray-700 px-4 py-2 rounded">إلغاء</button>
            <button onClick={submit} className="bg-green-600 text-white px-4 py-2 rounded">{submitting ? 'جارٍ الإضافة...' : 'إضافة المرضى'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
