import React, { useState } from 'react'

export default function CSVUpload({ onParsed }){
  const [error, setError] = useState(null)

  function handleFile(e){
    setError(null)
    const f = e.target.files[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = ()=>{
      const text = reader.result
      try{
        const rows = parseCSV(text)
        // map to slots: { fullName, phoneNumber, desiredPosition }
        const slots = rows.map(r=> ({ fullName: r[0]||'', phoneNumber: r[1]||'', desiredPosition: r[2]||'' }))
        onParsed && onParsed(slots)
      }catch(err){ setError('فشل قراءة الملف') }
    }
    reader.readAsText(f, 'utf-8')
  }

  function parseCSV(text){
    const lines = text.split(/\r?\n/).filter(l=>l.trim())
    return lines.map(l=> l.split(',').map(cell=> cell.trim()))
  }

  return (
    <div>
      <label htmlFor="csv-upload-input" className="block text-sm mb-1">رفع ملف المرضى (CSV)</label>
      <input id="csv-upload-input" type="file" accept=".csv" onChange={handleFile} />
      {error && <div className="text-red-500 text-sm">{error}</div>}
    </div>
  )
}
