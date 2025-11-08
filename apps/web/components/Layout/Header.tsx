'use client';

import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import { getRoleDisplayName } from '../../lib/auth';

export default function Header() {
  const { user, logout } = useAuth();
  const { openModal } = useModal();

  if (!user) return null;

  const roleDisplay = getRoleDisplayName(user.role);
  const fullName = user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName;

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 fixed top-0 left-0 right-0 z-40">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left side - Logo and Title */}
        <div className="flex items-center space-x-4 space-x-reverse">
          <div className="bg-blue-100 w-10 h-10 rounded-full flex items-center justify-center">
            <i className="fas fa-clinic-medical text-blue-600"></i>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800">نظام إدارة العيادات</h1>
            <p className="text-sm text-gray-600">{roleDisplay}</p>
          </div>
        </div>

        {/* Right side - Status and User Menu */}
        <div className="flex items-center space-x-4 space-x-reverse">
          {/* WhatsApp Status */}
          <div className="hidden sm:flex items-center space-x-2 space-x-reverse bg-green-100 px-3 py-1 rounded-full">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-green-700">واتساب متصل</span>
          </div>

          {/* User Info and Logout */}
          <div className="flex items-center space-x-3 space-x-reverse pl-4 border-l border-gray-200">
            <span className="text-sm text-gray-700 font-medium">{fullName}</span>
            <button
              onClick={() => openModal('accountInfo')}
              className="text-blue-600 hover:text-blue-700 transition-colors"
              title="معلومات الحساب"
            >
              <i className="fas fa-user-circle text-lg"></i>
            </button>
            <button
              onClick={logout}
              className="text-red-600 hover:text-red-700 transition-colors"
              title="تسجيل الخروج"
            >
              <i className="fas fa-sign-out-alt text-lg"></i>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
