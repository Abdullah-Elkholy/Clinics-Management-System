import React from 'react'
import ModalWrapper from './ModalWrapper'

export default function AccountInfoModal({ open = false, onClose = null, user = null }){
  return (
    <ModalWrapper open={open} onClose={onClose} dir="rtl" labelId="account-info-title">
      <h3 id="account-info-title" className="text-lg font-bold mb-4">معلومات الحساب</h3>
      <div className="space-y-2">
        <div><strong>الاسم:</strong> {user?.name || 'غير متوفر'}</div>
        <div><strong>الدور:</strong> {user?.role || 'غير متوفر'}</div>
        <div><strong>واتساب متصل:</strong> {user?.whatsappConnected ? 'نعم' : 'لا'}</div>
      </div>
      <div className="flex justify-end mt-4">
        <button onClick={onClose} className="px-4 py-2">إغلاق</button>
      </div>
    </ModalWrapper>
  )
}
