import React from 'react'
import Icon from './Icon'

export default function Header({ userRole, userName, whatsappConnected, onLogout }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-gradient-to-br from-blue-600 to-purple-700 text-white shadow-md">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center space-x-4 space-x-reverse">
          <div className="bg-white/10 backdrop-blur-sm w-12 h-12 rounded-full flex items-center justify-center">
            <Icon name="fas fa-clinic-medical text-white text-2xl" />
          </div>
          <div>
            <h1 className="text-lg md:text-xl font-semibold">نظام إدارة العيادات</h1>
            <p className="text-sm text-white/80">{userRole}</p>
          </div>
        </div>

        <div className="flex items-center space-x-4 space-x-reverse">
          {whatsappConnected ? (
            <div className="flex items-center space-x-2 space-x-reverse bg-white/10 px-3 py-1 rounded-full">
              <div className="w-2 h-2 bg-green-300 rounded-full animate-pulse" />
              <span className="text-sm text-white">واتساب متصل</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 space-x-reverse bg-white/5 px-3 py-1 rounded-full">
              <span className="text-sm text-white/80">واتساب غير متصل</span>
            </div>
          )}

          <div className="flex items-center space-x-3 space-x-reverse">
            <div className="text-right">
              <div className="text-sm font-medium">{userName}</div>
              <div className="text-xs text-white/80">{userRole}</div>
            </div>
            <button onClick={onLogout} className="bg-white/10 hover:bg-white/20 p-2 rounded-full" aria-label="تسجيل الخروج">
              <Icon name="fas fa-sign-out-alt text-white" />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}