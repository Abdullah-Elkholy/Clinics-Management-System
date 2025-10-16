import React, { useState, useEffect } from 'react'

export default function MessageSelectionModal({ open, template, onClose, onSend }){
  const [text, setText] = useState('')
  useEffect(()=>{ if (template) setText(template.content || '') }, [template])
  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="message-modal-title">
      <div className="bg-white rounded-xl p-6 w-full max-w-2xl">
        <h3 id="message-modal-title" className="text-xl font-bold mb-4">معاينة / تعديل الرسالة</h3>
        <label htmlFor="message-text" className="sr-only">معاينة الرسالة</label>
        <textarea id="message-text" value={text} onChange={e=>setText(e.target.value)} rows={8} className="w-full p-3 border rounded mb-4" />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="bg-gray-300 px-4 py-2 rounded">إلغاء</button>
          <button onClick={()=>{ onSend(text); onClose() }} className="bg-purple-600 text-white px-4 py-2 rounded">إرسال</button>
        </div>
      </div>
    </div>
  )
}
