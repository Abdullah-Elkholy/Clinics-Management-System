import React, { useState } from 'react'
import TemplatesSelect from './TemplatesSelect'

export default function MessagesPanel({ templates = [], onSend }){
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [text, setText] = useState('')

  function applyTemplate(id){
    setSelectedTemplate(id)
    const t = templates.find(x=>String(x.id)===String(id))
    setText(t?.content || '')
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <TemplatesSelect templates={templates} value={selectedTemplate} onChange={applyTemplate} />
          <textarea className="w-full mt-3 p-3 border rounded h-40" value={text} onChange={e=>setText(e.target.value)} />
          <div className="flex justify-end mt-3">
            <button onClick={()=> onSend && onSend(text)} className="bg-purple-600 text-white px-4 py-2 rounded">إرسال</button>
          </div>
        </div>
        <div className="w-64">
          <div className="bg-gray-50 p-4 rounded">معاينة الرسالة</div>
        </div>
      </div>
    </div>
  )
}
