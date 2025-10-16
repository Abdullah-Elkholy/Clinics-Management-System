import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import api, { setAuth } from '../lib/api'
const Header = dynamic(()=>import('../components/layout/Header'))
const SidebarQueues = dynamic(()=>import('../components/layout/SidebarQueues'))

export default function Dashboard(){
  const [user, setUser] = useState(null)
  useEffect(()=>{
    const token = localStorage.getItem('accessToken')
    if (token) setAuth(token)
    api.get('/api/users/me').then(r=> setUser(r.data?.data)).catch(()=>{})
  },[])

  return (
    <div className="min-h-screen bg-gray-50">
      <Header user={user} />
      <div className="flex h-screen pt-16">
        <SidebarQueues />
        <div className="flex-1 bg-white p-8">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-2xl font-bold mb-4">مرحباً بك</h2>
            <p className="text-gray-600">اختر طابوراً من اليسار للبدء</p>
          </div>
        </div>
      </div>
    </div>
  )
}
