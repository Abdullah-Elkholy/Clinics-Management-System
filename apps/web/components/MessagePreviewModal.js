import React from 'react'
import ModalWrapper from './ModalWrapper'

export default function MessagePreviewModal({ open, template, patients = [], onClose, onConfirm }){
  if (!open) return null
  const content = template?.content || ''
  return (
    <ModalWrapper open={open} onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-4xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold">معاينة الرسالة</h3>
          <button type="button" onClick={onClose} className="text-gray-500 p-2 rounded hover:bg-gray-100">✕</button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-600 mb-2">القالب: <strong>{template?.title || 'رسالة'}</strong></div>
            <div className="bg-gray-50 border rounded p-4 text-gray-800 min-h-[160px]">{content}</div>
            <div className="text-xs text-gray-500 mt-2">المتغيرات المدعومة: {'{PN}, {PQP}, {CQP}, {ETR}'}</div>
          </div>
          <div>
            <div className="text-sm text-gray-600 mb-2">قائمة المستلمين ({patients.length})</div>
            <div className="bg-white border rounded max-h-56 overflow-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2">الاسم</th>
                    <th className="p-2">الهاتف</th>
                  </tr>
                </thead>
                <tbody>
                  {patients.map(p=> (
                    <tr key={p.id} className="border-t">
                      <td className="p-2">{p.fullName}</td>
                      <td className="p-2">{p.phoneNumber}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded bg-gray-100">إغلاق</button>
          <button type="button" onClick={() => { onConfirm && onConfirm(); onClose && onClose() }} className="px-4 py-2 rounded bg-purple-600 text-white">إرسال</button>
        </div>
      </div>
    </ModalWrapper>
  )
}
