import React, { useEffect, useRef, useState } from 'react'
import ModalWrapper from './ModalWrapper'
import { showToast } from './Toast'

export default function EditPatientModal({ open = false, patient = null, onClose = null, onSave = null }){
  const nameRef = useRef(null)
  const [fullName, setFullName] = useState(patient?.fullName || '')
  const [phoneNumber, setPhoneNumber] = useState(patient?.phoneNumber || '')
  const [position, setPosition] = useState(patient?.position || '')
  const [errors, setErrors] = useState({})

  useEffect(()=>{
    if (open && patient){
      setFullName(patient.fullName || '')
      setPhoneNumber(patient.phoneNumber || '')
      setPosition(patient.position || '')
      const t = setTimeout(()=>{ try{ nameRef.current?.focus() }catch(e){} }, 10)
      return ()=> clearTimeout(t)
    }
  },[open, patient])

  function validate(){
    const e = {}
    if (!fullName || !fullName.toString().trim()) e.fullName = 'الاسم مطلوب'
    // phone number optional but basic sanity
    if (phoneNumber && !/^[0-9+\-\s()]+$/.test(phoneNumber)) e.phoneNumber = 'رقم هاتف غير صالح'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave(){
    if (!validate()) return
    if (!onSave) return onClose && onClose()
    try{
      await onSave({ id: patient.id, fullName: fullName.toString().trim(), phoneNumber: phoneNumber.toString().trim(), position })
      showToast('تم حفظ بيانات المريض')
      onClose && onClose()
    }catch(e){
      showToast('فشل في حفظ بيانات المريض')
    }
  }

  if (!patient) return null

  return (
    <ModalWrapper open={open} onClose={onClose} dir="rtl" initialFocusRef={nameRef} labelId="edit-patient-title">
      <h3 id="edit-patient-title" className="text-lg font-bold mb-4">تعديل بيانات المريض</h3>
      <label className="block text-sm mb-1">الاسم الكامل</label>
      <input ref={nameRef} value={fullName} onChange={e=>setFullName(e.target.value)} className="w-full p-2 border rounded mb-2" aria-invalid={errors.fullName ? 'true' : 'false'} />
      {errors.fullName && <div className="text-red-600 text-sm mb-2">{errors.fullName}</div>}

      <label className="block text-sm mb-1">رقم الهاتف</label>
      <input value={phoneNumber} onChange={e=>setPhoneNumber(e.target.value)} className="w-full p-2 border rounded mb-2" aria-invalid={errors.phoneNumber ? 'true' : 'false'} />
      {errors.phoneNumber && <div className="text-red-600 text-sm mb-2">{errors.phoneNumber}</div>}

      <label className="block text-sm mb-1">الموضع (اختياري)</label>
      <input value={position} onChange={e=>setPosition(e.target.value)} className="w-full p-2 border rounded mb-2" />

      <div className="flex justify-end space-x-2">
        <button onClick={onClose} className="px-4 py-2">إلغاء</button>
        <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded">حفظ</button>
      </div>
    </ModalWrapper>
  )
}
