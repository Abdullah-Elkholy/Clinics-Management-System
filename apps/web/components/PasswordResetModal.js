import React, { useMemo, useState, useRef, useEffect } from 'react'
import ModalWrapper from './ModalWrapper'
import i18n from '../lib/i18n'

function scorePassword(pw){
  if (!pw) return 0
  let score = 0
  if (pw.length >= 8) score += 2
  if (/[a-z]/.test(pw)) score += 1
  if (/[A-Z]/.test(pw)) score += 1
  if (/[0-9]/.test(pw)) score += 1
  if (/[^A-Za-z0-9]/.test(pw)) score += 1
  return Math.min(score, 5)
}

export default function PasswordResetModal({ open, onClose, user, onConfirm }){
  const [pw, setPw] = useState('')
  const ref = useRef(null)

  useEffect(()=>{ if (open) { setPw(''); setTimeout(()=> ref.current && ref.current.focus(), 10) } },[open])

  const score = useMemo(()=> scorePassword(pw), [pw])
  const label = [i18n.t('pw.strength.0', { default: 'Very weak' }), i18n.t('pw.strength.1', { default: 'Weak' }), i18n.t('pw.strength.2', { default: 'Fair' }), i18n.t('pw.strength.3', { default: 'Good' }), i18n.t('pw.strength.4', { default: 'Strong' }), i18n.t('pw.strength.5', { default: 'Excellent' })][score]

  return (
    <ModalWrapper open={open} onClose={onClose} dir="rtl" labelId="pw-reset-title">
      <h3 id="pw-reset-title" className="text-xl font-bold mb-2">{i18n.t('users.resetPassword')}</h3>
          <div className="text-sm text-gray-600 mb-4">{i18n.t('login.username')}: {user?.username || '—'}</div>

          <div className="space-y-2">
            <label htmlFor="pw-reset-input" className="sr-only">{i18n.t('pw.new') || 'New password'}</label>
            <input id="pw-reset-input" ref={ref} value={pw} onChange={e=>setPw(e.target.value)} type="password" placeholder={i18n.t('pw.placeholder') || i18n.t('pw.new') || ''} aria-describedby="pw-reset-strength" className="w-full p-2 border rounded" />
        <div className="w-full bg-gray-200 h-2 rounded overflow-hidden">
          <div style={{ width: `${(score/5)*100}%` }} className={`h-2 ${score < 2 ? 'bg-red-500' : score < 4 ? 'bg-yellow-400' : 'bg-green-500'}`} />
        </div>
            <div id="pw-reset-strength" className="text-xs text-gray-500">{i18n.t('pw.strength', { label })}</div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-3 py-1 border rounded">{i18n.t('modal.cancel')}</button>
        <button
          type="button"
          onClick={async ()=>{ if (!pw) return; await onConfirm(pw); onClose() }}
          disabled={pw.length < 6}
          className={`px-4 py-1 rounded text-white ${pw.length < 6 ? 'bg-gray-300 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'}`}
        >
          {i18n.t('pw.confirm', { default: 'Confirm' })}
        </button>
      </div>
    </ModalWrapper>
  )
}
