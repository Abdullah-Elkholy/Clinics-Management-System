import { useEffect, useState, useRef } from 'react'

let globalShow = null

// showToast(message, type = 'info'|'success'|'error', timeoutMs = 3000)
export function showToast(message, type = 'info', timeoutMs = 3000){
  if (!globalShow) return
  try{
    // allow callers to pass (message, timeout) when they used the old signature
    if (typeof type === 'number') {
      globalShow(message, 'info', type)
    } else {
      globalShow(message, type, timeoutMs)
    }
  }catch(e){ }
}

export default function Toast(){
  const [state, setState] = useState({ msg: null, type: 'info' })
  const timerRef = useRef(null)

  useEffect(()=>{
    globalShow = (m, t="info", timeout=3000) => {
      // signature compatibility: globalShow(message, type, timeout)
      clearTimeout(timerRef.current)
      setState({ msg: m, type: t })
      timerRef.current = setTimeout(()=> setState({ msg: null, type: 'info' }), timeout)
    }
    return ()=>{
      globalShow = null
      clearTimeout(timerRef.current)
    }
  }, [])

  if (!state.msg) return null

  const bgClass = state.type === 'success' ? 'bg-green-500' : (state.type === 'error' ? 'bg-red-500' : 'bg-black')

  return (
    <div role="alert" aria-live="polite" className="fixed bottom-6 right-6 z-50" dir="rtl">
      <div className={`px-4 py-2 rounded shadow text-white ${bgClass} flex items-center`}>
        <div style={{ flex: 1 }}>{state.msg}</div>
        <button aria-label="إغلاق" onClick={()=> setState({ msg: null, type: 'info' })} className="mr-2 p-1">
          ✕
        </button>
      </div>
    </div>
  )
}
