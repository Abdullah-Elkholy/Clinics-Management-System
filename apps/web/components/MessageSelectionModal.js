import React, { useState, useEffect } from 'react'
import ModalWrapper from './ModalWrapper'
import { useI18n } from '../lib/i18n'

export default function MessageSelectionModal({ open, template, onClose, onSend }){
  const i18n = useI18n()
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  useEffect(()=>{ if (template) setText(template.content || '') }, [template])
  useEffect(()=>{ setError(text.trim() ? '' : i18n.t('message_selection.errors.empty_text', 'النص لا يمكن أن يكون فارغاً')) }, [text])
  const canSend = text.trim().length > 0
  if (!open) return null
  return (
    <ModalWrapper open={open} onClose={onClose} labelId="message-modal-title">
      <div className="bg-white rounded-2xl p-6 w-full max-w-3xl shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 id="message-modal-title" className="text-xl font-bold">{i18n.t('message_selection.title', 'معاينة / تعديل الرسالة')}</h3>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-700 p-2 rounded" aria-label={i18n.t('common.close', 'إغلاق')}>✕</button>
          </div>
        </div>

        <div className="mb-3 text-sm text-gray-600">{i18n.t('message_selection.template_label', 'القالب:')} <strong>{template?.title || i18n.t('message_selection.default_template_name', 'الرسالة الافتراضية')}</strong></div>
        <label htmlFor="message-text" className="sr-only">{i18n.t('message_selection.preview_label', 'معاينة الرسالة')}</label>
        <textarea id="message-text" value={text} onChange={e=>setText(e.target.value)} rows={8} className="w-full p-4 border rounded-lg shadow-sm mb-2 focus:ring-2 focus:ring-purple-200" />
        {error && <div role="alert" className="text-sm text-red-600 mb-2">{error}</div>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="bg-gray-100 px-4 py-2 rounded-lg">{i18n.t('common.cancel', 'إلغاء')}</button>
          <button type="button" disabled={!canSend} onClick={()=>{ if (!canSend) return; onSend(text); onClose() }} className={`px-4 py-2 rounded-lg text-white ${canSend ? 'bg-gradient-to-r from-purple-600 to-blue-600' : 'bg-gray-300 cursor-not-allowed'}`}>{i18n.t('common.send', 'إرسال')}</button>
        </div>
      </div>
    </ModalWrapper>
  )
}
