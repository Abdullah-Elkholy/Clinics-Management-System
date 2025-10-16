import { useState } from 'react'
import { useRouter } from 'next/router'
import { login } from '../lib/api'

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError(null)
    try {
      const res = await login(username, password)
      if (res?.success) {
        router.push('/dashboard')
      } else {
        setError(res?.errors?.[0]?.message || 'فشل تسجيل الدخول')
      }
    } catch (err) {
      setError('خطأ في الشبكة')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50" dir="rtl">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow">
        <h1 className="text-2xl mb-4">تسجيل الدخول</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input className="w-full p-3 border rounded" placeholder="اسم المستخدم" value={username} onChange={(e)=>setUsername(e.target.value)} />
          <input type="password" className="w-full p-3 border rounded" placeholder="كلمة المرور" value={password} onChange={(e)=>setPassword(e.target.value)} />
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white p-3 rounded">{loading ? 'جارٍ...' : 'دخول'}</button>
          {error && <div className="text-red-600 text-sm mt-2">{error}</div>}
        </form>
        <div className="mt-6 text-sm text-gray-600">
          <p>تجربة سريعة: admin / admin123</p>
        </div>
      </div>
    </div>
  )
}
