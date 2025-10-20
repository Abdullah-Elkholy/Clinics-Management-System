import React, { useEffect, useState, useRef } from 'react'

const GLOBAL_KEY = '__CLINICS_TOAST__'

function getGlobalManager() {
  if (typeof globalThis === 'undefined') return null
  if (!globalThis[GLOBAL_KEY]) {
    globalThis[GLOBAL_KEY] = { pending: [], showImpl: null, _seq: 0, _last: null }
  }
  return globalThis[GLOBAL_KEY]
}

export function enqueueToast(message, type = 'success', timeoutMs = 3000) {
  const mgr = getGlobalManager()
  if (!mgr) return
  const entry = { id: Date.now() + Math.random(), message: String(message), type, timeoutMs }
  mgr.pending.push(entry)
  mgr._seq = (mgr._seq || 0) + 1
  mgr._last = entry

  // emit DOM event for tests and listeners
  if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
    try { window.dispatchEvent(new CustomEvent('clinics:show-toast', { detail: entry })) } catch (e) {}
  }

  // notify React instance if mounted
  if (typeof mgr.showImpl === 'function') {
    try { mgr.showImpl(entry) } catch (e) {}
  }
}

export function showToast(message, type = 'success', timeoutMs = 3000) {
  return enqueueToast(message, type, timeoutMs)
}

export default function Toast() {
  const [toasts, setToasts] = useState([])
  const mgrRef = useRef(null)

  useEffect(() => {
    const mgr = getGlobalManager()
    if (!mgr) return
    mgrRef.current = mgr

    const handler = (entry) => setToasts((s) => [...s, entry])
    mgr.showImpl = handler

    if (mgr.pending && mgr.pending.length) {
      const queued = mgr.pending.splice(0)
      queued.forEach(p => { try { handler(p) } catch (e) {} })
    }

    return () => {
      if (mgr.showImpl === handler) mgr.showImpl = null
    }
  }, [])

  useEffect(() => {
    toasts.forEach(t => {
      if (t._timeoutScheduled) return
      t._timeoutScheduled = true
      setTimeout(() => setToasts((s) => s.filter(x => x.id !== t.id)), t.timeoutMs || 3000)
    })
  }, [toasts])

  if (!toasts.length) return null

  return (
    <div aria-live="polite" aria-atomic="true" className="fixed top-4 left-4 z-50 pointer-events-none" style={{ direction: 'rtl' }}>
      <div className="flex flex-col space-y-2">
        {toasts.map(t => (
          <div
            key={t.id}
            role="alert"
            dir="rtl"
            className={`pointer-events-auto max-w-xs text-white px-4 py-3 rounded-lg shadow-lg ${
              t.type === 'error' ? 'bg-red-500' : 'bg-green-500'
            }`}
          >
            <div className="flex items-start space-x-3 space-x-reverse">
              <div className="flex-1 text-sm">{t.message}</div>
              <button
                type="button"
                className="text-white hover:text-gray-200 text-xl leading-none"
                aria-label="إغلاق"
                onClick={() => setToasts((s) => s.filter(x => x.id !== t.id))}
              >
                &times;
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
