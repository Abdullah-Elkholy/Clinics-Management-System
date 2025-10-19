import React from 'react'
import Icon from '../Icon'
import { useRouter } from 'next/router'
import api, { setAuth } from '../../lib/api'

export default function Header({ user }){
  const router = useRouter()
  const logout = async ()=>{
    try { await api.post('/api/Auth/logout') } catch {};
    localStorage.removeItem('accessToken')
    setAuth(null)
    router.push('/login')
  }

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 fixed top-0 left-0 right-0 z-40">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center space-x-4 space-x-reverse">
          <div className="bg-blue-100 w-10 h-10 rounded-full flex items-center justify-center">
            <Icon name="fas fa-clinic-medical text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">نظام إدارة العيادات</h1>
            <p className="text-sm text-gray-600">{user?.role ?? '—'}</p>
          </div>
        </div>

        <div className="flex items-center space-x-4 space-x-reverse">
          <div className="flex items-center space-x-3 space-x-reverse">
            <span className="text-sm text-gray-700">{user?.fullName ?? user?.username ?? '—'}</span>
            <button type="button" onClick={logout} className="text-red-600 hover:text-red-700"><Icon name="fas fa-sign-out-alt" /></button>
          </div>
        </div>
      </div>
    </header>
  )
}
