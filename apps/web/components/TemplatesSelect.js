import React from 'react'

export default function TemplatesSelect({ templates = [], value, onChange }){
	return (
			<div role="group" aria-label="قوالب الرسائل">
				<label htmlFor="templates-select" className="block text-sm mb-1">القوالب</label>
				<select role="listbox" aria-label="قائمة القوالب" id="templates-select" value={value || ''} onChange={e=>onChange && onChange(e.target.value)} className="p-2 border rounded">
				<option value="">-- اختر قالباً --</option>
				{templates.map(t => <option key={t.id} value={t.id}>{t.title || (t.content && t.content.substring(0,60))}</option>)}
			</select>
		</div>
	)
}
