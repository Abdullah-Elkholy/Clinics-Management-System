import React, { useState, useEffect } from 'react'
import ModalWrapper from './ModalWrapper'

export default function MessageSelectionModal({ open, template, onClose, onSend }){
  const [text, setText] = useState('')
  useEffect(()=>{ if (template) setText(template.content || '') }, [template])
  if (!open) return null
  return (
    <ModalWrapper open={open} onClose={onClose}>
      <div className="bg-white rounded-2xl p-6 w-full max-w-3xl shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 id="message-modal-title" className="text-xl font-bold">معاينة / تعديل الرسالة</h3>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700 p-2 rounded" aria-label="إغلاق">✕</button>
          </div>
        </div>

        <div className="mb-3 text-sm text-gray-600">القالب: <strong>{template?.title || 'الرسالة الافتراضية'}</strong></div>
        <label htmlFor="message-text" className="sr-only">معاينة الرسالة</label>
        <textarea id="message-text" value={text} onChange={e=>setText(e.target.value)} rows={8} className="w-full p-4 border rounded-lg shadow-sm mb-4 focus:ring-2 focus:ring-purple-200" />

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="bg-gray-100 px-4 py-2 rounded-lg">إلغاء</button>
          <button onClick={()=>{ onSend(text); onClose() }} className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-2 rounded-lg">إرسال</button>
        </div>
      </div>
    </ModalWrapper>
  )
}
