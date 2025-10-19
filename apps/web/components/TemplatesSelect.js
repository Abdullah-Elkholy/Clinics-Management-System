import React from 'react'

export default function TemplatesSelect({ templates = [], value, onChange, onPreview }){
	return (
		<div role="group" aria-label="قوالب الرسائل" className="bg-white border rounded-lg p-3 shadow-sm">
			<label htmlFor="templates-select" className="block text-sm font-medium mb-2">قوالب الرسائل</label>
			<div className="flex items-center gap-3">
				<select aria-label="قائمة القوالب" id="templates-select" value={value || ''} onChange={e=>onChange && onChange(e.target.value)} className="flex-1 p-2 border rounded-lg">
					<option value="">-- اختر قالباً --</option>
					{templates.map(t => <option key={t.id} value={t.id}>{t.title || (t.content && t.content.substring(0,60))}</option>)}
				</select>
				<button type="button" aria-label="معاينة القالب" onClick={()=> onPreview && onPreview(value)} className="bg-blue-600 text-white px-3 py-2 rounded-lg">معاينة</button>
			</div>
			{value && (() => {
				const sel = templates.find(t=>String(t.id) === String(value))
				if (!sel) return null
				return <div className="mt-3 text-xs text-gray-600">{(sel.content || '').substring(0,160)}</div>
			})()}
		</div>
	)
}
