import React, { useEffect, useRef, useState } from 'react'
import TemplatesSelect from './TemplatesSelect'

export default function MessagesPanel({ templates = [], onSend }){
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [text, setText] = useState('')
  const textareaRef = useRef(null)

  function applyTemplate(id){
    setSelectedTemplate(id)
    const t = templates.find(x=>String(x.id)===String(id))
    setText(t?.content || '')
    // focus textarea for quick editing after applying a template
    setTimeout(()=> textareaRef.current && textareaRef.current.focus(), 0)
  }

  useEffect(()=>{
    function onKey(e){
      // Ctrl+Enter to send
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter'){
        e.preventDefault()
        if (text.trim() && onSend) onSend(text)
      }
    }
    window.addEventListener('keydown', onKey)
    return ()=> window.removeEventListener('keydown', onKey)
  }, [text, onSend])

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <TemplatesSelect templates={templates} value={selectedTemplate} onChange={applyTemplate} />
          <textarea
            ref={textareaRef}
            aria-label="محتوى الرسالة"
            className="w-full mt-3 p-3 border rounded h-40"
            value={text}
            onChange={e=>setText(e.target.value)}
          />
          <div className="flex justify-between items-center mt-3">
            <div className="text-sm text-gray-500">اضغط Ctrl+Enter للإرسال</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={()=> { setText('') }}
                className="px-3 py-1 border rounded text-sm"
              >مسح</button>
              <button
                type="button"
                onClick={()=> onSend && onSend(text)}
                disabled={!text.trim()}
                className={`px-4 py-2 rounded text-white ${text.trim() ? 'bg-purple-600 hover:bg-purple-700' : 'bg-purple-300 cursor-not-allowed'}`}
              >إرسال</button>
            </div>
          </div>
        </div>
        <div className="w-64">
          <div className="bg-gray-50 p-4 rounded min-h-[160px]">
            <h4 className="font-medium mb-2">معاينة الرسالة</h4>
            <div className="text-sm text-gray-700 whitespace-pre-wrap">{text || 'لا توجد محتويات لعرضها'}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
