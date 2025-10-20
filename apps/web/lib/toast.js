import Toast, { showToast, enqueueToast } from '../components/Toast'

// Re-export a single canonical entry point for toast usage across the app.
// Importing from this module everywhere reduces the chance of multiple
// module instances caused by differing import paths during tests/HMR.
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
