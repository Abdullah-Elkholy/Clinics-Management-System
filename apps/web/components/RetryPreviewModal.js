import React from 'react'
import ModalWrapper from './ModalWrapper'

export default function RetryPreviewModal({ open, tasks = [], onClose, onRetry }){
  if (!open) return null
  return (
    <ModalWrapper open={open} onClose={onClose}>
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-3xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">معاينة المهام الفاشلة</h3>
          <button onClick={onClose} className="text-gray-500 p-2 rounded hover:bg-gray-100">✕</button>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4 text-sm text-yellow-900">سيتم محاولة إعادة إرسال الرسائل التالية. يمكنك إزالة أي مهمة قبل الإرسال.</div>

        <div className="max-h-56 overflow-auto border rounded">
          <table className="w-full text-right text-sm">
            <thead className="bg-gray-100">
              <tr><th className="p-2">المتبقي</th><th className="p-2">الاسم</th><th className="p-2">الهاتف</th></tr>
            </thead>
            <tbody>
              {tasks.map(t=> (
                <tr key={t.id} className="border-t">
                  <td className="p-2">{t.retryCount ?? 0}</td>
                  <td className="p-2">{t.fullName}</td>
                  <td className="p-2">{t.phoneNumber}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} className="px-4 py-2 rounded bg-gray-100">إغلاق</button>
          <button onClick={() => { onRetry && onRetry(tasks); onClose && onClose() }} className="px-4 py-2 rounded bg-yellow-500 text-white">إعادة الإرسال</button>
        </div>
      </div>
    </ModalWrapper>
  )
}
