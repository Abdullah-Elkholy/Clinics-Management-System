import React, { useEffect, useRef, useState } from 'react'
import ModalWrapper from './ModalWrapper'

export default function AddMessageTemplateModal({ open = false, onClose = null, onSave = null }){
  const nameRef = useRef(null)
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [errors, setErrors] = useState({})

  useEffect(()=>{
    if (!open) return
    // small timeout to ensure the modal is mounted and focus-trap attached
    const t = setTimeout(()=>{ try{ nameRef.current?.focus() }catch(e){} }, 10)
    return ()=> clearTimeout(t)
  },[open])

  function validate(){
    const e = {}
    if (!name || !name.toString().trim()) e.name = 'الاسم مطلوب'
    if (!content || !content.toString().trim()) e.content = 'المحتوى مطلوب'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSave(){
    if (!validate()) return
    if (onSave){
      await onSave({ name: name.toString().trim(), content: content.toString().trim() })
    }
    setName('')
    setContent('')
    onClose && onClose()
  }

  return (
    <ModalWrapper open={open} onClose={onClose} dir="rtl" initialFocusRef={nameRef} labelId="add-template-title">
      <h3 id="add-template-title" className="text-lg font-bold mb-4">إضافة قالب رسالة</h3>

      <label className="block text-sm mb-1" htmlFor="tmpl-name">اسم القالب</label>
      <input
        id="tmpl-name"
        ref={nameRef}
        value={name}
        onChange={e=>setName(e.target.value)}
        className="w-full p-2 border rounded mb-2"
        aria-invalid={errors.name ? 'true' : 'false'}
      />
      {errors.name && <div className="text-red-600 text-sm mb-2">{errors.name}</div>}

      <label className="block text-sm mb-1" htmlFor="tmpl-content">نص القالب</label>
      <textarea
        id="tmpl-content"
        value={content}
        onChange={e=>setContent(e.target.value)}
        className="w-full p-2 border rounded mb-2 h-36"
        aria-invalid={errors.content ? 'true' : 'false'}
      />
      {errors.content && <div className="text-red-600 text-sm mb-2">{errors.content}</div>}

      <div className="flex justify-end space-x-2">
        <button type="button" onClick={()=>{ setName(''); setContent(''); onClose && onClose() }} className="px-4 py-2">إلغاء</button>
        <button type="button" onClick={handleSave} disabled={!name.trim() || !content.trim()} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60">إضافة</button>
      </div>
    </ModalWrapper>
  )
}
