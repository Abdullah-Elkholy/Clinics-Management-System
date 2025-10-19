import React, { useState, useEffect } from 'react'
import ModalWrapper from './ModalWrapper'

export default function EditUserModal({ open, user, onClose, onSave }){
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [username, setUsername] = useState('')
  const [errors, setErrors] = useState({})

  useEffect(()=>{
    if (user) { setFirst(user.firstName||''); setLast(user.lastName||''); setUsername(user.username||'') }
  },[user])

  useEffect(()=>{
    const e = {}
    if (!first || !first.trim()) e.first = 'الاسم الأول مطلوب'
    if (!username || !username.trim()) e.username = 'اسم المستخدم مطلوب'
    setErrors(e)
  },[first, username])

  const canSave = Object.keys(errors).length === 0

  if (!open) return null
  return (
    <ModalWrapper open={open} onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">تعديل المستخدم</h3>
          <button onClick={onClose} className="text-gray-500 p-2 rounded hover:bg-gray-100">✕</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm">الاسم الأول</label>
            <input value={first} onChange={e=>setFirst(e.target.value)} className="w-full px-3 py-2 border rounded mt-1" />
            {errors.first && <div role="alert" className="text-sm text-red-600 mt-1">{errors.first}</div>}
          </div>
          <div>
            <label className="block text-sm">الاسم الأخير</label>
            <input value={last} onChange={e=>setLast(e.target.value)} className="w-full px-3 py-2 border rounded mt-1" />
          </div>
          <div>
            <label className="block text-sm">اسم المستخدم</label>
            <input value={username} onChange={e=>setUsername(e.target.value)} className="w-full px-3 py-2 border rounded mt-1" />
            {errors.username && <div role="alert" className="text-sm text-red-600 mt-1">{errors.username}</div>}
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded bg-gray-100">إلغاء</button>
          <button disabled={!canSave} onClick={() => { if (!canSave) return; onSave && onSave({ first, last, username }); onClose && onClose() }} className={`px-4 py-2 rounded text-white ${canSave ? 'bg-blue-600' : 'bg-gray-300 cursor-not-allowed'}`}>حفظ</button>
        </div>
      </div>
    </ModalWrapper>
  )
}
