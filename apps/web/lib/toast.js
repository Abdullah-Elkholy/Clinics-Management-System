import Toast, { showToast as compShowToast, enqueueToast as compEnqueueToast } from '../components/Toast'

// Provide safe fallbacks so tests and runtime code can call showToast/enqueueToast
// even when the components module is mocked incompletely. The fallback will
// update the global manager and dispatch a DOM event so listeners/tests pick
// up the toast.
function ensureGlobalManager() {
  if (typeof globalThis === 'undefined') return null
  if (!globalThis.__CLINICS_TOAST__) globalThis.__CLINICS_TOAST__ = { pending: [], showImpl: null, _seq: 0, _last: null }
  return globalThis.__CLINICS_TOAST__
}

function fallbackEnqueueToast(message, type = 'success', timeoutMs = 3000) {
  const mgr = ensureGlobalManager()
  if (!mgr) return
  const entry = { id: Date.now() + Math.random(), message: String(message), type, timeoutMs }
  mgr.pending.push(entry)
  mgr._seq = (mgr._seq || 0) + 1
  mgr._last = entry
  // emit DOM event for listeners/tests
  try { window.dispatchEvent(new CustomEvent('clinics:show-toast', { detail: entry })) } catch (e) {}
  // notify any mounted React instance
  try { if (typeof mgr.showImpl === 'function') mgr.showImpl(entry) } catch (e) {}
}

const enqueueToast = typeof compEnqueueToast === 'function' ? compEnqueueToast : fallbackEnqueueToast

const showToast = typeof compShowToast === 'function'
  ? compShowToast
  : (message, type = 'success', timeoutMs = 3000) => enqueueToast(message, type, timeoutMs)

// Re-export
export { showToast, enqueueToast }

// Helper used by tests: return a Promise that resolves on the next
// clinics:show-toast DOM event or when the global manager sequence advances.
export function waitForNextToast({ timeoutMs = 3000 } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return resolve(null)

    let called = false
    let startSeq = 0
    try {
      const mgr = globalThis && globalThis.__CLINICS_TOAST__
      startSeq = (mgr && mgr._seq) || 0
    } catch (e) {}

    const cleanup = () => {
      try { window.removeEventListener('clinics:show-toast', onEv) } catch (e) {}
      if (pollId != null) { try { clearInterval(pollId) } catch (e) {}; pollId = null }
    }

    const onEv = (ev) => {
      if (called) return
      called = true
      cleanup()
      resolve(ev.detail)
    }

    window.addEventListener('clinics:show-toast', onEv)

    // Poll the manager as a fallback in case the DOM event is missed
    let pollId = setInterval(() => {
      try {
        const mgr = globalThis && globalThis.__CLINICS_TOAST__
        if (mgr && mgr._seq && mgr._seq > startSeq) {
          called = true
          cleanup()
          return resolve(mgr._last)
        }
        // also check for any alert/fallback node already in the DOM
        if (typeof document !== 'undefined') {
          const domAlert = document.querySelector('.clinics-toast-fallback, [role="alert"]')
          if (domAlert) { called = true; cleanup(); return resolve({ message: domAlert.textContent && domAlert.textContent.trim() }) }
        }
      } catch (e) {}
    }, 10)

    if (timeoutMs && timeoutMs > 0) {
      setTimeout(() => {
        if (called) return
        called = true
        cleanup()
        reject(new Error('waitForNextToast timeout'))
      }, timeoutMs)
    }
  })
}

export default Toast
