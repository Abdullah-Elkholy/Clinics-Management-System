import React, { useState } from 'react'
import ModalWrapper from './ModalWrapper'

export default function AddPatientsModal({ open, onClose, onAdd }){
  const MAX_SLOTS = 50
  const [slots, setSlots] = useState([{ fullName: '', countryCode: '+20', phoneNumber: '', desiredPosition: '' }])
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState({})

  function addSlot(){
    setSlots(s => {
      if (s.length >= MAX_SLOTS) return s
      return [...s, { fullName: '', countryCode: '+20', phoneNumber: '', desiredPosition: '' }]
    })
  }
  function updateSlot(i, key, value){ setSlots(s => s.map((it,idx) => idx===i ? {...it,[key]:value} : it)) }
  function removeSlot(i){ setSlots(s => s.filter((_,idx)=>idx!==i)) }

  async function submit(){
    // validate slots
    const errs = {}
    const toAdd = []
    slots.forEach((s,i)=>{
      const e = {}
      if (!s.fullName || !s.fullName.trim()) e.fullName = 'الاسم الكامل مطلوب'
      if (!s.phoneNumber || !s.phoneNumber.trim()) e.phoneNumber = 'رقم الهاتف مطلوب'
      if (Object.keys(e).length) errs[i] = e
      else toAdd.push(s)
    })
    setErrors(errs)
    if (!toAdd.length) return
    try{
      setSubmitting(true)
      // map desiredPosition to int? and pass through
      const payload = toAdd.map(s => ({ fullName: s.fullName, phoneNumber: s.phoneNumber, desiredPosition: s.desiredPosition ? parseInt(s.desiredPosition,10) : undefined }))
      await onAdd(payload)
    }finally{ setSubmitting(false) }
  setSlots([{ fullName: '', countryCode: '+20', phoneNumber: '', desiredPosition: '' }])
    onClose()
  }

  if (!open) return null
  return (
    <ModalWrapper open={open} onClose={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-3xl max-h-[70vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">إضافة مرضى جدد</h3>
          <div className="text-sm text-gray-500">الحد الأقصى: {MAX_SLOTS} مريض</div>
        </div>
        <div className="space-y-4">
          {slots.map((s,i)=> (
            <div key={i} className="patient-slot border border-gray-100 rounded-lg p-4 mb-2 bg-white">
              <div className="flex items-center mb-3 justify-between">
                <div className="text-sm text-gray-500">الاسم والمعلومات</div>
                <button onClick={()=>removeSlot(i)} className="text-red-500 p-1 rounded hover:bg-red-50">حذف</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">الاسم الكامل</label>
                  <input value={s.fullName} onChange={e=>updateSlot(i,'fullName',e.target.value)} type="text" className="w-full px-3 py-2 border rounded-lg" placeholder="أدخل الاسم الكامل" />
                  {errors[i] && errors[i].fullName && <div role="alert" className="text-sm text-red-600 mt-1">{errors[i].fullName}</div>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">رقم الهاتف</label>
                  <div className="flex">
                    <select value={s.countryCode} onChange={e=>updateSlot(i,'countryCode',e.target.value)} className="country-code px-2 py-2 border border-gray-300 rounded-r-lg bg-gray-50">
                      <option value="+20">+20 (مصر)</option>
                      <option value="+966">+966 (السعودية)</option>
                      <option value="+971">+971 (الإمارات)</option>
                    </select>
                    <input value={s.phoneNumber} onChange={e=>updateSlot(i,'phoneNumber',e.target.value)} type="tel" className="phone-input flex-1 px-3 py-2 border border-gray-300 rounded-l-lg" placeholder="رقم الهاتف" />
                  </div>
                  {errors[i] && errors[i].phoneNumber && <div role="alert" className="text-sm text-red-600 mt-1">{errors[i].phoneNumber}</div>}
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
          <div>
            <button disabled={(slots || []).length >= MAX_SLOTS} onClick={addSlot} className="bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg">إضافة صف</button>
            <span className="text-sm text-gray-500 mr-3">الحد الأقصى: {MAX_SLOTS} مريض</span>
          </div>
          <div className="flex space-x-2">
            <button onClick={onClose} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg">إلغاء</button>
            <button onClick={submit} disabled={submitting} className={`px-4 py-2 rounded-lg text-white ${submitting ? 'bg-gray-300 cursor-not-allowed' : 'bg-gradient-to-r from-emerald-600 to-green-500'}`}>{submitting ? 'جارٍ الإضافة...' : 'إضافة المرضى'}</button>
          </div>
        </div>
      </div>
    </ModalWrapper>
  )
}
