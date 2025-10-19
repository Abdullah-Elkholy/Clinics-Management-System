import React, { useEffect, useRef } from 'react'

export default function ModalWrapper({ open = true, children, className = '', onClose = null, dir = 'rtl' }){
  const modalRef = useRef(null)
  const previouslyFocused = useRef(null)

  useEffect(()=>{
    if (!open) return
    previouslyFocused.current = document.activeElement

    // focus the modal container when opened
    const node = modalRef.current
    if (node) {
      // find first focusable element
      const focusable = node.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      ;(focusable || node).focus()
    }

    function onKey(e){
      if (e.key === 'Escape' || e.key === 'Esc'){
        e.stopPropagation()
        onClose && onClose()
      }
      if (e.key === 'Tab'){
        // simple focus trap: keep focus inside modal
        const focusables = Array.from(node.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(n=>!n.hasAttribute('disabled'))
        if (focusables.length === 0) {
          e.preventDefault()
          return
        }
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus()
        }
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus()
        }
      }
    }

    document.addEventListener('keydown', onKey)
    return ()=>{
      document.removeEventListener('keydown', onKey)
      try{ previouslyFocused.current && previouslyFocused.current.focus() }catch(e){}
    }
  },[open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50" dir={dir}>
      <div ref={modalRef} tabIndex={-1} className={`bg-white rounded-xl p-6 w-full max-w-lg transform transition-all duration-300 scale-95 opacity-0 animate-modal-in ${className}`} role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  )
}
