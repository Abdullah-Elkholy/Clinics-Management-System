import React, { useEffect, useState, useRef } from 'react'
import i18n from '../lib/i18n'

let globalShow = null

// showToast(message, type = 'info'|'success'|'error', timeoutMs = 3000)
export function showToast(message, type = 'info', timeoutMs = 3000){
  if (!globalShow) return
  try{
    // allow callers to pass (message, timeout) when they used the old signature
    if (typeof type === 'number') {
      globalShow(message, 'info', type)
    } else {
      globalShow(message, type, timeoutMs)
    }
  }catch(e){ }
}

export default function Toast(){
  const [state, setState] = useState({ msg: null, type: 'info' })
  const timerRef = useRef(null)

  useEffect(()=>{
    globalShow = (m, t="info", timeout=3000) => {
      // signature compatibility: globalShow(message, type, timeout)
      clearTimeout(timerRef.current)
      setState({ msg: m, type: t })
      timerRef.current = setTimeout(()=> setState({ msg: null, type: 'info' }), timeout)
    }
    return ()=>{
      globalShow = null
      clearTimeout(timerRef.current)
    }
  }, [])

  if (!state.msg) return null

  const bgClass = state.type === 'success' ? 'bg-emerald-600' : (state.type === 'error' ? 'bg-rose-600' : 'bg-slate-800')

  return (
    <div role="status" aria-live="polite" aria-atomic="true" className="fixed bottom-6 left-6 z-50" dir="rtl">
      <div className={`max-w-md w-full px-4 py-3 rounded-xl shadow-lg text-white ${bgClass} flex items-start gap-3`}>
        <div className="mt-0.5 text-lg">
          {state.type === 'success' ? '✓' : (state.type === 'error' ? '⚠' : 'i')}
        </div>
        <div className="flex-1 text-sm leading-snug">{state.msg}</div>
        <button type="button" aria-label={i18n.t('modal.close')} onClick={()=> setState({ msg: null, type: 'info' })} className="ml-2 p-1 opacity-80 hover:opacity-100">
          ✕
        </button>
      </div>
    </div>
  )
}
