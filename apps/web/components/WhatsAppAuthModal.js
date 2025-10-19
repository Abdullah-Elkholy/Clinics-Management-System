import React, { useEffect, useRef, useState } from 'react'
import ModalWrapper from './ModalWrapper'
import api from '../lib/api'

export default function WhatsAppAuthModal({ open = false, onClose = null }){
  const [qrUrl, setQrUrl] = useState(null)
  const [status, setStatus] = useState('idle') // idle | pending | connected | error
  const [loading, setLoading] = useState(false)
  const pollRef = useRef(null)

  useEffect(()=>{
    if (!open) return
    setStatus('pending')
    setQrUrl(null)
    setLoading(true)

    let mounted = true
    async function fetchQr(){
      try{
        const res = await api.get('/api/whatsapp/auth/qr')
        const data = res?.data
        if (!mounted) return
        if (data && data.qrUrl) setQrUrl(data.qrUrl)
        else setQrUrl(null)
        setLoading(false)
      }catch(e){
        setQrUrl(null)
        setLoading(false)
        setStatus('error')
      }
    }
    fetchQr()

    // poll for connection status every 2s
    pollRef.current = setInterval(async ()=>{
      try{
        const r = await api.get('/api/whatsapp/auth/status')
        const s = r?.data?.status
        if (s === 'connected'){
          setStatus('connected')
          clearInterval(pollRef.current)
          pollRef.current = null
        }
      }catch(e){
        // ignore polling errors
      }
    }, 2000)

    return ()=>{
      mounted = false
      if (pollRef.current) clearInterval(pollRef.current)
    }
  },[open])

  async function refreshQr(){
    setLoading(true)
    setStatus('pending')
    try{
      const res = await api.get('/api/whatsapp/auth/qr')
      const data = res?.data
      if (data && data.qrUrl) setQrUrl(data.qrUrl)
      else setQrUrl(null)
      setLoading(false)
    }catch(e){
      setQrUrl(null)
      setLoading(false)
      setStatus('error')
    }
  }

  return (
    <ModalWrapper open={open} onClose={onClose} dir="rtl" labelId="whatsapp-auth-title">
      <h3 id="whatsapp-auth-title" className="text-lg font-bold mb-4">ربط واتساب</h3>
      {status === 'connected' ? (
        <div className="text-green-600">تم الربط بنجاح</div>
      ) : (
        <div>
          <p className="mb-3">امسح رمز الاستجابة السريعة عبر تطبيق واتساب لتوصيل الحساب.</p>
          {qrUrl ? (
            <div className="flex justify-center mb-3">
              <img src={qrUrl} alt="QR code to link WhatsApp" className="w-56 h-56 object-contain" />
            </div>
          ) : (
            <div className="text-sm text-gray-600 mb-3">لا يوجد رمز QR متاح حالياً</div>
          )}
          <div className="text-xs text-gray-500">ستتصل الواجهة بالخادم ليتأكد من نجاح الربط تلقائياً.</div>
        </div>
      )}
      <div className="flex justify-between mt-4">
        <div>
            <button type="button" onClick={refreshQr} disabled={loading} className="px-3 py-2 bg-gray-100 rounded mr-2 hover:bg-gray-200 disabled:opacity-60">{loading ? 'تحميل...' : 'تحديث رمز QR'}</button>
        </div>
        <div>
            <button type="button" onClick={onClose} className="px-4 py-2">إغلاق</button>
        </div>
      </div>
    </ModalWrapper>
  )
}
