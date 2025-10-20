import React, { useEffect, useRef } from 'react'
import { FocusTrap } from 'focus-trap-react'

export default function ModalWrapper({ open = true, title, actions = [], children, className = '', onClose = null, dir = 'rtl', initialFocusRef = null, labelId = 'modal-title', backdropBlur = true }){
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
          {title && <h2 id={labelId} className="text-xl font-bold mb-4">{title}</h2>}
          {children}
          {actions.length > 0 && (
            <div className="flex justify-end space-x-4 mt-6">
              {actions.map((action, index) => (
                <button
                  key={index}
                  onClick={action.onClick}
                  type="button"
                  className={`px-4 py-2 rounded-md ${
                    action.variant === 'primary'
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </FocusTrap>
    </div>
  )
}
