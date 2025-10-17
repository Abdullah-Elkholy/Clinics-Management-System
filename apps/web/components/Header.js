import React from 'react'

export default function Header({ userRole, userName, whatsappConnected, onLogout }) {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200 fixed top-0 left-0 right-0 z-40">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center space-x-4 space-x-reverse">
          <div className="bg-blue-100 w-10 h-10 rounded-full flex items-center justify-center">
            <i className="fas fa-clinic-medical text-blue-600"></i>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">نظام إدارة العيادات</h1>
            <p className="text-sm text-gray-600">{userRole}</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4 space-x-reverse">
          {whatsappConnected && (
            <div className="flex items-center space-x-2 space-x-reverse bg-green-100 px-3 py-1 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-green-700">واتساب متصل</span>
            </div>
          )}
          
          <div className="flex items-center space-x-3 space-x-reverse">
            <span className="text-sm text-gray-700">{userName}</span>
            <button 
              onClick={onLogout} 
              className="text-red-600 hover:text-red-700"
              aria-label="تسجيل الخروج"
            >
              <i className="fas fa-sign-out-alt"></i>
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}