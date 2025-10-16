import React from 'react'

export default function PatientsTable({ patients, onToggle }){
  return (
    <div className="bg-white border rounded">
      <table className="w-full">
        <thead className="bg-gray-50">
          <tr>
            <th className="p-3 text-right">تحديد</th>
            <th className="p-3 text-right">الاسم</th>
            <th className="p-3 text-right">هاتف</th>
            <th className="p-3 text-right">ترتيب</th>
          </tr>
        </thead>
        <tbody>
          {patients.map((p,i)=> (
            <tr key={p.id ?? `tmp-${i}`} className={`border-t ${p._optimistic ? 'opacity-70' : ''}`}>
              <td className="p-3 text-right"><input type="checkbox" checked={!!p._selected} onChange={()=>onToggle(i)} /></td>
              <td className="p-3 text-right">{p.fullName}</td>
              <td className="p-3 text-right">{p.phoneNumber}</td>
              <td className="p-3 text-right">{p.position}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
