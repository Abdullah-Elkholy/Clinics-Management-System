import React, { useEffect, useRef } from 'react'
import { FocusTrap } from 'focus-trap-react'

export default function ModalWrapper({ open = true, children, className = '', onClose = null, dir = 'rtl', initialFocusRef = null, labelId = null, backdropBlur = true }){
  const modalRef = useRef(null)
  const previouslyFocused = useRef(null)

  useEffect(()=>{
    if (!open) return
    previouslyFocused.current = document.activeElement
    return () => {
      try{ previouslyFocused.current && previouslyFocused.current.focus() }catch(e){}
    }
  },[open])

  if (!open) return null
  return (
    <div className={`fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 ${backdropBlur ? 'backdrop-blur-sm' : ''}`} dir={dir}>
      <FocusTrap
        active={open}
        focusTrapOptions={{
          // If an initialFocusRef is supplied (a ref to a focusable element), use it.
          // Otherwise let focus-trap find the first tabbable element inside the modal.
          initialFocus: initialFocusRef ? () => initialFocusRef.current : undefined,
          fallbackFocus: () => modalRef.current || document.body,
          // Let focus-trap handle Escape and call onDeactivate when it deactivates the trap
          escapeDeactivates: true,
          onDeactivate: () => { onClose && onClose() }
        }}
      >
        <div ref={modalRef} tabIndex={-1} className={`bg-white rounded-xl p-6 w-full max-w-lg transform transition-all duration-300 scale-95 opacity-0 animate-modal-in ${className}`} role="dialog" aria-modal="true" {...(labelId ? { 'aria-labelledby': labelId } : {})}>
          {children}
        </div>
      </FocusTrap>
    </div>
  )
}
