import React, { useState } from 'react'
import Papa from 'papaparse'

// CSVUpload now streams parsing using PapaParse and calls onChunk(parsedRows) repeatedly
export default function CSVUpload({ onChunk, onProgress, onComplete, onError, onParsed }){
  const [error, setError] = useState(null)

  function handleFile(e){
    setError(null)
    const f = e.target.files[0]
    if (!f) return

    let rowCount = 0
    const buffer = []

    Papa.parse(f, {
      header: false,
      skipEmptyLines: true,
      chunkSize: 1024 * 64,
      chunk: function(results, parser){
        // results.data is an array of parsed rows (arrays)
        let rows = results.data
        // detect header on first chunk
        if (rowCount === 0 && rows.length){
          const first = rows[0].map(c => (c||'').toString().toLowerCase())
          const headerKeywords = ['fullname','name','phone','phonenumber','phone_number']
          const looksLikeHeader = first.some(cell => headerKeywords.some(k => (cell||'').replace(/\s|_/g,'').includes(k)))
          if (looksLikeHeader) rows = rows.slice(1)
        }
        rowCount += rows.length
        // map to slot objects
        const slots = rows.map(r=> ({ fullName: r[0]||'', phoneNumber: r[1]||'', desiredPosition: r[2]||'' }))
        // buffer for legacy onParsed consumers
        buffer.push(...slots)
        onChunk && onChunk(slots)
        if (onProgress) onProgress({ rowsParsed: rowCount })
      },
      error: function(err){ setError('فشل قراءة الملف'); onError && onError(err) },
      complete: function(results){
        // If chunk was never called (small file), results.data contains all rows
        if (rowCount === 0 && results && Array.isArray(results.data)){
          let rows = results.data
          const first = rows[0] ? rows[0].map(c => (c||'').toString().toLowerCase()) : []
          const headerKeywords = ['fullname','name','phone','phonenumber','phone_number']
          const looksLikeHeader = first && first.length && first.some(cell => headerKeywords.some(k => (cell||'').replace(/\s|_/g,'').includes(k)))
          if (looksLikeHeader) rows = rows.slice(1)
          const slots = rows.map(r=> ({ fullName: r[0]||'', phoneNumber: r[1]||'', desiredPosition: r[2]||'' }))
          buffer.push(...slots)
          onChunk && onChunk(slots)
          if (onProgress) onProgress({ rowsParsed: buffer.length })
        }
        // call legacy callback with full buffer if provided
        if (buffer.length && typeof onParsed === 'function'){
          try{ onParsed(buffer) }catch(e){}
        }
        onComplete && onComplete()
      }
    })
   }

  return (
    <div>
      <label htmlFor="csv-upload-input" className="block text-sm mb-1">رفع ملف المرضى (CSV)</label>
      <input aria-label="رفع ملف المرضى (CSV)" id="csv-upload-input" type="file" accept=".csv" onChange={handleFile} />
      {error && <div className="text-red-500 text-sm">{error}</div>}
    </div>
  )
}
