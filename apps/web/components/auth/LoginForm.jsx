import React, { useState } from 'react'
import api, { setAuth } from '../../lib/api'
import { useRouter } from 'next/router'
import Icon from '../Icon'

export default function LoginForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const router = useRouter()

  async function handleLogin() {
    setLoading(true)
    setError(null)
    try {
      const res = await api.post('/api/Auth/login', { username, password })
      if (res?.data?.success) {
        const token = res.data.data?.accessToken ?? res.data.data?.AccessToken
        if (token) {
          localStorage.setItem('accessToken', token)
          setAuth(token)
        }
        router.push('/dashboard')
      } else {
        setError('فشل تسجيل الدخول')
      }
    } catch (err) {
      setError(err?.response?.data?.errors ?? 'خطأ في الشبكة')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-purple-700">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="text-center mb-8">
          <div className="bg-blue-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon name="fas fa-clinic-medical text-blue-600 text-3xl" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">نظام إدارة العيادات</h1>
          <p className="text-gray-600">تسجيل الدخول إلى النظام</p>
        </div>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">اسم المستخدم</label>
            <input value={username} onChange={e=>setUsername(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="أدخل اسم المستخدم" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">كلمة المرور</label>
            <input value={password} onChange={e=>setPassword(e.target.value)} type="password" onKeyPress={(e)=>{ if(e.key==='Enter') handleLogin() }} className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="أدخل كلمة المرور" />
          </div>

          <button disabled={loading} onClick={handleLogin} className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition duration-200 font-medium">
            {loading ? 'جارٍ...' : 'تسجيل الدخول'}
          </button>

          {error && <div className="text-red-600 text-sm">{typeof error === 'string' ? error : JSON.stringify(error)}</div>}
        </div>

      </div>
    </div>
  )
}
