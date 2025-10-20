import React, { useState, useEffect } from 'react'
import ModalWrapper from './ModalWrapper'

export default function QuotaManagementModal({ open, moderator, onClose, onSave }){
  const [addMessages, setAddMessages] = useState(0)
  const [addQueues, setAddQueues] = useState(0)
  const [errors, setErrors] = useState({})
  useEffect(()=>{
    const e = {}
    if (!Number.isFinite(addMessages) || addMessages < 0) e.addMessages = 'يجب أن يكون رقمًا صحيحًا غير سالب'
    if (!Number.isFinite(addQueues) || addQueues < 0) e.addQueues = 'يجب أن يكون رقمًا صحيحًا غير سالب'
    setErrors(e)
  },[addMessages, addQueues])
  const canSave = Object.keys(errors).length === 0
  if (!open) return null
  return (
    <ModalWrapper open={open} onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">إدارة الحصة للمشرف</h3>
          <button type="button" onClick={onClose} className="text-gray-500 p-2 rounded hover:bg-gray-100">✕</button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-gray-50 p-4 rounded">
            <div className="text-sm text-gray-500">الرصيد الكلي للرسائل</div>
            <div className="text-2xl font-bold">{moderator?.messagesQuota ?? 0}</div>
            <div className="text-sm text-gray-500">مستخدم: {moderator?.consumedMessages ?? 0}</div>
          </div>
          <div className="bg-gray-50 p-4 rounded">
            <div className="text-sm text-gray-500">حصة الطوابير</div>
            <div className="text-2xl font-bold">{moderator?.queuesQuota ?? 0}</div>
            <div className="text-sm text-gray-500">مستخدم: {moderator?.consumedQueues ?? 0}</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm">إضافة رسائل</label>
            <input type="number" value={addMessages} onChange={e=>setAddMessages(parseInt(e.target.value||'0',10))} className="w-full px-3 py-2 border rounded mt-1" />
            {errors.addMessages && <div role="alert" className="text-sm text-red-600 mt-1">{errors.addMessages}</div>}
          </div>
          <div>
            <label className="text-sm">إضافة طوابير</label>
            <input type="number" value={addQueues} onChange={e=>setAddQueues(parseInt(e.target.value||'0',10))} className="w-full px-3 py-2 border rounded mt-1" />
            {errors.addQueues && <div role="alert" className="text-sm text-red-600 mt-1">{errors.addQueues}</div>}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded bg-gray-100">إغلاق</button>
          <button type="button" disabled={!canSave} onClick={() => { if (!canSave) return; onSave && onSave({ addMessages, addQueues }); onClose && onClose() }} className={`px-4 py-2 rounded text-white ${canSave ? 'bg-blue-600' : 'bg-gray-300 cursor-not-allowed'}`}>حفظ</button>
        </div>
      </div>
    </ModalWrapper>
  )
}
