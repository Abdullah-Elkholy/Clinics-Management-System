import { useEffect, useState } from 'react'

let globalShow = null

export function showToast(message, timeout = 3000){
  if (globalShow) globalShow(message, timeout)
}

export default function Toast(){
  const [msg, setMsg] = useState(null)
  useEffect(()=>{ globalShow = (m,t)=>{ setMsg(m); setTimeout(()=>setMsg(null), t) } }, [])
  if (!msg) return null
  return (
    <div className="fixed bottom-6 left-6 z-50">
      <div className="bg-black text-white px-4 py-2 rounded shadow">{msg}</div>
    </div>
  )
}
